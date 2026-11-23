import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, Plus, Trash2 } from "lucide-react";
import type { BookingSettings, RequestsApi, WorkingInterval } from "@/admin/api";
import { HOLIDAYS, closedHoliday } from "../../supabase/functions/availability/holidays";

const MONTHS = [
  "gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno",
  "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre",
];
const PATRON_DAY = /^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/;

// Prossime chiusure per festività, a partire da oggi (ora italiana).
function upcomingClosures(closed: string[], patron: string | null, count: number) {
  const [y, m, d] = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" })
    .format(new Date())
    .split("-")
    .map(Number);
  const out: { date: Date; reason: string }[] = [];
  for (let i = 0; i < 400 && out.length < count; i++) {
    const date = new Date(Date.UTC(y, m - 1, d + i));
    const reason = closedHoliday(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate(), closed, patron);
    if (reason) out.push({ date, reason });
  }
  return out;
}
const closureFormat = new Intl.DateTimeFormat("it-IT", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short", year: "numeric" });

const DAYS = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato", "Domenica"];

const numberClass =
  "w-24 px-3 py-2 rounded-lg border border-stone-300 bg-white text-stone-800 focus:outline-none focus:border-sage-500 focus:ring-2 focus:ring-sage-200";
const timeClass =
  "px-2 py-1.5 rounded-lg border border-stone-300 bg-white text-stone-800 focus:outline-none focus:border-sage-500 focus:ring-2 focus:ring-sage-200";

const toMinutes = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
const toTime = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

// Inizi delle sedute in una fascia: si parte all'inizio e si avanza di
// durata + pausa, finché la seduta intera sta dentro la fascia.
function slotStarts(interval: WorkingInterval, session: number, buffer: number): string[] {
  const out: string[] = [];
  const end = toMinutes(interval.end_time);
  for (let t = toMinutes(interval.start_time); t + session <= end; t += session + buffer) {
    out.push(toTime(t));
  }
  return out;
}

const LIMITS = {
  session_minutes: { min: 15, max: 240, label: "Durata della seduta (minuti)" },
  buffer_minutes: { min: 0, max: 120, label: "Pausa tra due sedute (minuti)" },
  min_notice_hours: { min: 0, max: 720, label: "Preavviso minimo (ore)" },
  max_days_ahead: { min: 1, max: 365, label: "Prenotabile fino a (giorni avanti)" },
} as const;
type NumberField = keyof typeof LIMITS;

function validate(s: BookingSettings): string[] {
  const errors: string[] = [];
  (Object.keys(LIMITS) as NumberField[]).forEach((k) => {
    const v = s[k];
    const { min, max, label } = LIMITS[k];
    if (!Number.isInteger(v) || v < min || v > max) {
      errors.push(`${label}: inserisci un numero intero tra ${min} e ${max}.`);
    }
  });
  for (let d = 1; d <= 7; d++) {
    const day = s.hours
      .filter((h) => h.weekday === d)
      .sort((a, b) => a.start_time.localeCompare(b.start_time));
    day.forEach((h, i) => {
      if (!h.start_time || !h.end_time || toMinutes(h.end_time) <= toMinutes(h.start_time)) {
        errors.push(`${DAYS[d - 1]}: l'ora di fine deve essere dopo l'ora di inizio.`);
      } else if (i > 0 && toMinutes(h.start_time) < toMinutes(day[i - 1].end_time)) {
        errors.push(`${DAYS[d - 1]}: due fasce si sovrappongono.`);
      }
    });
  }
  if (s.patron_day !== null && !PATRON_DAY.test(s.patron_day)) {
    errors.push("Santo patrono: scegli sia il giorno sia il mese, oppure «Nessuno».");
  }
  return [...new Set(errors)];
}

export default function Settings({ api }: { api: RequestsApi }) {
  const [saved, setSaved] = useState<BookingSettings | null>(null);
  const [draft, setDraft] = useState<BookingSettings | null>(null);
  const [loadError, setLoadError] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const load = useCallback(async () => {
    setLoadError("");
    try {
      const s = await api.getSettings();
      setSaved(s);
      setDraft(s);
    } catch {
      setLoadError("Non è stato possibile caricare le impostazioni. Riprova o esci e rientra.");
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  const errors = useMemo(() => (draft ? validate(draft) : []), [draft]);
  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(saved), [draft, saved]);

  if (loadError) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-6">
        <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          {loadError}
        </p>
      </main>
    );
  }
  if (!draft) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-sage-600" />
      </div>
    );
  }

  const update = (patch: Partial<BookingSettings>) => {
    setDraft((d) => (d ? { ...d, ...patch } : d));
    setSaveState("idle");
  };
  const updateInterval = (index: number, patch: Partial<WorkingInterval>) =>
    update({ hours: draft.hours.map((h, i) => (i === index ? { ...h, ...patch } : h)) });
  const addInterval = (weekday: number) => {
    const day = draft.hours.filter((h) => h.weekday === weekday);
    const last = day[day.length - 1];
    const start = last ? Math.min(toMinutes(last.end_time) + 60, 22 * 60) : 9 * 60;
    update({
      hours: [
        ...draft.hours,
        { weekday, start_time: toTime(start), end_time: toTime(Math.min(start + 4 * 60, 23 * 60 + 59)) },
      ],
    });
  };
  // patron_day è "MM-DD"; durante la scelta può essere a metà ("06-" o "-13").
  const [patronMonth = "", patronDay = ""] = (draft.patron_day ?? "-").split("-");
  const setPatron = (month: string, day: string) =>
    update({ patron_day: month || day ? `${month}-${day}` : null });
  const removeInterval = (index: number) => update({ hours: draft.hours.filter((_, i) => i !== index) });

  const save = async () => {
    if (errors.length) return;
    setSaveState("saving");
    const clean: BookingSettings = {
      ...draft,
      hours: [...draft.hours].sort(
        (a, b) => a.weekday - b.weekday || a.start_time.localeCompare(b.start_time),
      ),
    };
    try {
      await api.saveSettings(clean);
      setSaved(clean);
      setDraft(clean);
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  };

  const weeklySlots = draft.hours.reduce(
    (n, h) => n + slotStarts(h, draft.session_minutes, draft.buffer_minutes).length,
    0,
  );

  return (
    <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      <section className="bg-white rounded-2xl border border-stone-200 p-6">
        <h2 className="text-lg font-medium mb-1">Sedute e prenotazioni</h2>
        <p className="text-sm text-stone-500 mb-5">
          Valgono per le fasce che i pazienti vedranno quando la prenotazione online sarà attiva.
        </p>
        <div className="grid sm:grid-cols-2 gap-5">
          {(Object.keys(LIMITS) as NumberField[]).map((k) => (
            <label key={k} className="block text-sm">
              <span className="block text-stone-700 font-medium mb-2">{LIMITS[k].label}</span>
              <input
                type="number"
                inputMode="numeric"
                min={LIMITS[k].min}
                max={LIMITS[k].max}
                step={1}
                value={Number.isNaN(draft[k]) ? "" : draft[k]}
                onChange={(e) => update({ [k]: e.target.valueAsNumber } as Partial<BookingSettings>)}
                className={numberClass}
              />
            </label>
          ))}
        </div>
      </section>

      <section className="bg-white rounded-2xl border border-stone-200 p-6">
        <h2 className="text-lg font-medium mb-1">Orari di lavoro</h2>
        <p className="text-sm text-stone-500 mb-5">
          Puoi avere più fasce nello stesso giorno, ad esempio mattina e pomeriggio. Un giorno senza
          fasce è chiuso: la domenica resta chiusa finché non le aggiungi una fascia.
        </p>
        <ul className="divide-y divide-stone-200">
          {DAYS.map((label, i) => {
            const weekday = i + 1;
            const items = draft.hours
              .map((h, index) => ({ h, index }))
              .filter(({ h }) => h.weekday === weekday);
            const starts = items.flatMap(({ h }) =>
              slotStarts(h, draft.session_minutes, draft.buffer_minutes),
            );
            return (
              <li key={weekday} className="py-4">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <span className="font-medium">{label}</span>
                  <button
                    onClick={() => addInterval(weekday)}
                    className="inline-flex items-center gap-1 text-sm text-sage-700 hover:text-sage-800"
                  >
                    <Plus className="w-4 h-4" /> Aggiungi fascia
                  </button>
                </div>
                {items.length === 0 ? (
                  <p className="text-sm text-stone-400">Chiuso</p>
                ) : (
                  <div className="space-y-2">
                    {items.map(({ h, index }) => (
                      <div key={index} className="flex items-center gap-2 text-sm">
                        <span className="text-stone-500">dalle</span>
                        <input
                          type="time"
                          value={h.start_time}
                          onChange={(e) => updateInterval(index, { start_time: e.target.value })}
                          className={timeClass}
                          aria-label={`${label}, inizio fascia`}
                        />
                        <span className="text-stone-500">alle</span>
                        <input
                          type="time"
                          value={h.end_time}
                          onChange={(e) => updateInterval(index, { end_time: e.target.value })}
                          className={timeClass}
                          aria-label={`${label}, fine fascia`}
                        />
                        <button
                          onClick={() => removeInterval(index)}
                          className="p-1.5 text-stone-400 hover:text-red-700"
                          aria-label={`Rimuovi fascia di ${label}`}
                          title="Rimuovi fascia"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    <p className="text-xs text-stone-500">
                      {starts.length > 0
                        ? `${starts.length} sedute: ${starts.join(", ")}`
                        : "Nessuna seduta intera ci sta in queste fasce."}
                    </p>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="bg-white rounded-2xl border border-stone-200 p-6">
        <h2 className="text-lg font-medium mb-1">Festività</h2>
        <p className="text-sm text-stone-500 mb-5">
          Le festività spuntate sono chiuse alle prenotazioni. Togli la spunta per lavorare in quel giorno.
        </p>
        <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2 mb-6">
          {HOLIDAYS.map((h) => (
            <label key={h.code} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft.closed_holidays.includes(h.code)}
                onChange={(e) =>
                  update({
                    closed_holidays: e.target.checked
                      ? [...draft.closed_holidays, h.code]
                      : draft.closed_holidays.filter((c) => c !== h.code),
                  })
                }
              />
              {h.label}
            </label>
          ))}
        </div>

        <div className="text-sm mb-6">
          <span className="block text-stone-700 font-medium mb-2">Santo patrono del comune (chiuso)</span>
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Giorno del santo patrono"
              value={patronDay}
              onChange={(e) => setPatron(patronMonth, e.target.value)}
              className={timeClass}
            >
              <option value="">Giorno</option>
              {Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, "0")).map((d) => (
                <option key={d} value={d}>
                  {Number(d)}
                </option>
              ))}
            </select>
            <select
              aria-label="Mese del santo patrono"
              value={patronMonth}
              onChange={(e) => setPatron(e.target.value, patronDay)}
              className={timeClass}
            >
              <option value="">Mese</option>
              {MONTHS.map((name, i) => (
                <option key={name} value={String(i + 1).padStart(2, "0")}>
                  {name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => update({ patron_day: null })}
              className="text-stone-500 hover:text-stone-800 underline underline-offset-2"
            >
              Nessuno
            </button>
          </div>
        </div>

        <h3 className="text-sm font-medium text-stone-700 mb-2">Prossime chiusure per festività</h3>
        <ul className="text-sm text-stone-600 space-y-1">
          {upcomingClosures(draft.closed_holidays, PATRON_DAY.test(draft.patron_day ?? "") ? draft.patron_day : null, 5).map(
            ({ date, reason }) => (
              <li key={date.toISOString()}>
                <span className="capitalize">{closureFormat.format(date)}</span> – {reason}
              </li>
            ),
          )}
        </ul>
      </section>

      <div className="sticky bottom-0 bg-stone-100/95 backdrop-blur py-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div className="text-sm">
          {errors.length > 0 ? (
            <ul role="alert" className="text-red-700 space-y-1">
              {errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          ) : saveState === "saved" ? (
            <p className="text-sage-700 inline-flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4" /> Impostazioni salvate.
            </p>
          ) : saveState === "error" ? (
            <p role="alert" className="text-red-700">
              Le impostazioni non sono state salvate. Controlla gli orari e riprova.
            </p>
          ) : (
            <p className="text-stone-500">{weeklySlots} sedute disponibili a settimana con questi orari.</p>
          )}
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => {
              setDraft(saved);
              setSaveState("idle");
            }}
            disabled={!dirty || saveState === "saving"}
            className="px-4 py-2 rounded-full border border-stone-300 bg-white text-sm disabled:opacity-50"
          >
            Annulla modifiche
          </button>
          <button
            onClick={() => void save()}
            disabled={!dirty || errors.length > 0 || saveState === "saving"}
            className="px-5 py-2 rounded-full bg-sage-700 text-white text-sm hover:bg-sage-800 disabled:opacity-50 inline-flex items-center gap-2"
          >
            {saveState === "saving" && <Loader2 className="w-4 h-4 animate-spin" />}
            Salva impostazioni
          </button>
        </div>
      </div>
    </main>
  );
}
