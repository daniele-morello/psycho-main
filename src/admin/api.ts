import type { SupabaseClient } from "@supabase/supabase-js";
import { ALL_HOLIDAY_CODES } from "../../supabase/functions/availability/holidays";

export type RequestStatus = "new" | "contacted" | "closed";

export type ContactRequest = {
  id: string;
  created_at: string;
  name: string;
  surname: string | null;
  email: string;
  phone: string | null;
  service: string | null;
  consultation_mode: string | null;
  preferred_time: string | null;
  message: string;
  status: RequestStatus;
  status_changed_at: string | null;
};

export type WorkingInterval = {
  weekday: number; // 1 = lunedì ... 7 = domenica
  start_time: string; // "HH:MM"
  end_time: string;
};

export type BookingSettings = {
  session_minutes: number;
  buffer_minutes: number;
  min_notice_hours: number;
  max_days_ahead: number;
  hours: WorkingInterval[];
  closed_holidays: string[];
  patron_day: string | null; // "MM-DD"
};

export type BlockedPeriod = {
  id: string;
  starts_at: string; // ISO, con fuso
  ends_at: string;
  all_day: boolean;
  label: string | null;
};

// Ora locale italiana "YYYY-MM-DDTHH:MM", convertita dal database.
export type NewBlock = {
  start_local: string;
  end_local: string;
  all_day: boolean;
  label: string;
};

export type AvailabilityPreview = {
  slots: string[]; // ISO
  calendar: "ok" | "not_configured" | "error";
};

export type RequestsApi = {
  list(): Promise<ContactRequest[]>;
  setStatus(id: string, status: RequestStatus): Promise<void>;
  remove(id: string): Promise<void>;
  countExpired(): Promise<number>;
  deleteExpired(): Promise<number>;
  getSettings(): Promise<BookingSettings>;
  saveSettings(settings: BookingSettings): Promise<void>;
  listBlocks(): Promise<BlockedPeriod[]>;
  addBlock(block: NewBlock): Promise<void>;
  removeBlock(id: string): Promise<void>;
  previewAvailability(): Promise<AvailabilityPreview>;
};

const hhmm = (t: string) => t.slice(0, 5);

const COLUMNS =
  "id,created_at,name,surname,email,phone,service,consultation_mode,preferred_time,message,status,status_changed_at";

export function supabaseApi(client: SupabaseClient): RequestsApi {
  return {
    async list() {
      const { data, error } = await client
        .from("contact_requests")
        .select(COLUMNS)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as ContactRequest[];
    },
    async setStatus(id, status) {
      const { error } = await client.from("contact_requests").update({ status }).eq("id", id);
      if (error) throw error;
    },
    async remove(id) {
      const { error } = await client.from("contact_requests").delete().eq("id", id);
      if (error) throw error;
    },
    async countExpired() {
      const { data, error } = await client.rpc("count_expired_contact_requests");
      if (error) throw error;
      return Number(data ?? 0);
    },
    async deleteExpired() {
      const { data, error } = await client.rpc("delete_expired_contact_requests");
      if (error) throw error;
      return Number(data ?? 0);
    },
    async getSettings() {
      const [settings, hours] = await Promise.all([
        client
          .from("booking_settings")
          .select("session_minutes,buffer_minutes,min_notice_hours,max_days_ahead,closed_holidays,patron_day")
          .single(),
        client
          .from("working_hours")
          .select("weekday,start_time,end_time")
          .order("weekday")
          .order("start_time"),
      ]);
      if (settings.error) throw settings.error;
      if (hours.error) throw hours.error;
      return {
        ...(settings.data as Omit<BookingSettings, "hours">),
        hours: (hours.data ?? []).map((h) => ({
          weekday: h.weekday as number,
          start_time: hhmm(h.start_time as string),
          end_time: hhmm(h.end_time as string),
        })),
      };
    },
    async saveSettings(s) {
      const { error } = await client.rpc("save_booking_settings", {
        p_session_minutes: s.session_minutes,
        p_buffer_minutes: s.buffer_minutes,
        p_min_notice_hours: s.min_notice_hours,
        p_max_days_ahead: s.max_days_ahead,
        p_hours: s.hours,
        p_closed_holidays: s.closed_holidays,
        p_patron_day: s.patron_day,
      });
      if (error) throw error;
    },
    async listBlocks() {
      const { data, error } = await client
        .from("blocked_periods")
        .select("id,starts_at,ends_at,all_day,label")
        .gt("ends_at", new Date().toISOString())
        .order("starts_at");
      if (error) throw error;
      return (data ?? []) as BlockedPeriod[];
    },
    async addBlock(b) {
      const { error } = await client.rpc("add_blocked_period", {
        p_start_local: b.start_local,
        p_end_local: b.end_local,
        p_all_day: b.all_day,
        p_label: b.label,
      });
      if (error) throw error;
    },
    async removeBlock(id) {
      const { error } = await client.from("blocked_periods").delete().eq("id", id);
      if (error) throw error;
    },
    async previewAvailability() {
      const { data, error } = await client.functions.invoke("availability", { method: "GET" });
      if (error) throw error;
      return data as AvailabilityPreview;
    },
  };
}

