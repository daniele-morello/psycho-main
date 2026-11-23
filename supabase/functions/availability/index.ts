import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { computeSlots, type Interval } from "./slots.ts";

// Fasce libere per la prenotazione online.
//
// Unisce: orari di lavoro (working_hours), impostazioni (booking_settings, con
// festività chiuse e santo patrono), blocchi manuali (blocked_periods) e gli
// intervalli "occupato" del Google Calendar della professionista.
//
// PRIVACY
// - Da Google si legge solo free/busy, con lo scope minimo calendar.freebusy.
//   Il calendario è condiviso con l'account di servizio come "Vedere solo
//   disponibilità": titoli, partecipanti e luoghi non arrivano mai qui.
// - La risposta contiene solo gli orari di inizio delle fasce libere. Nessun
//   dato personale, nessun motivo dell'occupazione.
// - Se il calendario non si può leggere, la funzione non offre nessuna fascia
//   (meglio nessuna disponibilità che una doppia prenotazione).
//
// Secret richiesti: GOOGLE_SERVICE_ACCOUNT_JSON, GOOGLE_CALENDAR_ID.

const DEFAULT_ORIGINS = ["http://localhost:5173", "https://daniele-morello.github.io"];
const FREEBUSY_WINDOW_DAYS = 30;

function allowedOrigins(): string[] {
  const configured = Deno.env.get("ALLOWED_ORIGINS");
  if (!configured) return DEFAULT_ORIGINS;
  return configured.split(",").map((o) => o.trim()).filter(Boolean);
}

function corsHeaders(request: Request): Headers {
  const headers = new Headers({
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
    Vary: "Origin",
  });
  const origin = request.headers.get("origin");
  if (origin && allowedOrigins().includes(origin)) headers.set("Access-Control-Allow-Origin", origin);
  return headers;
}

function json(request: Request, status: number, body: Record<string, unknown>) {
  const headers = corsHeaders(request);
  headers.set("Content-Type", "application/json");
  headers.set("Cache-Control", "no-store");
  return new Response(JSON.stringify(body), { status, headers });
}

// ---------- Google: token dell'account di servizio (JWT firmato RS256) ----------

type ServiceAccount = { client_email: string; private_key: string };

function base64url(data: Uint8Array | string): string {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

async function googleAccessToken(sa: ServiceAccount): Promise<string> {
  const pem = sa.private_key.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    "pkcs8",
    der,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/calendar.freebusy",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 600,
    }),
  );
  const unsigned = `${header}.${claims}`;
  const signature = new Uint8Array(
    await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned)),
  );
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsigned}.${base64url(signature)}`,
    }),
  });
  if (!response.ok) throw new Error(`token_${response.status}`);
  const data = (await response.json()) as { access_token?: string };
  if (!data.access_token) throw new Error("token_missing");
  return data.access_token;
}

async function googleBusy(
  sa: ServiceAccount,
  calendarId: string,
  from: Date,
  to: Date,
): Promise<Interval[]> {
  const token = await googleAccessToken(sa);
  const busy: Interval[] = [];
  // Una richiesta ogni 30 giorni: free/busy non accetta intervalli troppo lunghi.
  for (let start = from.getTime(); start < to.getTime(); start += FREEBUSY_WINDOW_DAYS * 86_400_000) {
    const end = Math.min(start + FREEBUSY_WINDOW_DAYS * 86_400_000, to.getTime());
    const response = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        timeMin: new Date(start).toISOString(),
        timeMax: new Date(end).toISOString(),
        items: [{ id: calendarId }],
      }),
    });
    if (!response.ok) throw new Error(`freebusy_${response.status}`);
    const data = (await response.json()) as {
      calendars?: Record<string, { busy?: { start: string; end: string }[]; errors?: { reason: string }[] }>;
    };
    const calendar = data.calendars?.[calendarId];
    if (!calendar || calendar.errors?.length) {
      throw new Error(`calendar_${calendar?.errors?.[0]?.reason ?? "missing"}`);
    }
    for (const b of calendar.busy ?? []) {
      busy.push({ start: Date.parse(b.start), end: Date.parse(b.end) });
    }
  }
  return busy;
}

// ---------- Handler ----------

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }
  if (request.method !== "GET") return json(request, 405, { code: "invalid" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    console.error(JSON.stringify({ event: "missing_server_configuration" }));
    return json(request, 503, { code: "unavailable" });
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const [settingsRes, hoursRes, blocksRes] = await Promise.all([
    supabase
      .from("booking_settings")
      .select("session_minutes,buffer_minutes,min_notice_hours,max_days_ahead,timezone,closed_holidays,patron_day")
      .single(),
    supabase.from("working_hours").select("weekday,start_time,end_time"),
    supabase.from("blocked_periods").select("starts_at,ends_at").gt("ends_at", new Date().toISOString()),
  ]);
  if (settingsRes.error || hoursRes.error || blocksRes.error || !settingsRes.data) {
    console.error(JSON.stringify({ event: "settings_read_failed" }));
    return json(request, 503, { code: "unavailable" });
  }
  const settings = settingsRes.data;
  const now = Date.now();
  const horizon = new Date(now + (settings.max_days_ahead + 1) * 86_400_000);

  let busy: Interval[] = [];
  let calendar: "ok" | "not_configured" | "error" = "ok";
  const saJson = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
  const calendarId = Deno.env.get("GOOGLE_CALENDAR_ID")?.trim();
  if (!saJson || !calendarId) {
    calendar = "not_configured";
  } else {
    try {
      const sa = JSON.parse(saJson) as ServiceAccount;
      busy = await googleBusy(sa, calendarId, new Date(now), horizon);
    } catch (error) {
      calendar = "error";
      console.error(JSON.stringify({ event: "calendar_read_failed", reason: String((error as Error).message) }));
    }
  }

  // Senza calendario leggibile non si offrono fasce: niente doppie prenotazioni.
  if (calendar !== "ok") return json(request, 200, { slots: [], calendar });

  const slots = computeSlots({
    now,
    timezone: settings.timezone,
    sessionMinutes: settings.session_minutes,
    bufferMinutes: settings.buffer_minutes,
    minNoticeHours: settings.min_notice_hours,
    maxDaysAhead: settings.max_days_ahead,
    closedHolidays: (settings.closed_holidays as string[] | null) ?? [],
    patronDay: (settings.patron_day as string | null) ?? null,
    hours: (hoursRes.data ?? []).map((h) => ({
      weekday: h.weekday as number,
      start: String(h.start_time).slice(0, 5),
      end: String(h.end_time).slice(0, 5),
    })),
    unavailable: [
      ...busy,
      ...(blocksRes.data ?? []).map((b) => ({ start: Date.parse(b.starts_at), end: Date.parse(b.ends_at) })),
    ],
  });

  return json(request, 200, {
    slots: slots.map((s) => new Date(s).toISOString()),
    session_minutes: settings.session_minutes,
    calendar,
  });
});
