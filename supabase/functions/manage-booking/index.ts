import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.57.4";
import { ACTIVE_BOOKING_STATUSES, onlinePaymentReady, type Settings } from "../_shared/availability.ts";
import { type BookingRow, syncCalendarEvent } from "../_shared/bookings.ts";
import { freeBusy, serviceAccount } from "../_shared/google.ts";
import { corsHeaders, json, readJson } from "../_shared/http.ts";

// Azioni della professionista sulle prenotazioni (dall'area riservata).
//
// Accesso: solo con il token di sessione di un admin che ha completato il secondo
// fattore. Il controllo è fatto dal database (is_admin) con il token di chi chiama.
//
// Azioni:
//   confirm       pending / proposed -> confirmed (in presenza) o awaiting_payment (online:
//                 si chiede il bonifico anticipato)
//   mark_paid     awaiting_payment -> paid: bonifico ricevuto, appuntamento confermato
//   decline       pending -> declined
//   cancel        proposed / confirmed / awaiting_payment / paid -> cancelled
//   cancel_series annulla questa seduta proposta e le successive della stessa serie
//   link_sent     registra che le coordinate per il bonifico sono state inviate
//   delete        cancella la prenotazione (e, se è la prima, le sedute collegate)
//   schedule      fissa una o più sedute successive (stato "proposed")
//   move          sposta un appuntamento attivo (anche quelli nati dal sito)
//   waive_payment conferma una seduta online senza pagamento (casi straordinari)
//   calendar      occupazione del periodo: impegni Google (solo occupato/libero),
//                 blocchi, prenotazioni (solo codice e stato) e orari di lavoro
// Ogni cambio allinea l'evento nel calendario "Prenotazioni sito".

const METHODS = "POST";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COLUMNS =
  "id,ref,starts_at,ends_at,mode,status,calendar_event_id,confirm_deadline,payment_deadline,price_cents,pay_token,link_sent_at,first_booking_id,series_id,payment_waived";
const ACTIONS = [
  "confirm",
  "mark_paid",
  "waive_payment",
  "decline",
  "cancel",
  "cancel_series",
  "link_sent",
  "delete",
  "schedule",
  "move",
  "calendar",
];
const DAY = 86_400_000;
const MAX_SERIES = 26;
const MAX_AHEAD_DAYS = 400;

type Row = BookingRow & {
  first_booking_id: string | null;
  series_id: string | null;
  confirm_deadline: string | null;
  payment_deadline: string | null;
};

