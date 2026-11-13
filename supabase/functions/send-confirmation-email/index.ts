import { createClient } from "npm:@supabase/supabase-js@2.57.4";

// TURNSTILE È DISATTIVATO finché TURNSTILE_SECRET_KEY non è impostato nei secret
// della funzione. In quello stato il token non è richiesto. Per attivarlo servono
// insieme TURNSTILE_SECRET_KEY (solo qui) e VITE_TURNSTILE_SITE_KEY (nel build).
//
// CORS limita soltanto i browser. Non ferma una chiamata diretta o un bot.
//
// IP DEL CLIENT. Le Edge Function ospitate da Supabase non documentano un header
// di IP che il runtime garantisca di aver scritto lui e che il chiamante non possa
// impostare. cf-connecting-ip, x-real-ip e x-forwarded-for arrivano nella richiesta
// e possono essere presenti, ma la documentazione ufficiale non dice che l'ingress
// li sovrascriva. L'esempio di log delle funzioni non li elenca tra gli header
// osservati. Il gateway della CLI locale, da ottobre 2026, sostituisce x-real-ip:
// quel comportamento è del CLI, non una garanzia del progetto ospitato.
// Per questo il rate limit NON usa l'IP. La chiave è HMAC(RATE_LIMIT_HMAC_SECRET,
// email normalizzata). Ferma i ripetuti di uno stesso indirizzo e non può essere
// scelta dal browser al posto del segreto. Non ferma chi cambia indirizzo a ogni
// richiesta. Un limite per IP attendibile va messo davanti alla funzione, dove il
// proxy vede la connessione (per esempio una regola Cloudflare sul dominio),
// oppure va usato un header che Supabase documenti come impostato dal proprio
// ingress. Auth ha Sb-Forwarded-For, ma vale solo per Auth e solo con chiave
// segreta: non si applica a questa funzione pubblica.

const PRIVACY_VERSION = "2026-11-10";
const IDEMPOTENCY_CONSTRAINT = "contact_requests_idempotency_key_key";
const RATE_LIMIT_PER_HOUR = 5;
const MAX_BODY_BYTES = 20_000;
const THERAPIST_EMAIL = "jerardadamarisceglia@gmail.com";
const SERVICES = [
  "Psicoterapia individuale",
  "Terapia di coppia",
  "Psicologia clinica",
  "Counseling",
  "Supervisione",
  "Mindfulness",
  "Altro",
];

const DEFAULT_ORIGINS = [
  "http://localhost:5173",
  "https://daniele-morello.github.io",
];

type Payload = Record<string, unknown>;

function allowedOrigins(): string[] {
  const configured = Deno.env.get("ALLOWED_ORIGINS");
  if (!configured) return DEFAULT_ORIGINS;
  return configured.split(",").map((origin) => origin.trim()).filter(Boolean);
}

