import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import type { AvailabilityPreview, RequestsApi } from "@/admin/api";

const TZ = "Europe/Rome";
const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const dayLabel = new Intl.DateTimeFormat("it-IT", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" });
const timeLabel = new Intl.DateTimeFormat("it-IT", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
const DAYS_SHOWN = 14;

export default function Availability({ api }: { api: RequestsApi }) {
  const [data, setData] = useState<AvailabilityPreview | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      setData(await api.previewAvailability());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  const days = new Map<string, Date[]>();
  for (const iso of data?.slots ?? []) {
    const d = new Date(iso);
    const key = dayKey.format(d);
    if (!days.has(key) && days.size >= DAYS_SHOWN) break;
    days.set(key, [...(days.get(key) ?? []), d]);
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      <section className="bg-white rounded-2xl border border-stone-200 p-6">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-medium mb-1">Anteprima delle disponibilità</h2>
            <p className="text-sm text-stone-500">
              Le fasce che vedrebbero i pazienti: orari di lavoro, meno blocchi e impegni del calendario.
            </p>
          </div>
          <button
            onClick={() => void load()}
            disabled={loading}
            className="p-2 text-stone-500 hover:text-stone-800 disabled:opacity-50"
            aria-label="Aggiorna"
            title="Aggiorna"
          >
            <RefreshCw className={"w-4 h-4" + (loading ? " animate-spin" : "")} />
          </button>
        </div>

        {error ? (
          <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            Non è stato possibile calcolare le disponibilità. Riprova tra poco.
          </p>
        ) : !data ? (
          <Loader2 className="w-5 h-5 animate-spin text-sage-600" />
        ) : (
          <>
            {data.calendar === "ok" ? (
              <p className="text-sm text-sage-700 flex items-center gap-2 mb-4">
                <CheckCircle2 className="w-4 h-4" /> Calendario Google collegato (solo occupato/libero).
              </p>
            ) : (
              <p className="text-sm text-clay-800 bg-clay-50 border border-clay-300 rounded-lg px-4 py-3 mb-4 flex gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                {data.calendar === "not_configured"
                  ? "Il calendario non è configurato: per sicurezza non viene offerta nessuna fascia."
                  : "Non riesco a leggere il calendario: controlla che sia condiviso con l'account di servizio come «Vedere solo disponibilità». Finché non si legge, non viene offerta nessuna fascia."}
              </p>
            )}

            {days.size === 0 ? (
              data.calendar === "ok" && (
                <p className="text-sm text-stone-500">
                  Nessuna fascia libera. Controlla di aver impostato gli orari di lavoro.
                </p>
              )
            ) : (
              <ul className="space-y-3">
                {[...days.entries()].map(([key, slots]) => (
                  <li key={key}>
                    <p className="text-sm font-medium capitalize mb-1">{dayLabel.format(slots[0])}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {slots.map((s) => (
                        <span key={s.toISOString()} className="text-xs rounded-full bg-sage-50 border border-sage-200 px-2.5 py-1">
                          {timeLabel.format(s)}
                        </span>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>
    </main>
  );
}