// Solo in sviluppo (npm run dev, admin.html?demo): dati inventati per vedere
// l'interfaccia senza account e senza toccare il database. Non finisce nel build.
export function demoApi(): RequestsApi {
  const day = 86_400_000;
  const now = Date.now();
  let rows: ContactRequest[] = [
    {
      id: "demo-1",
      created_at: new Date(now - 2 * 3_600_000).toISOString(),
      name: "Esempio",
      surname: "Uno",
      email: "esempio.uno@example.com",
      phone: "+390000000000",
      service: "Psicoterapia individuale",
      consultation_mode: "Online",
      preferred_time: "Martedì pomeriggio",
      message: "Vorrei sapere se ci sono disponibilità il martedì dopo le 17.",
      status: "new",
      status_changed_at: null,
    },
    {
      id: "demo-2",
      created_at: new Date(now - 3 * day).toISOString(),
      name: "Esempio",
      surname: "Due",
      email: "esempio.due@example.com",
      phone: null,
      service: "Terapia di coppia",
      consultation_mode: "In presenza",
      preferred_time: null,
      message: "",
      status: "contacted",
      status_changed_at: new Date(now - 2 * day).toISOString(),
    },
    {
      id: "demo-3",
      created_at: new Date(now - 220 * day).toISOString(),
      name: "Esempio",
      surname: "Tre",
      email: "esempio.tre@example.com",
      phone: null,
      service: "Altro",
      consultation_mode: "Online",
      preferred_time: "Mattina",
      message: "Domanda sui costi.",
      status: "closed",
      status_changed_at: new Date(now - 200 * day).toISOString(),
    },
  ];
  const expired = (r: ContactRequest) =>
    (r.status === "closed" &&
      new Date(r.status_changed_at ?? r.created_at).getTime() < now - 182 * day) ||
    new Date(r.created_at).getTime() < now - 365 * day;
  let settings: BookingSettings = {
    session_minutes: 50,
    buffer_minutes: 10,
    min_notice_hours: 24,
    max_days_ahead: 60,
    hours: [1, 2, 3, 4, 5].flatMap((weekday) => [
      { weekday, start_time: "09:00", end_time: "13:00" },
      { weekday, start_time: "15:00", end_time: "19:00" },
    ]),
    closed_holidays: [...ALL_HOLIDAY_CODES],
    patron_day: null,
  };
  // In demo l'ora locale è trattata come ora del browser: basta per l'anteprima.
  let blocks: BlockedPeriod[] = [
    {
      id: "block-1",
      starts_at: new Date(new Date(now + 10 * day).setHours(0, 0, 0, 0)).toISOString(),
      ends_at: new Date(new Date(now + 17 * day).setHours(0, 0, 0, 0)).toISOString(),
      all_day: true,
      label: "Ferie",
    },
  ];
  return {
    async previewAvailability() {
      const slots: string[] = [];
      for (let i = 2; i <= 9; i++) {
        const d = new Date(now + i * day);
        if (d.getDay() === 0 || d.getDay() === 6) continue;
        for (const h of [9, 10, 11, 15, 16, 17]) {
          if (i === 3 && h === 10) continue; // esempio: occupato nel calendario
          slots.push(new Date(new Date(d).setHours(h, 0, 0, 0)).toISOString());
        }
      }
      return { slots, calendar: "ok" };
    },
    async listBlocks() {
      return blocks
        .filter((b) => new Date(b.ends_at).getTime() > Date.now())
        .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
        .map((b) => ({ ...b }));
    },
    async addBlock(b) {
      blocks = [
        ...blocks,
        {
          id: `block-${Math.random().toString(36).slice(2)}`,
          starts_at: new Date(b.start_local).toISOString(),
          ends_at: new Date(b.end_local).toISOString(),
          all_day: b.all_day,
          label: b.label.trim() || null,
        },
      ];
    },
    async removeBlock(id) {
      blocks = blocks.filter((b) => b.id !== id);
    },
    async getSettings() {
      return {
        ...settings,
        hours: settings.hours.map((h) => ({ ...h })),
        closed_holidays: [...settings.closed_holidays],
      };
    },
    async saveSettings(s) {
      settings = { ...s, hours: s.hours.map((h) => ({ ...h })), closed_holidays: [...s.closed_holidays] };
    },
    async list() {
      return rows.map((r) => ({ ...r }));
    },
    async setStatus(id, status) {
      rows = rows.map((r) =>
        r.id === id ? { ...r, status, status_changed_at: new Date().toISOString() } : r,
      );
    },
    async remove(id) {
      rows = rows.filter((r) => r.id !== id);
    },
    async countExpired() {
      return rows.filter(expired).length;
    },
    async deleteExpired() {
      const before = rows.length;
      rows = rows.filter((r) => !expired(r));
      return before - rows.length;
    },
  };
}
