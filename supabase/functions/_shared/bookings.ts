// Operazioni sulle prenotazioni condivise dalle funzioni: eventi nel calendario
// "Prenotazioni sito" e scadenze.

import type { SupabaseClient } from "npm:@supabase/supabase-js@2.57.4";
import { deleteEvent, serviceAccount, upsertEvent } from "./google.ts";

export type BookingRow = {
  id: string;
  ref: string;
  starts_at: string;
  ends_at: string;
  mode: "online" | "in_presenza";
  status: string;
  calendar_event_id: string | null;
};

// Titolo neutro: solo modalità, stato del pagamento e codice. Mai il nome.
export function eventSummary(b: BookingRow): string | null {
  if (b.status === "confirmed" && b.mode === "online") return `Seduta online – gratuita – rif. ${b.ref}`;
  if (b.status === "confirmed") return `Seduta in presenza – rif. ${b.ref}`;
  if (b.status === "awaiting_payment") return `Seduta online – da pagare – rif. ${b.ref}`;
  if (b.status === "paid") return `Seduta online – pagata – rif. ${b.ref}`;
  return null;
}

const bookingsCalendar = () => Deno.env.get("GOOGLE_BOOKINGS_CALENDAR_ID")?.trim() || null;

// Allinea l'evento in Google allo stato della prenotazione: crea, aggiorna o
// cancella. Non blocca mai l'operazione principale: in caso di errore lo
// registra e la prenotazione resta valida nel database.
export async function syncCalendarEvent(supabase: SupabaseClient, b: BookingRow): Promise<void> {
  const sa = serviceAccount();
  const calendarId = bookingsCalendar();
  if (!sa || !calendarId) return;
  const summary = eventSummary(b);
  try {
    if (summary) {
      const eventId = await upsertEvent(sa, calendarId, b.calendar_event_id, {
        summary,
        start: b.starts_at,
        end: b.ends_at,
      });
      if (eventId !== b.calendar_event_id) {
        await supabase.from("bookings").update({ calendar_event_id: eventId }).eq("id", b.id);
      }
    } else if (b.calendar_event_id) {
      await deleteEvent(sa, calendarId, b.calendar_event_id);
      await supabase.from("bookings").update({ calendar_event_id: null }).eq("id", b.id);
    }
  } catch (error) {
    console.error(JSON.stringify({ event: "calendar_sync_failed", reason: String((error as Error).message) }));
  }
}

// Segna come scadute le prenotazioni non confermate o non pagate in tempo e
// toglie i loro eventi dal calendario.
export async function expireBookings(supabase: SupabaseClient): Promise<number> {
  const { data, error } = await supabase.rpc("expire_bookings");
  if (error) {
    console.error(JSON.stringify({ event: "expire_failed" }));
    return 0;
  }
  const rows = (data ?? []) as { id: string; calendar_event_id: string | null }[];
  const sa = serviceAccount();
  const calendarId = bookingsCalendar();
  for (const r of rows) {
    if (!r.calendar_event_id || !sa || !calendarId) continue;
    try {
      await deleteEvent(sa, calendarId, r.calendar_event_id);
      await supabase.from("bookings").update({ calendar_event_id: null }).eq("id", r.id);
    } catch (error) {
      console.error(JSON.stringify({ event: "calendar_delete_failed", reason: String((error as Error).message) }));
    }
  }
  return rows.length;
}
