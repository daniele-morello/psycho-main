import type { SupabaseClient } from "@supabase/supabase-js";
import { ALL_HOLIDAY_CODES } from "../../supabase/functions/_shared/holidays";

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
  confirm_window_hours: number;
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

export type PaymentSettings = {
  online_price_cents: number | null;
  payment_window_hours: number;
  payment_cutoff_hours: number;
  refund_notice_hours: number;
  cancellation_note: string | null;
  video_platform: string | null;
  video_instructions: string | null;
  bank_holder: string | null;
  bank_iban: string | null; // senza spazi, maiuscolo
};

const PAYMENT_COLUMNS =
  "online_price_cents,payment_window_hours,payment_cutoff_hours,refund_notice_hours,cancellation_note,video_platform,video_instructions,bank_holder,bank_iban";

export type BookingStatus =
  | "pending"
  | "proposed"
  | "declined"
  | "confirmed"
  | "awaiting_payment"
  | "paid"
  | "cancelled"
  | "expired";

export type Booking = {
  id: string;
  ref: string;
  created_at: string;
  starts_at: string;
  ends_at: string;
  mode: "online" | "in_presenza";
  status: BookingStatus;
  name: string;
  surname: string;
  email: string;
  phone: string | null;
  confirm_deadline: string | null;
  payment_deadline: string | null;
  price_cents: number | null;
  pay_token: string | null;
  link_sent_at: string | null;
  paid_at: string | null;
  // Sedute successive: id della prima prenotazione (da cui vengono nome e
  // contatti) e serie di appartenenza. null per la prima prenotazione.
  first_booking_id: string | null;
  series_id: string | null;
  payment_waived: boolean; // seduta online gratuita (casi straordinari)
};

export type BookingAction =
  | "confirm"
  | "mark_paid"
  | "waive_payment"
  | "decline"
  | "cancel"
  | "cancel_series"
  | "link_sent"
  | "delete";

// Le sedute proposte compaiono tra le cose da confermare quando mancano al
// massimo questi giorni.
export const PROPOSED_NOTICE_DAYS = 7;

export const isProposedDue = (b: Booking, now = Date.now()) =>
  b.status === "proposed" && Date.parse(b.starts_at) - now <= PROPOSED_NOTICE_DAYS * 86_400_000;

// Cose da fare dell'area riservata (contatore e barra "Da fare").
export function bookingTodo(list: Booking[], now = Date.now()) {
  return {
    pending: list.filter((b) => b.status === "pending").length,
    proposedDue: list.filter((b) => isProposedDue(b, now)).length,
    awaiting: list.filter((b) => b.status === "awaiting_payment").length,
    linkMissing: list.filter((b) => b.status === "awaiting_payment" && !b.link_sent_at).length,
  };
}

export type CalendarInterval = { start: string; end: string };
export type CalendarData = {
  google: "ok" | "not_configured" | "error";
  busy: CalendarInterval[]; // impegni Google: solo occupato, nessun titolo
  settings: {
    session_minutes: number;
    buffer_minutes: number;
    timezone: string;
    closed_holidays: string[];
    patron_day: string | null;
  };
  hours: { weekday: number; start: string; end: string }[];
  blocks: (CalendarInterval & { label: string | null })[];
  bookings: (CalendarInterval & { id: string; ref: string; status: BookingStatus; mode: Booking["mode"] })[];
};

const BOOKING_COLUMNS =
  "id,ref,created_at,starts_at,ends_at,mode,status,name,surname,email,phone,confirm_deadline,payment_deadline,price_cents,pay_token,link_sent_at,paid_at,first_booking_id,series_id,payment_waived," +
  "first:bookings!bookings_first_booking_id_fkey(name,surname,email,phone)";

type BookingRowWithFirst = Booking & {
  first: Pick<Booking, "name" | "surname" | "email" | "phone"> | null;
};

// Le sedute successive non hanno dati propri: li prendono dalla prima prenotazione.
const withPatient = ({ first, ...b }: BookingRowWithFirst): Booking =>
  first ? { ...b, name: first.name, surname: first.surname, email: first.email, phone: first.phone } : b;

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
  getPayment(): Promise<PaymentSettings>;
  savePayment(p: PaymentSettings): Promise<void>;
  listBookings(): Promise<Booking[]>;
  manageBooking(action: BookingAction, id: string): Promise<{ code?: string }>;
  calendar(from: string, to: string): Promise<CalendarData>;
  schedule(id: string, mode: Booking["mode"], starts: string[]): Promise<{ code?: string }>;
  move(id: string, start: string): Promise<{ code?: string }>;
};

