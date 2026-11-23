import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { CalendarOff, Loader2, Trash2 } from "lucide-react";
import type { BlockedPeriod, RequestsApi } from "@/admin/api";

const TZ = "Europe/Rome";
const dayFormat = new Intl.DateTimeFormat("it-IT", {
  timeZone: TZ,
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
});
const timeFormat = new Intl.DateTimeFormat("it-IT", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });

const inputClass =
  "px-3 py-2 rounded-lg border border-stone-300 bg-white text-stone-800 focus:outline-none focus:border-sage-500 focus:ring-2 focus:ring-sage-200";

// Data di oggi in Italia, "YYYY-MM-DD".
const todayInRome = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date(),
  );

const nextDay = (date: string) => {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
};

function describe(b: BlockedPeriod): string {
  const start = new Date(b.starts_at);
  const end = new Date(b.ends_at);
  if (b.all_day) {
    const lastDay = new Date(end.getTime() - 1);
    const first = dayFormat.format(start);
    const last = dayFormat.format(lastDay);
    return first === last ? `${first}, giornata intera` : `da ${first} a ${last}, giornate intere`;
  }
  const sameDay = dayFormat.format(start) === dayFormat.format(end);
  return sameDay
    ? `${dayFormat.format(start)}, dalle ${timeFormat.format(start)} alle ${timeFormat.format(end)}`
    : `da ${dayFormat.format(start)} ${timeFormat.format(start)} a ${dayFormat.format(end)} ${timeFormat.format(end)}`;
}

export default function Blocks({ api }: { api: RequestsApi }) {
  const [blocks, setBlocks] = useState<BlockedPeriod[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"days" | "hours">("days");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const today = todayInRome();

  const load = useCallback(async () => {
    try {
      setBlocks(await api.listBlocks());
    } catch {
      setError("Non è stato possibile caricare i blocchi. Riprova o esci e rientra.");
      setBlocks((b) => b ?? []);
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  const add = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const label = String(f.get("label") || "").trim();
    let start_local: string;
    let end_local: string;

    if (mode === "days") {
      const from = String(f.get("from") || "");
      const to = String(f.get("to") || "") || from;
      if (!from || to < from) {
        setError("La data di fine deve essere uguale o successiva a quella di inizio.");
        return;
      }
      start_local = `${from}T00:00`;
      end_local = `${nextDay(to)}T00:00`;
    } else {
      const date = String(f.get("date") || "");
      const startTime = String(f.get("start") || "");
      const endTime = String(f.get("end") || "");
      if (!date || !startTime || !endTime || endTime <= startTime) {
        setError("L'ora di fine deve essere dopo l'ora di inizio.");
        return;
      }
      start_local = `${date}T${startTime}`;
      end_local = `${date}T${endTime}`;
    }

    setBusy(true);
    setError("");
    try {
      await api.addBlock({ start_local, end_local, all_day: mode === "days", label });
      form.reset();
      await load();
    } catch {
      setError("Il blocco non è stato salvato. Controlla che non sia già passato e riprova.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    setBusy(true);
    setError("");
    try {
      await api.removeBlock(id);
      setConfirmId(null);
      await load();
    } catch {
      setError("Il blocco non è stato eliminato.");
    } finally {
      setBusy(false);
    }
  };

  const tabClass = (active: boolean) =>
    "px-3 py-1.5 rounded-full text-sm border " +
    (active ? "bg-sage-700 text-white border-sage-700" : "bg-white text-stone-700 border-stone-300 hover:border-sage-400");

  return (
    <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      <section className="bg-white rounded-2xl border border-stone-200 p-6">
        <h2 className="text-lg font-medium mb-1">Aggiungi un blocco</h2>
        <p className="text-sm text-stone-500 mb-5">
          Nei periodi bloccati i pazienti non potranno prenotare, anche se nel calendario risultano liberi.
        </p>

        <div className="flex gap-2 mb-5" role="group" aria-label="Tipo di blocco">
          <button type="button" onClick={() => setMode("days")} aria-pressed={mode === "days"} className={tabClass(mode === "days")}>
            Giornate intere
          </button>
          <button type="button" onClick={() => setMode("hours")} aria-pressed={mode === "hours"} className={tabClass(mode === "hours")}>
            Fascia oraria
          </button>
        </div>

        <form key={mode} onSubmit={(e) => void add(e)} className="space-y-4">
          {mode === "days" ? (
            <div className="flex flex-wrap items-end gap-3 text-sm">
              <label className="block">
                <span className="block text-stone-700 font-medium mb-1">Dal</span>
                <input name="from" type="date" required min={today} className={inputClass} />
              </label>
              <label className="block">
                <span className="block text-stone-700 font-medium mb-1">Al (compreso)</span>
                <input name="to" type="date" min={today} className={inputClass} />
              </label>
              <p className="text-xs text-stone-500 w-full">Lascia vuoto «Al» per bloccare un solo giorno.</p>
            </div>
          ) : (
            <div className="flex flex-wrap items-end gap-3 text-sm">
              <label className="block">
                <span className="block text-stone-700 font-medium mb-1">Giorno</span>
                <input name="date" type="date" required min={today} className={inputClass} />
              </label>
              <label className="block">
                <span className="block text-stone-700 font-medium mb-1">Dalle</span>
                <input name="start" type="time" required className={inputClass} />
              </label>
              <label className="block">
                <span className="block text-stone-700 font-medium mb-1">Alle</span>
                <input name="end" type="time" required className={inputClass} />
              </label>
            </div>
          )}

          <label className="block text-sm">
            <span className="block text-stone-700 font-medium mb-1">Etichetta (facoltativa)</span>
            <input
              name="label"
              maxLength={60}
              placeholder="Ad esempio: Ferie, Congresso"
              className={inputClass + " w-full"}
              aria-describedby="label-hint"
            />
            <span id="label-hint" className="block text-xs text-stone-500 mt-1">
              Non scrivere nomi di pazienti o altri dati personali.
            </span>
          </label>

          {error && (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="px-5 py-2 rounded-full bg-sage-700 text-white text-sm hover:bg-sage-800 disabled:opacity-60 inline-flex items-center gap-2"
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            Aggiungi blocco
          </button>
        </form>
      </section>

      <section className="bg-white rounded-2xl border border-stone-200 p-6">
        <h2 className="text-lg font-medium mb-4">Blocchi in programma</h2>
        {blocks === null ? (
          <Loader2 className="w-5 h-5 animate-spin text-sage-600" />
        ) : blocks.length === 0 ? (
          <p className="text-sm text-stone-500 flex items-center gap-2">
            <CalendarOff className="w-4 h-4" /> Nessun blocco in programma.
          </p>
        ) : (
          <ul className="divide-y divide-stone-200">
            {blocks.map((b) => (
              <li key={b.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="text-sm">
                  <p className="font-medium">{b.label || "Bloccato"}</p>
                  <p className="text-stone-500">{describe(b)}</p>
                </div>
                {confirmId === b.id ? (
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => void remove(b.id)}
                      disabled={busy}
                      className="px-3 py-1.5 rounded-full bg-red-700 text-white text-sm hover:bg-red-800 disabled:opacity-60"
                    >
                      Sì, elimina
                    </button>
                    <button onClick={() => setConfirmId(null)} className="px-3 py-1.5 rounded-full border border-stone-300 text-sm">
                      Annulla
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmId(b.id)}
                    className="inline-flex items-center gap-1 text-sm text-red-700 hover:text-red-800 shrink-0"
                  >
                    <Trash2 className="w-4 h-4" /> Elimina
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
