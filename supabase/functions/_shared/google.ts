// Accesso a Google Calendar con l'account di servizio.
//
// - Calendario principale della professionista: solo free/busy
//   (condiviso come "Vedere solo disponibilità", scope calendar.freebusy).
// - Calendario "Prenotazioni sito": scrittura degli eventi delle sedute
//   (condiviso come "Apportare modifiche agli eventi", scope calendar.events).
//   Gli eventi hanno solo un titolo neutro con il codice di riferimento:
//   nessun nome o contatto del paziente finisce in Google.

import type { Interval } from "./slots.ts";

export type ServiceAccount = { client_email: string; private_key: string };

const SCOPE_FREEBUSY = "https://www.googleapis.com/auth/calendar.freebusy";
const SCOPE_EVENTS = "https://www.googleapis.com/auth/calendar.events";
const FREEBUSY_WINDOW_DAYS = 30;

export function serviceAccount(): ServiceAccount | null {
  const raw = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
  if (!raw) return null;
  try {
    const sa = JSON.parse(raw) as ServiceAccount;
    return sa.client_email && sa.private_key ? sa : null;
  } catch {
    return null;
  }
}

function base64url(data: Uint8Array | string): string {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

async function accessToken(sa: ServiceAccount, scope: string): Promise<string> {
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
    JSON.stringify({ iss: sa.client_email, scope, aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 600 }),
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

export async function freeBusy(sa: ServiceAccount, calendarId: string, from: number, to: number): Promise<Interval[]> {
  const token = await accessToken(sa, SCOPE_FREEBUSY);
  const busy: Interval[] = [];
  // Una richiesta ogni 30 giorni: free/busy non accetta intervalli troppo lunghi.
  for (let start = from; start < to; start += FREEBUSY_WINDOW_DAYS * 86_400_000) {
    const end = Math.min(start + FREEBUSY_WINDOW_DAYS * 86_400_000, to);
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
    for (const b of calendar.busy ?? []) busy.push({ start: Date.parse(b.start), end: Date.parse(b.end) });
  }
  return busy;
}

// ---------- Calendario "Prenotazioni sito" ----------

export type BookingEvent = { summary: string; start: string; end: string };

const eventsUrl = (calendarId: string) =>
  `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;

export async function upsertEvent(
  sa: ServiceAccount,
  calendarId: string,
  existingId: string | null,
  event: BookingEvent,
): Promise<string> {
  const token = await accessToken(sa, SCOPE_EVENTS);
  const body = JSON.stringify({
    summary: event.summary,
    start: { dateTime: event.start },
    end: { dateTime: event.end },
    transparency: "opaque",
    visibility: "private",
    reminders: { useDefault: true },
  });
  const response = await fetch(
    existingId ? `${eventsUrl(calendarId)}/${encodeURIComponent(existingId)}` : eventsUrl(calendarId),
    {
      method: existingId ? "PATCH" : "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body,
    },
  );
  if (!response.ok) throw new Error(`event_${response.status}`);
  const data = (await response.json()) as { id?: string };
  if (!data.id) throw new Error("event_missing_id");
  return data.id;
}

export async function deleteEvent(sa: ServiceAccount, calendarId: string, eventId: string): Promise<void> {
  const token = await accessToken(sa, SCOPE_EVENTS);
  const response = await fetch(`${eventsUrl(calendarId)}/${encodeURIComponent(eventId)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  // 404/410: l'evento non c'è più (già cancellato a mano): va bene così.
  if (!response.ok && response.status !== 404 && response.status !== 410) throw new Error(`event_delete_${response.status}`);
}