async function invokeManage(client: SupabaseClient, body: Record<string, unknown>): Promise<{ code?: string; data?: unknown }> {
  const { data, error } = await client.functions.invoke("manage-booking", { body });
  if (error) {
    // Il codice dell'errore (per esempio "payment_not_configured") arriva nel corpo.
    const context = (error as { context?: Response }).context;
    const res = context ? await context.json().catch(() => null) : null;
    return { code: (res as { code?: string } | null)?.code ?? "error" };
  }
  return { data };
}

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
          .select("session_minutes,buffer_minutes,min_notice_hours,max_days_ahead,closed_holidays,patron_day,confirm_window_hours")
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
      const { error: confirmError } = await client
        .from("booking_settings")
        .update({ confirm_window_hours: s.confirm_window_hours })
        .eq("id", true);
      if (confirmError) throw confirmError;
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
    async getPayment() {
      const { data, error } = await client.from("booking_settings").select(PAYMENT_COLUMNS).single();
      if (error) throw error;
      return data as PaymentSettings;
    },
    async savePayment(p) {
      const { error } = await client.from("booking_settings").update(p).eq("id", true);
      if (error) throw error;
    },
    async listBookings() {
      const { data, error } = await client
        .from("bookings")
        .select(BOOKING_COLUMNS)
        .order("starts_at", { ascending: true })
        .limit(500);
      if (error) throw error;
      return ((data ?? []) as unknown as BookingRowWithFirst[]).map(withPatient);
    },
    async manageBooking(action, id) {
      const { code } = await invokeManage(client, { action, id });
      return { code };
    },
    async calendar(from, to) {
      const { code, data } = await invokeManage(client, { action: "calendar", from, to });
      if (code) throw new Error(code);
      return data as CalendarData;
    },
    async schedule(id, mode, starts) {
      const { code } = await invokeManage(client, { action: "schedule", id, mode, starts });
      return { code };
    },
    async move(id, start) {
      const { code } = await invokeManage(client, { action: "move", id, start });
      return { code };
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
    confirm_window_hours: 48,
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
  let payment: PaymentSettings = {
    online_price_cents: 7000,
    payment_window_hours: 48,
    payment_cutoff_hours: 24,
    refund_notice_hours: 48,
    cancellation_note: null,
    video_platform: "Esempio Video",
    video_instructions: "Riceverai il link della videochiamata via email il giorno prima della seduta.",
    bank_holder: "Esempio Intestatario",
    bank_iban: "IT60X0542811101000000123456", // IBAN di esempio usato nella documentazione bancaria
  };
  const at = (days: number, hour: number) => {
    const d = new Date(now + days * day);
    d.setHours(hour, 0, 0, 0);
    return d.toISOString();
  };
  const demoBooking = (b: Partial<Booking> & Pick<Booking, "id" | "ref" | "status" | "mode" | "name" | "surname" | "starts_at">): Booking => ({
    created_at: new Date(now - 3_600_000).toISOString(),
    ends_at: new Date(Date.parse(b.starts_at) + 50 * 60_000).toISOString(),
    email: `${b.name.toLowerCase()}.${b.surname.toLowerCase()}@example.com`,
    phone: null,
    confirm_deadline: new Date(now + 40 * 3_600_000).toISOString(),
    payment_deadline: null,
    price_cents: null,
    pay_token: null,
    link_sent_at: null,
    paid_at: null,
    first_booking_id: null,
    series_id: null,
    payment_waived: false,
    ...b,
  });
  const ACTIVE: BookingStatus[] = ["pending", "proposed", "awaiting_payment", "confirmed", "paid"];
  const overlaps = (start: number, end: number, skipId?: string) =>
    bookings.some(
      (x) => x.id !== skipId && ACTIVE.includes(x.status) && Date.parse(x.starts_at) < end && start < Date.parse(x.ends_at),
    );
  let bookings: Booking[] = [
    demoBooking({ id: "b1", ref: "A7K2C9", status: "pending", mode: "in_presenza", name: "Esempio", surname: "Quattro", starts_at: at(3, 10) }),
    demoBooking({ id: "b2", ref: "F31B07", status: "pending", mode: "online", name: "Esempio", surname: "Cinque", starts_at: at(4, 16) }),
    demoBooking({
      id: "b3", ref: "9D04EE", status: "awaiting_payment", mode: "online", name: "Esempio", surname: "Sei", starts_at: at(6, 11),
      payment_deadline: new Date(now + 30 * 3_600_000).toISOString(), price_cents: 7000,
    }),
    demoBooking({ id: "b4", ref: "C2A851", status: "confirmed", mode: "in_presenza", name: "Esempio", surname: "Sette", starts_at: at(1, 9) }),
    demoBooking({
      id: "b5", ref: "E81F3A", status: "proposed", mode: "in_presenza", name: "Esempio", surname: "Sette", starts_at: at(5, 9),
      confirm_deadline: null, first_booking_id: "b4", series_id: "s1",
    }),
    demoBooking({
      id: "b6", ref: "07BD52", status: "proposed", mode: "in_presenza", name: "Esempio", surname: "Sette", starts_at: at(12, 9),
      confirm_deadline: null, first_booking_id: "b4", series_id: "s1",
    }),
  ];
  return {
    async listBookings() {
      return bookings.map((b) => ({ ...b }));
    },
    async calendar(from, to) {
      const f = Date.parse(from);
      const t = Date.parse(to);
      const busy: CalendarInterval[] = [];
      // Impegni finti nel calendario Google: martedì 15-17, giovedì 9-10:30.
      for (let d = new Date(f); d.getTime() < t; d = new Date(d.getTime() + day)) {
        const wd = d.getDay();
        const slot = (h1: number, m1: number, h2: number, m2: number) =>
          busy.push({
            start: new Date(new Date(d).setHours(h1, m1, 0, 0)).toISOString(),
            end: new Date(new Date(d).setHours(h2, m2, 0, 0)).toISOString(),
          });
        if (wd === 2) slot(15, 0, 17, 0);
        if (wd === 4) slot(9, 0, 10, 30);
      }
      return {
        google: "ok",
        busy,
        settings: {
          session_minutes: settings.session_minutes,
          buffer_minutes: settings.buffer_minutes,
          timezone: "Europe/Rome",
          closed_holidays: settings.closed_holidays,
          patron_day: settings.patron_day,
        },
        hours: settings.hours.map((h) => ({ weekday: h.weekday, start: h.start_time, end: h.end_time })),
        blocks: blocks
          .filter((b) => Date.parse(b.starts_at) < t && Date.parse(b.ends_at) > f)
          .map((b) => ({ start: b.starts_at, end: b.ends_at, label: b.label })),
        bookings: bookings
          .filter((b) => ACTIVE.includes(b.status) && Date.parse(b.starts_at) < t && Date.parse(b.ends_at) > f)
          .map((b) => ({ id: b.id, ref: b.ref, start: b.starts_at, end: b.ends_at, status: b.status, mode: b.mode })),
      };
    },
    async schedule(id, mode, starts) {
      const b = bookings.find((x) => x.id === id);
      if (!b) return { code: "not_found" };
      const root = bookings.find((x) => x.id === (b.first_booking_id ?? b.id)) ?? b;
      const length = settings.session_minutes * 60_000;
      if (starts.some((s) => overlaps(Date.parse(s), Date.parse(s) + length))) return { code: "slot_taken" };
      const series = starts.length > 1 ? crypto.randomUUID() : null;
      bookings = [
        ...bookings,
        ...starts.map((s) =>
          demoBooking({
            id: crypto.randomUUID(),
            ref: Math.random().toString(16).slice(2, 8).toUpperCase(),
            status: "proposed",
            mode,
            name: root.name,
            surname: root.surname,
            email: root.email,
            starts_at: s,
            ends_at: new Date(Date.parse(s) + length).toISOString(),
            confirm_deadline: null,
            first_booking_id: root.id,
            series_id: series,
          }),
        ),
      ];
      return {};
    },
    async move(id, start) {
      const b = bookings.find((x) => x.id === id);
      if (!b || !ACTIVE.includes(b.status)) return { code: "wrong_status" };
      const length = Date.parse(b.ends_at) - Date.parse(b.starts_at);
      const s = Date.parse(start);
      if (overlaps(s, s + length, id)) return { code: "slot_taken" };
      bookings = bookings.map((x) =>
        x.id === id ? { ...x, starts_at: new Date(s).toISOString(), ends_at: new Date(s + length).toISOString() } : x,
      );
      return {};
    },
    async manageBooking(action, id) {
      const b = bookings.find((x) => x.id === id);
      if (!b) return { code: "not_found" };
      if (action === "delete") {
        bookings = bookings.filter((x) => x.id !== id && x.first_booking_id !== id);
        return {};
      }
      if (action === "cancel_series") {
        bookings = bookings.map((x) =>
          x.series_id && x.series_id === b.series_id && x.status === "proposed" && x.starts_at >= b.starts_at
            ? { ...x, status: "cancelled" }
            : x,
        );
        return {};
      }
      const patch: Partial<Booking> =
        action === "waive_payment"
          ? { status: "confirmed", payment_waived: true, pay_token: null, payment_deadline: null, price_cents: null }
        : action === "mark_paid"
          ? b.status === "awaiting_payment" ? { status: "paid", paid_at: new Date().toISOString() } : {}
        : action === "decline" ? { status: "declined" }
        : action === "cancel" ? { status: "cancelled" }
        : action === "link_sent" ? { link_sent_at: new Date().toISOString() }
        : b.mode === "in_presenza" ? { status: "confirmed" }
        : {
          status: "awaiting_payment",
          price_cents: payment.online_price_cents,
          payment_deadline: new Date(Date.now() + payment.payment_window_hours * 3_600_000).toISOString(),
        };
      bookings = bookings.map((x) => (x.id === id ? { ...x, ...patch } : x));
      return {};
    },
    async getPayment() {
      return { ...payment };
    },
    async savePayment(p) {
      payment = { ...p };
    },
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
