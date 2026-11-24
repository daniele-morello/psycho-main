import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, X } from "lucide-react";
import type { Booking, CalendarData, RequestsApi } from "@/admin/api";
import { computeSlots, zonedToUtc } from "../../supabase/functions/_shared/slots";
import { closedHoliday } from "../../supabase/functions/_shared/holidays";

// Calendario per fissare (o spostare) le sedute successive.
//
// Mostra la settimana con: fasce libere negli orari di lavoro (cliccabili),
// impegni del Google Calendar (solo "Occupato", senza titolo), periodi bloccati e
// prenotazioni (solo codice). Giorno e ora si possono anche scrivere a mano.

const TZ = "Europe/Rome";
const DAY = 86_400_000;
const ROW = 22; // altezza di mezz'ora, in pixel
const WEEKDAYS = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

type YMD = { y: number; m: number; d: number };

const partsFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
function rome(ms: number) {
  const p = Object.fromEntries(partsFmt.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return { y: +p.year, m: +p.month, d: +p.day, minutes: +p.hour * 60 + +p.minute };
}
const addDays = ({ y, m, d }: YMD, n: number): YMD => {
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
};
const weekdayOf = ({ y, m, d }: YMD) => ((new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7) + 1;
const mondayOf = (day: YMD) => addDays(day, 1 - weekdayOf(day));
const pad = (n: number) => String(n).padStart(2, "0");
const ymdText = ({ y, m, d }: YMD) => `${y}-${pad(m)}-${pad(d)}`;
const parseYmd = (s: string): YMD | null => {
  const r = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  return r ? { y: +r[1], m: +r[2], d: +r[3] } : null;
};
const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
const hhmm = (min: number) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
const dayStart = (day: YMD) => zonedToUtc(day.y, day.m, day.d, 0, TZ);

const longFmt = new Intl.DateTimeFormat("it-IT", {
  timeZone: TZ,
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
const monthFmt = new Intl.DateTimeFormat("it-IT", { timeZone: TZ, month: "long", year: "numeric" });

type Cadence = 0 | 1 | 2 | 4; // settimane tra una seduta e l'altra (0 = solo una)

type Occurrence = {
  start: number;
  blocking: string | null; // motivo per cui non si può fissare
  warnings: string[];
};

function check(start: number, minutes: number, data: CalendarData | null, skipId?: string): Occurrence {
  const end = start + minutes * 60_000;
  const warnings: string[] = [];
  let blocking: string | null = null;
  if (start <= Date.now()) blocking = "data già passata";
  if (data) {
    const hit = (a: { start: string; end: string }) => Date.parse(a.start) < end && start < Date.parse(a.end);
    const booked = data.bookings.find((b) => b.id !== skipId && hit(b));
    if (booked) blocking = `c'è già la prenotazione rif. ${booked.ref}`;
    if (data.busy.some(hit)) warnings.push("impegno nel tuo calendario");
    const block = data.blocks.find(hit);
    if (block) warnings.push(`periodo bloccato${block.label ? ` (${block.label})` : ""}`);
    const r = rome(start);
    const holiday = closedHoliday(r.y, r.m, r.d, data.settings.closed_holidays ?? [], data.settings.patron_day);
    if (holiday) warnings.push(`festivo: ${holiday}`);
    const wd = weekdayOf(r);
    const inHours = data.hours.some(
      (h) => h.weekday === wd && toMin(h.start) <= r.minutes && r.minutes + minutes <= toMin(h.end),
    );
    if (!inHours && !holiday) warnings.push("fuori dagli orari di lavoro");
  }
  return { start, blocking, warnings };
}

export default function Scheduler({
  api,
  booking,
  moving,
  suggestFrom,
  onDone,
  onClose,
}: {
  api: RequestsApi;
  booking: Booking; // una prenotazione del paziente
  moving?: Booking; // se presente: si sposta questa seduta proposta
  suggestFrom: string; // ISO: si propone la stessa ora una settimana dopo
  onDone: (message: string) => void;
  onClose: () => void;
}) {
  const initial = useMemo(() => {
    const base = moving ? Date.parse(moving.starts_at) : Date.parse(suggestFrom) + 7 * DAY;
    const r = rome(base);
    return { day: { y: r.y, m: r.m, d: r.d }, time: hhmm(r.minutes) };
  }, [moving, suggestFrom]);

  const [week, setWeek] = useState<YMD>(() => mondayOf(initial.day));
  const [weekData, setWeekData] = useState<CalendarData | null>(null);
  const [weekError, setWeekError] = useState("");
  const [date, setDate] = useState(ymdText(initial.day));
  const [time, setTime] = useState(initial.time);
  const [mode, setMode] = useState<Booking["mode"]>(moving?.mode ?? booking.mode);
  const [cadence, setCadence] = useState<Cadence>(0);
  const [count, setCount] = useState(6);
  const [seriesData, setSeriesData] = useState<CalendarData | null>(null);
  const [excluded, setExcluded] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Settimana visibile.
  useEffect(() => {
    let alive = true;
    setWeekData(null);
    setWeekError("");
    const from = dayStart(week);
    const to = dayStart(addDays(week, 7));
    api
      .calendar(new Date(from).toISOString(), new Date(to).toISOString())
      .then((d) => alive && setWeekData(d))
      .catch(() => alive && setWeekError("Non riesco a leggere il calendario. Riprova tra poco."));
    return () => {
      alive = false;
    };
  }, [api, week]);

  const minutes = weekData?.settings.session_minutes ?? seriesData?.settings.session_minutes ?? 50;

  // Date della seduta o della serie.
  const starts = useMemo(() => {
    const day = parseYmd(date);
    if (!day || !/^\d{2}:\d{2}$/.test(time)) return [];
    const n = cadence === 0 || moving ? 1 : Math.min(26, Math.max(2, count));
    return Array.from({ length: n }, (_, k) => {
      const dd = addDays(day, k * 7 * (cadence || 1));
      return zonedToUtc(dd.y, dd.m, dd.d, toMin(time), TZ);
    });
  }, [date, time, cadence, count, moving]);

  // Occupazione su tutto il periodo della serie, per segnalare i conflitti.
  const seriesKey = starts.length ? `${starts[0]}-${starts[starts.length - 1]}` : "";
  useEffect(() => {
    if (!starts.length) return;
    let alive = true;
    const from = starts[0] - DAY;
    const to = starts[starts.length - 1] + DAY;
    const timer = setTimeout(() => {
      api
        .calendar(new Date(from).toISOString(), new Date(to).toISOString())
        .then((d) => alive && setSeriesData(d))
        .catch(() => alive && setSeriesData(null));
    }, 250);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, seriesKey]);

  const occurrences = starts.map((s) => check(s, minutes, seriesData, moving?.id));
  // Di base si escludono le date con un conflitto; si possono riattivare.
  useEffect(() => {
    setExcluded(new Set(occurrences.filter((o) => o.blocking || o.warnings.some((w) => !w.startsWith("fuori"))).map((o) => o.start)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seriesKey, seriesData, cadence]);

  const chosen = occurrences.filter((o) => !o.blocking && !excluded.has(o.start));

  const save = async () => {
    setSaving(true);
    setError("");
    const iso = chosen.map((o) => new Date(o.start).toISOString());
    const result = moving ? await api.move(moving.id, iso[0]) : await api.schedule(booking.id, mode, iso);
    setSaving(false);
    if (result.code) {
      setError(
        result.code === "slot_taken"
          ? "Uno degli orari è stato occupato nel frattempo. Controlla il calendario e riprova."
          : result.code === "wrong_status"
            ? "La prenotazione è cambiata nel frattempo: chiudi e riapri."
            : result.code === "too_late_to_pay"
              ? "Con il nuovo orario non resta tempo per il pagamento: scegli un giorno più avanti oppure conferma la seduta come gratuita."
              : "Non è stato possibile salvare. Riprova.",
      );
      return;
    }
    onDone(
      moving
        ? moving.status === "proposed"
          ? "Seduta spostata. Resta da confermare."
          : moving.status === "pending"
            ? "Richiesta spostata al nuovo orario. Resta da confermare: avvisa la persona del cambio."
            : "Appuntamento spostato. Avvisa la persona del nuovo orario con «Scrivi il nuovo orario»."
        : chosen.length === 1
          ? "Seduta proposta. La troverai tra le cose da confermare una settimana prima."
          : `${chosen.length} sedute proposte. Ognuna comparirà tra le cose da confermare una settimana prima.`,
    );
  };

  const button = "px-3 py-1.5 rounded-full text-sm border disabled:opacity-60";
  const primary = button + " bg-sage-700 border-sage-700 text-white hover:bg-sage-800";
  const secondary = button + " bg-white border-stone-300 hover:border-sage-400";
  const chip = (active: boolean) =>
    "px-3 py-1.5 rounded-full text-sm border " +
    (active ? "bg-sage-700 border-sage-700 text-white" : "bg-white border-stone-300 hover:border-sage-400");

  return (
    <div className="mt-3 rounded-xl border border-sage-200 bg-sage-50/40 p-4 space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-medium">{moving ? "Sposta l'appuntamento" : "Fissa il prossimo appuntamento"}</h3>
          <p className="text-xs text-stone-600">
            {booking.name} {booking.surname} · Scegli una fascia libera nel calendario oppure scrivi giorno e ora a mano.
          </p>
        </div>
        <button onClick={onClose} className="p-1 text-stone-500 hover:text-stone-800" aria-label="Chiudi">
          <X className="w-4 h-4" />
        </button>
      </div>

      <WeekGrid
        week={week}
        data={weekData}
        error={weekError}
        selected={starts}
        movingId={moving?.id}
        onPrev={() => setWeek((w) => addDays(w, -7))}
        onNext={() => setWeek((w) => addDays(w, 7))}
        onPick={(ms) => {
          const r = rome(ms);
          setDate(ymdText(r));
          setTime(hhmm(r.minutes));
        }}
      />

      <div className="grid sm:grid-cols-2 gap-3">
        <label className="text-sm">
          <span className="block text-stone-600 mb-1">Giorno</span>
          <input
            type="date"
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              const d = parseYmd(e.target.value);
              if (d) setWeek(mondayOf(d));
            }}
            className="w-full rounded-lg border border-stone-300 px-3 py-2 bg-white"
          />
        </label>
        <label className="text-sm">
          <span className="block text-stone-600 mb-1">Ora di inizio</span>
          <input
            type="time"
            step={300}
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="w-full rounded-lg border border-stone-300 px-3 py-2 bg-white"
          />
        </label>
      </div>

      {!moving && (
        <>
          <div>
            <p className="text-sm text-stone-600 mb-1">Modalità</p>
            <div className="flex flex-wrap gap-2">
              <button className={chip(mode === "in_presenza")} onClick={() => setMode("in_presenza")}>
                In presenza
              </button>
              <button className={chip(mode === "online")} onClick={() => setMode("online")}>
                Online
              </button>
            </div>
            {mode === "online" && (
              <p className="text-xs text-stone-500 mt-1">
                Alla conferma di ogni seduta online partirà la richiesta di pagamento, come per il primo colloquio.
              </p>
            )}
          </div>

          <div>
            <p className="text-sm text-stone-600 mb-1">Ripeti</p>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  [0, "Solo questa volta"],
                  [1, "Ogni settimana"],
                  [2, "Ogni 2 settimane"],
                  [4, "Ogni 4 settimane"],
                ] as [Cadence, string][]
              ).map(([value, label]) => (
                <button key={value} className={chip(cadence === value)} onClick={() => setCadence(value)}>
                  {label}
                </button>
              ))}
            </div>
            {cadence !== 0 && (
              <label className="mt-2 flex items-center gap-2 text-sm">
                Numero di sedute
                <input
                  type="number"
                  min={2}
                  max={26}
                  value={count}
                  onChange={(e) => setCount(Number(e.target.value) || 2)}
                  className="w-20 rounded-lg border border-stone-300 px-2 py-1 bg-white"
                />
                <span className="text-xs text-stone-500">(massimo 26)</span>
              </label>
            )}
          </div>
        </>
      )}

      {occurrences.length > 0 && (
        <div>
          <p className="text-sm text-stone-600 mb-1">
            {occurrences.length === 1 ? "Seduta" : "Sedute"} da {moving ? "spostare" : "proporre"}
          </p>
          <ul className="space-y-1">
            {occurrences.map((o) => {
              const off = !!o.blocking || excluded.has(o.start);
              return (
                <li key={o.start} className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={!off}
                    disabled={!!o.blocking || occurrences.length === 1}
                    onChange={() =>
                      setExcluded((prev) => {
                        const next = new Set(prev);
                        if (next.has(o.start)) next.delete(o.start);
                        else next.add(o.start);
                        return next;
                      })
                    }
                    aria-label="Includi questa data"
                  />
                  <span className={off ? "text-stone-400 line-through" : ""}>
                    <span className="first-letter:uppercase inline-block">{longFmt.format(new Date(o.start))}</span>
                  </span>
                  {(o.blocking || o.warnings.length > 0) && (
                    <span className={"text-xs mt-0.5 " + (o.blocking ? "text-red-700" : "text-clay-800")}>
                      {[o.blocking, ...o.warnings].filter(Boolean).join(" · ")}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
          {!seriesData && <p className="text-xs text-stone-500 mt-1">Controllo il calendario…</p>}
        </div>
      )}

      {moving ? (
        moving.status !== "proposed" && (
          <p className="text-xs text-stone-600">
            L'appuntamento mantiene il suo stato{moving.status === "awaiting_payment" ? " e la scadenza del pagamento si adatta al nuovo orario" : ""}.
            Il vecchio orario torna libero. Dopo lo spostamento ti preparo l'email per avvisare la persona.
          </p>
        )
      ) : (
        <p className="text-xs text-stone-600">
          Le sedute restano <strong>da confermare</strong>: tengono occupato l'orario (nessuno può prenotarlo dal sito) e una
          settimana prima compaiono tra le cose da fare, dove le confermi, le sposti o le salti.
        </p>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          className={primary}
          disabled={saving || chosen.length === 0}
          onClick={() => void save()}
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : moving ? (
            "Sposta qui"
          ) : chosen.length > 1 ? (
            `Proponi ${chosen.length} sedute`
          ) : (
            "Proponi la seduta"
          )}
        </button>
        <button className={secondary} onClick={onClose}>
          Annulla
        </button>
      </div>
    </div>
  );
}

function WeekGrid({
  week,
  data,
  error,
  selected,
  movingId,
  onPrev,
  onNext,
  onPick,
}: {
  week: YMD;
  data: CalendarData | null;
  error: string;
  selected: number[];
  movingId?: string;
  onPrev: () => void;
  onNext: () => void;
  onPick: (ms: number) => void;
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(week, i));

  // Ore mostrate: almeno 8-20, allargate agli orari di lavoro.
  let first = 8 * 60;
  let last = 20 * 60;
  for (const h of data?.hours ?? []) {
    first = Math.min(first, Math.floor(toMin(h.start) / 60) * 60);
    last = Math.max(last, Math.ceil(toMin(h.end) / 60) * 60);
  }
  const height = ((last - first) / 30) * ROW;

  const free = useMemo(() => {
    if (!data) return [];
    const from = dayStart(week);
    const unavailable = [...data.busy, ...data.blocks, ...data.bookings.filter((b) => b.id !== movingId)].map((x) => ({
      start: Date.parse(x.start),
      end: Date.parse(x.end),
    }));
    return computeSlots({
      now: from,
      timezone: TZ,
      sessionMinutes: data.settings.session_minutes,
      bufferMinutes: data.settings.buffer_minutes,
      minNoticeHours: 0,
      maxDaysAhead: 6,
      hours: data.hours,
      unavailable,
      closedHolidays: data.settings.closed_holidays ?? [],
      patronDay: data.settings.patron_day,
    }).filter((s) => s > Date.now());
  }, [data, week, movingId]);

  // Parte di un intervallo che cade in quel giorno, in minuti locali.
  const place = (day: YMD, startMs: number, endMs: number) => {
    const ds = dayStart(day);
    const de = dayStart(addDays(day, 1));
    const s = Math.max(startMs, ds);
    const e = Math.min(endMs, de);
    if (e <= s) return null;
    const sm = rome(s).minutes;
    const em = e >= de ? 24 * 60 : rome(e).minutes;
    const top = Math.max(sm, first);
    const bottom = Math.min(em, last);
    if (bottom <= top) return null;
    return { top: ((top - first) / 30) * ROW, height: Math.max(((bottom - top) / 30) * ROW, 14) };
  };

  const sessionMs = (data?.settings.session_minutes ?? 50) * 60_000;
  const today = rome(Date.now());

  return (
    <div className="rounded-lg border border-stone-200 bg-white">
      <div className="flex items-center justify-between px-3 py-2 border-b border-stone-200">
        <button onClick={onPrev} className="p-1 text-stone-600 hover:text-stone-900" aria-label="Settimana precedente">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <p className="text-sm font-medium first-letter:uppercase">
          {monthFmt.format(new Date(dayStart(week) + 3 * DAY))}
        </p>
        <button onClick={onNext} className="p-1 text-stone-600 hover:text-stone-900" aria-label="Settimana successiva">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="flex flex-wrap gap-x-3 gap-y-1 px-3 py-2 text-[11px] text-stone-600 border-b border-stone-100">
        <Legend className="border border-dashed border-sage-500 bg-sage-50" text="Libero (clicca per scegliere)" />
        <Legend className="bg-stone-300" text="Occupato nel tuo calendario" />
        <Legend className="bg-stripes border border-stone-300" text="Bloccato" />
        <Legend className="bg-clay-200" text="Prenotazione" />
        <Legend className="bg-sage-700" text="Scelta" />
      </div>

      {error ? (
        <p className="p-4 text-sm text-red-700">{error}</p>
      ) : !data ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-5 h-5 animate-spin text-sage-600" />
        </div>
      ) : (
        <>
          {data.google !== "ok" && (
            <p className="px-3 py-2 text-xs text-clay-800 bg-clay-50">
              Il tuo Google Calendar non è leggibile in questo momento: gli impegni personali non sono mostrati.
            </p>
          )}
          <div className="overflow-x-auto overflow-y-hidden">
            <div className="flex min-w-[560px] pb-2">
              <div className="w-12 shrink-0 pt-10">
                <div className="relative" style={{ height }}>
                  {Array.from({ length: (last - first) / 60 + 1 }, (_, i) => (
                    <span
                      key={i}
                      className="absolute right-1 -translate-y-1/2 text-[10px] text-stone-400"
                      style={{ top: i * 2 * ROW }}
                    >
                      {pad(first / 60 + i)}:00
                    </span>
                  ))}
                </div>
              </div>
              {days.map((day) => {
                const wd = weekdayOf(day);
                const holiday = closedHoliday(day.y, day.m, day.d, data.settings.closed_holidays ?? [], data.settings.patron_day);
                const isToday = day.y === today.y && day.m === today.m && day.d === today.d;
                return (
                  <div key={ymdText(day)} className="flex-1 min-w-0 border-l border-stone-100">
                    <div className={"h-10 px-1 text-center text-xs leading-tight pt-1 " + (isToday ? "text-sage-800 font-semibold" : "text-stone-600")}>
                      {WEEKDAYS[wd - 1]} {day.d}
                      {holiday && <span className="block text-[10px] text-clay-800 truncate" title={holiday}>festivo</span>}
                    </div>
                    <div className="relative" style={{ height }}>
                      {Array.from({ length: (last - first) / 30 }, (_, i) => (
                        <div
                          key={i}
                          className={"absolute inset-x-0 " + (i % 2 ? "border-t border-stone-50" : "border-t border-stone-100")}
                          style={{ top: i * ROW }}
                        />
                      ))}
                      {data.hours
                        .filter((h) => h.weekday === wd && !holiday)
                        .map((h, i) => {
                          const pos = place(day, zonedToUtc(day.y, day.m, day.d, toMin(h.start), TZ), zonedToUtc(day.y, day.m, day.d, toMin(h.end), TZ));
                          return pos && <div key={`w${i}`} className="absolute inset-x-0 bg-sage-50/60" style={pos} />;
                        })}
                      {data.busy.map((b, i) => {
                        const pos = place(day, Date.parse(b.start), Date.parse(b.end));
                        return (
                          pos && (
                            <div key={`g${i}`} className="absolute inset-x-0.5 rounded bg-stone-300/90 text-[10px] text-stone-700 px-1 overflow-hidden" style={pos}>
                              Occupato
                            </div>
                          )
                        );
                      })}
                      {data.blocks.map((b, i) => {
                        const pos = place(day, Date.parse(b.start), Date.parse(b.end));
                        return (
                          pos && (
                            <div key={`k${i}`} className="absolute inset-x-0.5 rounded bg-stripes border border-stone-300 text-[10px] text-stone-700 px-1 overflow-hidden" style={pos}>
                              {b.label || "Bloccato"}
                            </div>
                          )
                        );
                      })}
                      {data.bookings
                        .filter((b) => b.id !== movingId)
                        .map((b) => {
                          const pos = place(day, Date.parse(b.start), Date.parse(b.end));
                          return (
                            pos && (
                              <div
                                key={b.id}
                                className={
                                  "absolute inset-x-0.5 rounded text-[10px] px-1 overflow-hidden " +
                                  (b.status === "proposed" || b.status === "pending"
                                    ? "bg-clay-100 border border-dashed border-clay-400 text-clay-900"
                                    : "bg-clay-200 text-clay-900")
                                }
                                style={pos}
                                title={b.status === "proposed" ? "Proposta, da confermare" : b.status === "pending" ? "Richiesta da confermare" : "Confermata"}
                              >
                                rif. {b.ref}
                              </div>
                            )
                          );
                        })}
                      {free
                        .filter((s) => {
                          const r = rome(s);
                          return r.y === day.y && r.m === day.m && r.d === day.d;
                        })
                        .map((s) => {
                          const pos = place(day, s, s + sessionMs);
                          return (
                            pos && (
                              <button
                                key={`f${s}`}
                                onClick={() => onPick(s)}
                                className="absolute inset-x-0.5 rounded border border-dashed border-sage-500 bg-sage-50 hover:bg-sage-100 text-[10px] text-sage-800 px-1 text-left overflow-hidden"
                                style={pos}
                              >
                                {hhmm(rome(s).minutes)}
                              </button>
                            )
                          );
                        })}
                      {selected.map((s) => {
                        const pos = place(day, s, s + sessionMs);
                        return (
                          pos && (
                            <div
                              key={`s${s}`}
                              className="absolute inset-x-0.5 rounded bg-sage-700 text-white text-[10px] px-1 overflow-hidden pointer-events-none shadow"
                              style={pos}
                            >
                              {hhmm(rome(s).minutes)} scelta
                            </div>
                          )
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Legend({ className, text }: { className: string; text: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={"inline-block w-3 h-3 rounded-sm " + className} />
      {text}
    </span>
  );
}