const isoOrNull = (v: unknown) => {
  if (typeof v !== "string") return null;
  const t = Date.parse(v);
  return Number.isFinite(t) ? t : null;
};

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(request, METHODS) });
  if (request.method !== "POST") return json(request, METHODS, 405, { code: "invalid" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authorization = request.headers.get("authorization") ?? "";
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return json(request, METHODS, 503, { code: "unavailable" });
  if (!authorization.startsWith("Bearer ")) return json(request, METHODS, 401, { code: "unauthorized" });

  const asCaller = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: isAdmin, error: adminError } = await asCaller.rpc("is_admin");
  if (adminError || isAdmin !== true) return json(request, METHODS, 403, { code: "forbidden" });

  const body = await readJson(request);
  const action = typeof body?.action === "string" ? body.action : "";
  if (!ACTIONS.includes(action)) return json(request, METHODS, 400, { code: "invalid" });

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const now = Date.now();

  if (action === "calendar") {
    const from = isoOrNull(body?.from);
    const to = isoOrNull(body?.to);
    if (from === null || to === null || to <= from || to - from > MAX_AHEAD_DAYS * DAY) {
      return json(request, METHODS, 400, { code: "invalid" });
    }
    return json(request, METHODS, 200, await calendar(supabase, from, to));
  }

  const id = typeof body?.id === "string" && UUID.test(body.id) ? body.id : null;
  if (!id) return json(request, METHODS, 400, { code: "invalid" });
  const { data: found } = await supabase.from("bookings").select(COLUMNS).eq("id", id).maybeSingle();
  if (!found) return json(request, METHODS, 404, { code: "not_found" });
  const booking = found as Row;

  if (action === "schedule") {
    const mode = body?.mode === "online" || body?.mode === "in_presenza" ? body.mode : null;
    const starts = Array.isArray(body?.starts) ? body.starts.map(isoOrNull) : [];
    if (!mode || starts.length < 1 || starts.length > MAX_SERIES || starts.some((s: number | null) => s === null)) {
      return json(request, METHODS, 400, { code: "invalid" });
    }
    const times = [...new Set(starts as number[])].sort((a, b) => a - b);
    if (times[0] <= now || times[times.length - 1] > now + MAX_AHEAD_DAYS * DAY) {
      return json(request, METHODS, 400, { code: "invalid_date" });
    }
    // Le sedute si collegano sempre alla prima prenotazione del paziente.
    const rootId = booking.first_booking_id ?? booking.id;
    const { data: root } = await supabase.from("bookings").select("status").eq("id", rootId).single();
    if (!root || !["confirmed", "paid"].includes(root.status as string)) {
      return json(request, METHODS, 409, { code: "wrong_status" });
    }
    const { data: s } = await supabase.from("booking_settings").select("session_minutes").single();
    const minutes = (s?.session_minutes as number | undefined) ?? 50;
    const seriesId = times.length > 1 ? crypto.randomUUID() : null;
    const { error } = await supabase.from("bookings").insert(
      times.map((t) => ({
        first_booking_id: rootId,
        series_id: seriesId,
        starts_at: new Date(t).toISOString(),
        ends_at: new Date(t + minutes * 60_000).toISOString(),
        mode,
        status: "proposed",
      })),
    );
    if (error) {
      if (error.code === "23P01") return json(request, METHODS, 409, { code: "slot_taken" });
      console.error(JSON.stringify({ event: "schedule_failed", code: error.code ?? "unknown" }));
      return json(request, METHODS, 503, { code: "unavailable" });
    }
    return json(request, METHODS, 200, { ok: true, created: times.length });
  }

  if (action === "move") {
    // Si può spostare qualunque appuntamento ancora attivo, anche quelli nati dal sito.
    if (!ACTIVE_BOOKING_STATUSES.includes(booking.status)) return json(request, METHODS, 409, { code: "wrong_status" });
    const start = isoOrNull(body?.start);
    if (start === null || start <= now || start > now + MAX_AHEAD_DAYS * DAY) {
      return json(request, METHODS, 400, { code: "invalid_date" });
    }
    const length = Date.parse(booking.ends_at) - Date.parse(booking.starts_at);
    const patch: Record<string, string> = {
      starts_at: new Date(start).toISOString(),
      ends_at: new Date(start + length).toISOString(),
    };
    if (booking.status === "pending") {
      // La scadenza per confermare non può superare il nuovo inizio.
      const current = booking.confirm_deadline ? Date.parse(booking.confirm_deadline) : start;
      patch.confirm_deadline = new Date(Math.min(current, start)).toISOString();
    }
    if (booking.status === "awaiting_payment") {
      // Il pagamento deve arrivare prima del nuovo inizio, con lo stesso anticipo.
      const { data: s } = await supabase.from("booking_settings").select("payment_cutoff_hours").single();
      const cutoff = ((s?.payment_cutoff_hours as number | undefined) ?? 24) * 3_600_000;
      const current = booking.payment_deadline ? Date.parse(booking.payment_deadline) : start - cutoff;
      const deadline = Math.min(current, start - cutoff);
      if (deadline <= now) return json(request, METHODS, 409, { code: "too_late_to_pay" });
      patch.payment_deadline = new Date(deadline).toISOString();
    }
    const { error } = await supabase.from("bookings").update(patch).eq("id", id).eq("status", booking.status);
    if (error) {
      if (error.code === "23P01") return json(request, METHODS, 409, { code: "slot_taken" });
      return json(request, METHODS, 503, { code: "unavailable" });
    }
  }

  if (action === "waive_payment") {
    // Casi straordinari: seduta online confermata senza pagamento.
    if (booking.mode !== "online" || !["pending", "proposed", "awaiting_payment"].includes(booking.status)) {
      return json(request, METHODS, 409, { code: "wrong_status" });
    }
    if (Date.parse(booking.starts_at) <= now) return json(request, METHODS, 409, { code: "too_late" });
    await supabase
      .from("bookings")
      .update({ status: "confirmed", payment_waived: true, pay_token: null, payment_deadline: null, price_cents: null })
      .eq("id", id)
      .eq("status", booking.status);
  }

  if (action === "mark_paid") {
    if (booking.status !== "awaiting_payment") return json(request, METHODS, 409, { code: "wrong_status" });
    await supabase
      .from("bookings")
      .update({ status: "paid", paid_at: new Date(now).toISOString() })
      .eq("id", id)
      .eq("status", "awaiting_payment");
  }

  if (action === "cancel_series") {
    if (booking.status !== "proposed" || !booking.series_id) return json(request, METHODS, 409, { code: "wrong_status" });
    await supabase
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("series_id", booking.series_id)
      .eq("status", "proposed")
      .gte("starts_at", booking.starts_at);
    return json(request, METHODS, 200, { ok: true });
  }

  if (action === "delete") {
    // Prima si tolgono da Google gli eventi di questa prenotazione e delle sedute collegate.
    const { data: children } = await supabase.from("bookings").select(COLUMNS).eq("first_booking_id", id);
    for (const row of [booking, ...((children ?? []) as Row[])]) {
      await syncCalendarEvent(supabase, { ...row, status: "deleted" });
    }
    const { error } = await supabase.from("bookings").delete().eq("id", id);
    if (error) return json(request, METHODS, 503, { code: "unavailable" });
    return json(request, METHODS, 200, { ok: true });
  }

  if (action === "link_sent") {
    if (booking.status !== "awaiting_payment") return json(request, METHODS, 409, { code: "wrong_status" });
    await supabase.from("bookings").update({ link_sent_at: new Date(now).toISOString() }).eq("id", id);
  }

  if (action === "decline") {
    if (booking.status !== "pending") return json(request, METHODS, 409, { code: "wrong_status" });
    await supabase.from("bookings").update({ status: "declined" }).eq("id", id).eq("status", "pending");
  }

  if (action === "cancel") {
    if (!["proposed", "confirmed", "awaiting_payment", "paid"].includes(booking.status)) {
      return json(request, METHODS, 409, { code: "wrong_status" });
    }
    await supabase.from("bookings").update({ status: "cancelled" }).eq("id", id);
  }

  if (action === "confirm") {
    if (booking.status !== "pending" && booking.status !== "proposed") {
      return json(request, METHODS, 409, { code: "wrong_status" });
    }
    const previous = booking.status;
    const start = Date.parse(booking.starts_at);
    if (start <= now) return json(request, METHODS, 409, { code: "too_late" });

    if (booking.mode === "in_presenza") {
      await supabase.from("bookings").update({ status: "confirmed" }).eq("id", id).eq("status", previous);
    } else {
      const { data: s } = await supabase.from("booking_settings").select("*").single();
      const settings = s as Settings | null;
      if (!settings || !onlinePaymentReady(settings)) {
        return json(request, METHODS, 409, { code: "payment_not_configured" });
      }
      const deadline = Math.min(
        now + settings.payment_window_hours * 3_600_000,
        start - settings.payment_cutoff_hours * 3_600_000,
      );
      if (deadline <= now) return json(request, METHODS, 409, { code: "too_late_to_pay" });
      await supabase
        .from("bookings")
        .update({
          status: "awaiting_payment",
          price_cents: settings.online_price_cents,
          payment_deadline: new Date(deadline).toISOString(),
        })
        .eq("id", id)
        .eq("status", previous);
    }
  }

  const { data: updated } = await supabase.from("bookings").select(COLUMNS).eq("id", id).single();
  if (updated) await syncCalendarEvent(supabase, updated as Row);
  return json(request, METHODS, 200, { ok: true });
});