function corsHeaders(request: Request): Headers {
  const headers = new Headers({
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
    Vary: "Origin",
  });
  const origin = request.headers.get("origin");
  if (origin && allowedOrigins().includes(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
  }
  return headers;
}

function json(request: Request, status: number, body: Record<string, unknown>) {
  const headers = corsHeaders(request);
  headers.set("Content-Type", "application/json");
  return new Response(JSON.stringify(body), { status, headers });
}

function received(request: Request) {
  return json(request, 200, { received: true });
}

function invalid(request: Request) {
  return json(request, 400, { received: false, code: "invalid" });
}

async function readLimitedBody(request: Request): Promise<string | null> {
  const declared = request.headers.get("content-length");
  if (declared !== null) {
    const size = Number(declared);
    if (!Number.isInteger(size) || size < 0 || size > MAX_BODY_BYTES) return null;
  }
  if (!request.body) return "";

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BODY_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

function isJsonObject(value: unknown): value is Payload {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function hmac(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(signature)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function hourWindow(): string {
  const now = new Date();
  now.setUTCMinutes(0, 0, 0);
  return now.toISOString();
}

function asText(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max + 1);
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

function validate(body: Payload): { ok: true; data: Record<string, string> } | { ok: false } {
  const name = asText(body.name, 80);
  const surname = asText(body.surname, 80);
  const email = asText(body.email, 254).toLowerCase();
  const phone = asText(body.phone, 30);
  const service = asText(body.service, 80);
  const preferredTime = asText(body.preferred_time, 120);
  const message = asText(body.message, 2000);
  const idempotencyKey = asText(body.idempotencyKey, 36);

  if (!/^[\p{L}][\p{L}\s'.-]{0,79}$/u.test(name)) return { ok: false };
  if (!/^[\p{L}][\p{L}\s'.-]{0,79}$/u.test(surname)) return { ok: false };
  if (!isValidEmail(email)) return { ok: false };
  if (phone && !/^[0-9+().\s-]{6,30}$/.test(phone)) return { ok: false };
  if (!SERVICES.includes(service)) return { ok: false };
  if (preferredTime.length > 120) return { ok: false };
  if (message.length < 1 || message.length > 2000) return { ok: false };
  if (body.privacyAccepted !== true || body.privacyVersion !== PRIVACY_VERSION) {
    return { ok: false };
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idempotencyKey)) {
    return { ok: false };
  }

  return {
    ok: true,
    data: { name, surname, email, phone, service, preferredTime, message, idempotencyKey },
  };
}

function honeypotTripped(body: Payload): boolean {
  const value = body.company_website;
  return value !== undefined && value !== "";
}

async function verifyTurnstile(token: unknown, secret: string): Promise<boolean> {
  if (typeof token !== "string" || token.length < 10 || token.length > 2048) return false;
  const form = new URLSearchParams({ secret, response: token });
  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: form,
  });
  if (!response.ok) return false;
  const result = await response.json().catch(() => null) as { success?: boolean } | null;
  return result?.success === true;
}

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function isIdempotencyConflict(error: { code?: string; message?: string }): boolean {
  return error.code === "23505" && (error.message ?? "").includes(`"${IDEMPOTENCY_CONSTRAINT}"`);
}

async function sendEmail(
  kind: "confirmation" | "therapist",
  to: string,
  subject: string,
  html: string,
  apiKey: string,
  from: string,
) {
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        reply_to: THERAPIST_EMAIL,
        subject,
        html,
      }),
    });
    if (!response.ok) {
      console.error(JSON.stringify({ event: `${kind}_email_failed`, status: response.status }));
    }
  } catch {
    console.error(JSON.stringify({ event: `${kind}_email_network_error` }));
  }
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }
  if (request.method !== "POST") {
    return json(request, 405, { received: false, code: "invalid" });
  }

  const rawBody = await readLimitedBody(request);
  if (rawBody === null) return invalid(request);

  let parsed: unknown;
  try {
    parsed = rawBody === "" ? null : JSON.parse(rawBody);
  } catch {
    return invalid(request);
  }
  if (!isJsonObject(parsed)) return invalid(request);

  if (honeypotTripped(parsed)) return received(request);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const rateLimitSecret = Deno.env.get("RATE_LIMIT_HMAC_SECRET");
  if (!supabaseUrl || !serviceRoleKey || !rateLimitSecret) {
    console.error(JSON.stringify({ event: "missing_server_configuration" }));
    return json(request, 503, { received: false, code: "unavailable" });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Turnstile resta disattivato finché TURNSTILE_SECRET_KEY non è configurato.
  const turnstileSecret = Deno.env.get("TURNSTILE_SECRET_KEY");
  if (turnstileSecret) {
    const passed = await verifyTurnstile(parsed.turnstileToken, turnstileSecret).catch(() => false);
    if (!passed) return invalid(request);
  }

  const validated = validate(parsed);
  if (!validated.ok) return invalid(request);
  const data = validated.data;

  const { data: existing, error: lookupError } = await supabase
    .from("contact_requests")
    .select("id")
    .eq("idempotency_key", data.idempotencyKey)
    .maybeSingle();
  if (lookupError) {
    console.error(JSON.stringify({ event: "idempotency_lookup_failed" }));
    return json(request, 503, { received: false, code: "unavailable" });
  }
  if (existing) return received(request);

  // data.email è già senza spazi e in minuscolo. In contact_rate_limits finisce solo questo HMAC.
  const rateKey = await hmac(rateLimitSecret, data.email);
  const { data: count, error: rateError } = await supabase.rpc("consume_contact_rate_limit", {
    p_email_hash: rateKey,
    p_window_start: hourWindow(),
  });
  if (rateError || typeof count !== "number") {
    console.error(JSON.stringify({ event: "rate_limit_failed" }));
    return json(request, 503, { received: false, code: "unavailable" });
  }
  if (count > RATE_LIMIT_PER_HOUR) {
    return json(request, 429, { received: false, code: "rate_limited" });
  }

  const { error: insertError } = await supabase.from("contact_requests").insert({
    name: data.name,
    surname: data.surname,
    email: data.email,
    phone: data.phone || null,
    service: data.service,
    preferred_time: data.preferredTime || null,
    message: data.message,
    privacy_accepted_at: new Date().toISOString(),
    privacy_version: PRIVACY_VERSION,
    idempotency_key: data.idempotencyKey,
  });

  if (insertError) {
    if (isIdempotencyConflict(insertError)) return received(request);
    console.error(JSON.stringify({ event: "insert_failed", code: insertError.code ?? "unknown" }));
    return json(request, 503, { received: false, code: "unavailable" });
  }

  const resendKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("RESEND_FROM")?.trim() ?? "";
  if (!resendKey || !from) {
    console.error(JSON.stringify({ event: "email_not_configured" }));
    return received(request);
  }

  const safeName = escapeHtml(`${data.name} ${data.surname}`);
  await sendEmail(
    "confirmation",
    data.email,
    "Richiesta ricevuta — Dr.ssa Jerarda Damaris Ceglia",
    `<p>Gentile ${safeName},</p><p>ho ricevuto la tua richiesta di contatto e ti risponderò entro 24 ore.</p><p>Dr.ssa Jerarda Damaris Ceglia</p>`,
    resendKey,
    from,
  );
  await sendEmail(
    "therapist",
    THERAPIST_EMAIL,
    "Nuova richiesta di contatto",
    `<p>Nuova richiesta di contatto da ${safeName}.</p><p>Il messaggio non è incluso in questa email. I dati sono nella tabella contact_requests.</p>`,
    resendKey,
    from,
  );

  return received(request);
});
