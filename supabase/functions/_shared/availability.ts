// Calcolo delle fasce libere, condiviso da availability (mostra le fasce) e da
// book (ricontrolla la fascia scelta prima di salvare la prenotazione).

import type { SupabaseClient } from "npm:@supabase/supabase-js@2.57.4";
import { computeSlots, type Interval } from "./slots.ts";
import { freeBusy, serviceAccount } from "./google.ts";

// Stati in cui una prenotazione occupa la fascia.
export const ACTIVE_BOOKING_STATUSES = ["pending", "proposed", "awaiting_payment", "confirmed", "paid"];

export type Settings = {
  session_minutes: number;
  buffer_minutes: number;
  min_notice_hours: number;
  max_days_ahead: number;
  timezone: string;
  closed_holidays: string[];
  patron_day: string | null;
  confirm_window_hours: number;
  online_price_cents: number | null;
  payment_window_hours: number;
  payment_cutoff_hours: number;
  refund_notice_hours: number;
  cancellation_note: string | null;
  video_platform: string | null;
  video_instructions: string | null;
  bank_holder: string | null;
  bank_iban: string | null;
};

export type AvailabilityResult =
  | { ok: false; reason: "settings" }
  | {
    ok: true;
    calendar: "ok" | "not_configured" | "error";
    slots: number[];
    settings: Settings;
    onlineAvailable: boolean;
  };

// Online prenotabile solo se ci sono prezzo e coordinate per il bonifico.
export const onlinePaymentReady = (s: Settings) =>
  s.online_price_cents !== null && Boolean(s.bank_holder?.trim()) && Boolean(s.bank_iban?.trim());

export async function loadAvailability(supabase: SupabaseClient, now = Date.now()): Promise<AvailabilityResult> {
  const [settingsRes, hoursRes, blocksRes, bookingsRes] = await Promise.all([
    supabase.from("booking_settings").select("*").single(),
    supabase.from("working_hours").select("weekday,start_time,end_time"),
    supabase.from("blocked_periods").select("starts_at,ends_at").gt("ends_at", new Date(now).toISOString()),
    supabase
      .from("bookings")
      .select("starts_at,ends_at")
      .in("status", ACTIVE_BOOKING_STATUSES)
      .gt("ends_at", new Date(now).toISOString()),
  ]);
  if (settingsRes.error || hoursRes.error || blocksRes.error || bookingsRes.error || !settingsRes.data) {
    console.error(JSON.stringify({ event: "settings_read_failed" }));
    return { ok: false, reason: "settings" };
  }
  const settings = settingsRes.data as Settings;
  const horizon = now + (settings.max_days_ahead + 1) * 86_400_000;

  let busy: Interval[] = [];
  let calendar: "ok" | "not_configured" | "error" = "ok";
  const sa = serviceAccount();
  const calendarId = Deno.env.get("GOOGLE_CALENDAR_ID")?.trim();
  if (!sa || !calendarId) {
    calendar = "not_configured";
  } else {
    try {
      busy = await freeBusy(sa, calendarId, now, horizon);
    } catch (error) {
      calendar = "error";
      console.error(JSON.stringify({ event: "calendar_read_failed", reason: String((error as Error).message) }));
    }
  }

  // Senza calendario leggibile non si offrono fasce: niente doppie prenotazioni.
  if (calendar !== "ok") return { ok: true, calendar, slots: [], settings, onlineAvailable: false };

  const toInterval = (r: { starts_at: string; ends_at: string }) => ({
    start: Date.parse(r.starts_at),
    end: Date.parse(r.ends_at),
  });

  const slots = computeSlots({
    now,
    timezone: settings.timezone,
    sessionMinutes: settings.session_minutes,
    bufferMinutes: settings.buffer_minutes,
    minNoticeHours: settings.min_notice_hours,
    maxDaysAhead: settings.max_days_ahead,
    closedHolidays: settings.closed_holidays ?? [],
    patronDay: settings.patron_day ?? null,
    hours: (hoursRes.data ?? []).map((h) => ({
      weekday: h.weekday as number,
      start: String(h.start_time).slice(0, 5),
      end: String(h.end_time).slice(0, 5),
    })),
    unavailable: [...busy, ...(blocksRes.data ?? []).map(toInterval), ...(bookingsRes.data ?? []).map(toInterval)],
  });

  return { ok: true, calendar, slots, settings, onlineAvailable: onlinePaymentReady(settings) };
}