// Occupazione del periodo per il calendario dell'area riservata.
// PRIVACY: dagli impegni Google arrivano solo inizio e fine (nessun titolo);
// delle prenotazioni si mandano solo codice, stato e modalità, non i nomi.
async function calendar(supabase: SupabaseClient, from: number, to: number) {
  const fromIso = new Date(from).toISOString();
  const toIso = new Date(to).toISOString();
  const [settingsRes, hoursRes, blocksRes, bookingsRes] = await Promise.all([
    supabase.from("booking_settings").select("session_minutes,buffer_minutes,timezone,closed_holidays,patron_day").single(),
    supabase.from("working_hours").select("weekday,start_time,end_time"),
    supabase.from("blocked_periods").select("starts_at,ends_at,label").lt("starts_at", toIso).gt("ends_at", fromIso),
    supabase
      .from("bookings")
      .select("id,ref,starts_at,ends_at,status,mode")
      .in("status", ACTIVE_BOOKING_STATUSES)
      .lt("starts_at", toIso)
      .gt("ends_at", fromIso),
  ]);

  let google: "ok" | "not_configured" | "error" = "ok";
  let busy: { start: string; end: string }[] = [];
  const sa = serviceAccount();
  const calendarId = Deno.env.get("GOOGLE_CALENDAR_ID")?.trim();
  if (!sa || !calendarId) {
    google = "not_configured";
  } else {
    try {
      busy = (await freeBusy(sa, calendarId, from, to)).map((b) => ({
        start: new Date(b.start).toISOString(),
        end: new Date(b.end).toISOString(),
      }));
    } catch (error) {
      google = "error";
      console.error(JSON.stringify({ event: "calendar_read_failed", reason: String((error as Error).message) }));
    }
  }

  return {
    google,
    busy,
    settings: settingsRes.data,
    hours: (hoursRes.data ?? []).map((h) => ({
      weekday: h.weekday,
      start: String(h.start_time).slice(0, 5),
      end: String(h.end_time).slice(0, 5),
    })),
    blocks: (blocksRes.data ?? []).map((b) => ({ start: b.starts_at, end: b.ends_at, label: b.label })),
    bookings: (bookingsRes.data ?? []).map((b) => ({
      id: b.id,
      ref: b.ref,
      start: b.starts_at,
      end: b.ends_at,
      status: b.status,
      mode: b.mode,
    })),
  };
}
