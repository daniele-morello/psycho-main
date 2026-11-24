import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { loadAvailability } from "../_shared/availability.ts";
import { expireBookings } from "../_shared/bookings.ts";
import { alertEmail, escapeHtml, formatRome, sendEmail } from "../_shared/email.ts";
import { corsHeaders, json, readJson } from "../_shared/http.ts";

// Prenotazione del primo colloquio dal sito.
//
// - Ricontrolla che la fascia sia ancora libera (stesso calcolo di availability).
// - Accetta solo chi dichiara di essere maggiorenne.
// - Salva la prenotazione come "pending": la professionista la conferma o la
//   rifiuta dall'area riservata. Se non lo fa entro confirm_window_hours scade.
// - Il database impedisce due prenotazioni attive sovrapposte.
//
// PRIVACY: si raccolgono solo nome, cognome, email, telefono facoltativo, fascia
// e modalità. Nessun messaggio. L'avviso alla professionista contiene solo il
// numero di prenotazioni da confermare.

const METHODS = "POST";
const PRIVACY_VERSIONS = ["2026-11-24"];
const RATE_LIMIT_PER_HOUR = 5;
const PERSON_NAME = /^[\p{L}][\p{L}\p{M}\s'‘’ʼ-]{0,79}$/u;
const PHONE_NUMBER = /^\+?[0-9]{6,30}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max + 1) : "");

async function hmac(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function hourWindow(): string {
  const now = new Date();
  now.setUTCMinutes(0, 0, 0);
  return now.toISOString();
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(request, METHODS) });
  if (request.method !== "POST") return json(request, METHODS, 405, { received: false, code: "invalid" });

  const body = await readJson(request);
  if (!body) return json(request, METHODS, 400, { received: false, code: "invalid" });
  // Campo nascosto anti-bot: se compilato si risponde "ricevuto" senza salvare.
  if (body.company_website !== undefined && body.company_website !== "") {
    return json(request, METHODS, 200, { received: true });
  }

  const name = text(body.name, 80);
  const surname = text(body.surname, 80);
  const email = text(body.email, 254).toLowerCase();
  const phone = text(body.phone, 30);
  const mode = body.mode === "online" || body.mode === "in_presenza" ? body.mode : null;
  const start = typeof body.start === "string" ? Date.parse(body.start) : Number.NaN;
  const idempotencyKey = text(body.idempotencyKey, 36);
  const privacyVersion = typeof body.privacyVersion === "string" ? body.privacyVersion : "";

  if (
    !PERSON_NAME.test(name) || !PERSON_NAME.test(surname) ||
    !EMAIL.test(email) || email.length > 254 ||
    (phone && !PHONE_NUMBER.test(phone)) ||
    !mode || !Number.isFinite(start) ||
    body.adult !== true ||
    body.privacyAccepted !== true || !PRIVACY_VERSIONS.includes(privacyVersion) ||
    !UUID.test(idempotencyKey)
  ) {
    return json(request, METHODS, 400, { received: false, code: "invalid" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const rateLimitSecret = Deno.env.get("RATE_LIMIT_HMAC_SECRET");
  if (!supabaseUrl || !serviceRoleKey || !rateLimitSecret) {
    console.error(JSON.stringify({ event: "missing_server_configuration" }));
    return json(request, METHODS, 503, { received: false, code: "unavailable" });
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });

  // Stessa richiesta inviata due volte (doppio clic, rete lenta): una sola prenotazione.
  const { data: existing } = await supabase.from("bookings").select("id").eq("idempotency_key", idempotencyKey).maybeSingle();
  if (existing) return json(request, METHODS, 200, { received: true });

  const { data: count, error: rateError } = await supabase.rpc("consume_contact_rate_limit", {
    p_email_hash: await hmac(rateLimitSecret, `booking:${email}`),
    p_window_start: hourWindow(),
  });
  if (rateError || typeof count !== "number") return json(request, METHODS, 503, { received: false, code: "unavailable" });
  if (count > RATE_LIMIT_PER_HOUR) return json(request, METHODS, 429, { received: false, code: "rate_limited" });

  await expireBookings(supabase);
  const availability = await loadAvailability(supabase);
  if (!availability.ok || availability.calendar !== "ok") {
    return json(request, METHODS, 503, { received: false, code: "unavailable" });
  }
  if (!availability.slots.includes(start)) return json(request, METHODS, 409, { received: false, code: "slot_taken" });
  if (mode === "online" && !availability.onlineAvailable) {
    return json(request, METHODS, 400, { received: false, code: "online_unavailable" });
  }

  const s = availability.settings;
  const now = Date.now();
  const startsAt = new Date(start).toISOString();
  const endsAt = new Date(start + s.session_minutes * 60_000).toISOString();
  const confirmDeadline = new Date(Math.min(now + s.confirm_window_hours * 3_600_000, start)).toISOString();

  const { error: insertError } = await supabase.from("bookings").insert({
    starts_at: startsAt,
    ends_at: endsAt,
    mode,
    name,
    surname,
    email,
    phone: phone || null,
    adult_confirmed: true,
    privacy_version: privacyVersion,
    privacy_accepted_at: new Date(now).toISOString(),
    idempotency_key: idempotencyKey,
    confirm_deadline: confirmDeadline,
  });
  if (insertError) {
    // 23P01: un'altra prenotazione ha preso la stessa fascia un istante prima.
    if (insertError.code === "23P01") return json(request, METHODS, 409, { received: false, code: "slot_taken" });
    if (insertError.code === "23505") return json(request, METHODS, 200, { received: true });
    console.error(JSON.stringify({ event: "booking_insert_failed", code: insertError.code ?? "unknown" }));
    return json(request, METHODS, 503, { received: false, code: "unavailable" });
  }

  // Avviso alla professionista: solo quante prenotazioni attendono conferma.
  const { count: pending } = await supabase
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");
  await sendEmail(
    "booking_alert",
    alertEmail(),
    "Nuova prenotazione da confermare",
    `<p>C'è una nuova richiesta di appuntamento.</p><p>Prenotazioni da confermare: <strong>${pending ?? 1}</strong>.</p><p>Apri l'area riservata del sito per confermarle o rifiutarle.</p>`,
  );

  // Riepilogo al paziente (data, ora e modalità: nessun altro dato).
  const modeLabel = mode === "online" ? "online" : "in presenza";
  const next =
    mode === "online"
      ? "Se l'orario è disponibile ti invierò le coordinate per il bonifico anticipato: l'appuntamento sarà confermato quando lo riceverò."
      : "Ti scriverò per confermare l'appuntamento.";
  await sendEmail(
    "booking_received",
    email,
    "Richiesta di appuntamento ricevuta — Dr.ssa Jerarda Damaris Ceglia",
    `<p>Gentile ${escapeHtml(name)},</p><p>ho ricevuto la tua richiesta per un primo colloquio ${modeLabel} il <strong>${escapeHtml(formatRome(startsAt))}</strong>.</p><p>${next} Fino ad allora l'orario resta riservato per te.</p><p>Dr.ssa Jerarda Damaris Ceglia</p>`,
  );

  return json(request, METHODS, 200, { received: true });
});
