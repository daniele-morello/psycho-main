import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Loader2, Mail, Phone, RefreshCw, Trash2 } from "lucide-react";
import type { ContactRequest, RequestStatus, RequestsApi } from "@/admin/api";

const STATUS_LABEL: Record<RequestStatus, string> = {
  new: "Nuova",
  contacted: "Ricontattata",
  closed: "Chiusa",
};
const STATUS_BADGE: Record<RequestStatus, string> = {
  new: "bg-clay-100 text-clay-800",
  contacted: "bg-sage-100 text-sage-800",
  closed: "bg-stone-200 text-stone-600",
};
type Filter = RequestStatus | "all";
const FILTERS: { value: Filter; label: string }[] = [
  { value: "new", label: "Nuove" },
  { value: "contacted", label: "Ricontattate" },
  { value: "closed", label: "Chiuse" },
  { value: "all", label: "Tutte" },
];

const dateFormat = new Intl.DateTimeFormat("it-IT", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
const formatDate = (iso: string) => dateFormat.format(new Date(iso));
const fullName = (r: ContactRequest) => [r.name, r.surname].filter(Boolean).join(" ");

export default function Requests({ api }: { api: RequestsApi }) {
  const [rows, setRows] = useState<ContactRequest[] | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<Filter>("new");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expired, setExpired] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmPurge, setConfirmPurge] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      const [list, expiredCount] = await Promise.all([api.list(), api.countExpired()]);
      setRows(list);
      setExpired(expiredCount);
    } catch {
      setError("Non è stato possibile caricare le richieste. Riprova o esci e rientra.");
      setRows((prev) => prev ?? []);
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { new: 0, contacted: 0, closed: 0, all: 0 };
    rows?.forEach((r) => {
      c[r.status] += 1;
      c.all += 1;
    });
    return c;
  }, [rows]);

  const visible = useMemo(
    () => (rows ?? []).filter((r) => filter === "all" || r.status === filter),
    [rows, filter],
  );
  const selected = rows?.find((r) => r.id === selectedId) ?? null;

  const run = async (action: () => Promise<unknown>, failure: string) => {
    setBusy(true);
    setError("");
    try {
      await action();
      await load();
    } catch {
      setError(failure);
    } finally {
      setBusy(false);
    }
  };

  const changeStatus = (status: RequestStatus) =>
    selected && run(() => api.setStatus(selected.id, status), "Lo stato non è stato aggiornato.");

  const remove = () =>
    selected &&
    run(async () => {
      await api.remove(selected.id);
      setSelectedId(null);
      setConfirmDelete(false);
    }, "La richiesta non è stata eliminata.");

  const purge = () =>
    run(async () => {
      await api.deleteExpired();
      setSelectedId(null);
      setConfirmPurge(false);
    }, "Le richieste scadute non sono state eliminate.");

  if (rows === null) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-sage-600" />
      </div>
    );
  }

  return (
    <main className="max-w-6xl mx-auto px-4 py-6">
      {expired > 0 && (
        <div className="mb-5 rounded-xl border border-clay-300 bg-clay-50 px-4 py-3 text-sm flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <p>
            <strong>{expired}</strong>{" "}
            {expired === 1 ? "richiesta ha superato" : "richieste hanno superato"} i tempi di
            conservazione (chiuse da più di 6 mesi, o ricevute da più di 12 mesi).
          </p>
          {!confirmPurge ? (
            <button
              onClick={() => setConfirmPurge(true)}
              className="shrink-0 px-4 py-2 rounded-full bg-clay-600 text-white hover:bg-clay-700"
            >
              Elimina ora
            </button>
          ) : (
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => void purge()}
                disabled={busy}
                className="px-4 py-2 rounded-full bg-red-700 text-white hover:bg-red-800 disabled:opacity-60"
              >
                Sì, elimina {expired}
              </button>
              <button
                onClick={() => setConfirmPurge(false)}
                className="px-4 py-2 rounded-full border border-stone-300 bg-white"
              >
                Annulla
              </button>
            </div>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="mb-5 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          {error}
        </p>
      )}

      <div className="grid md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-5">
        <section className={selected ? "hidden md:block" : ""} aria-label="Elenco richieste">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                aria-pressed={filter === f.value}
                className={
                  "px-3 py-1.5 rounded-full text-sm border " +
                  (filter === f.value
                    ? "bg-sage-700 text-white border-sage-700"
                    : "bg-white text-stone-700 border-stone-300 hover:border-sage-400")
                }
              >
                {f.label} <span className="opacity-70">{counts[f.value]}</span>
              </button>
            ))}
            <button
              onClick={() => void load()}
              className="ml-auto p-2 text-stone-500 hover:text-stone-800"
              aria-label="Aggiorna"
              title="Aggiorna"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {visible.length === 0 ? (
            <p className="text-sm text-stone-500 bg-white rounded-xl border border-stone-200 px-4 py-8 text-center">
              Nessuna richiesta in questa sezione.
            </p>
          ) : (
            <ul className="space-y-2">
              {visible.map((r) => (
                <li key={r.id}>
                  <button
                    onClick={() => {
                      setSelectedId(r.id);
                      setConfirmDelete(false);
                    }}
                    className={
                      "w-full text-left bg-white rounded-xl border px-4 py-3 hover:border-sage-400 " +
                      (r.id === selectedId ? "border-sage-500 ring-2 ring-sage-100" : "border-stone-200")
                    }
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium truncate">{fullName(r)}</span>
                      <span className={"text-xs rounded-full px-2 py-0.5 shrink-0 " + STATUS_BADGE[r.status]}>
                        {STATUS_LABEL[r.status]}
                      </span>
                    </div>
                    <p className="text-xs text-stone-500 mt-1">
                      {formatDate(r.created_at)} · {r.service ?? "—"} · {r.consultation_mode ?? "—"}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-label="Dettaglio richiesta" className={selected ? "" : "hidden md:block"}>
          {!selected ? (
            <p className="text-sm text-stone-500 bg-white rounded-xl border border-dashed border-stone-300 px-4 py-16 text-center">
              Seleziona una richiesta per vederne il dettaglio.
            </p>
          ) : (
            <article className="bg-white rounded-2xl border border-stone-200 p-6">
              <button
                onClick={() => setSelectedId(null)}
                className="md:hidden flex items-center gap-1 text-sm text-stone-500 mb-4"
              >
                <ArrowLeft className="w-4 h-4" /> Elenco
              </button>
              <div className="flex items-start justify-between gap-3 mb-1">
                <h2 className="text-xl font-medium">{fullName(selected)}</h2>
                <span className={"text-xs rounded-full px-2 py-0.5 " + STATUS_BADGE[selected.status]}>
                  {STATUS_LABEL[selected.status]}
                </span>
              </div>
              <p className="text-sm text-stone-500 mb-5">Ricevuta il {formatDate(selected.created_at)}</p>

              <div className="flex flex-wrap gap-2 mb-6">
                <a
                  href={`mailto:${selected.email}`}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-stone-300 text-sm hover:border-sage-400"
                >
                  <Mail className="w-4 h-4" /> {selected.email}
                </a>
                {selected.phone && (
                  <a
                    href={`tel:${selected.phone}`}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-stone-300 text-sm hover:border-sage-400"
                  >
                    <Phone className="w-4 h-4" /> {selected.phone}
                  </a>
                )}
              </div>

              <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm mb-6">
                <dt className="text-stone-500">Servizio</dt>
                <dd>{selected.service ?? "—"}</dd>
                <dt className="text-stone-500">Modalità</dt>
                <dd>{selected.consultation_mode ?? "—"}</dd>
                <dt className="text-stone-500">Orario preferito</dt>
                <dd>{selected.preferred_time || "—"}</dd>
              </dl>

              <h3 className="text-sm font-medium text-stone-700 mb-2">Messaggio</h3>
              {selected.message ? (
                <p className="text-sm whitespace-pre-wrap break-words bg-stone-50 rounded-lg px-4 py-3 mb-6">
                  {selected.message}
                </p>
              ) : (
                <p className="text-sm text-stone-400 italic mb-6">Nessun messaggio.</p>
              )}

              <h3 className="text-sm font-medium text-stone-700 mb-2">Stato</h3>
              <div className="flex flex-wrap gap-2 mb-8">
                {(Object.keys(STATUS_LABEL) as RequestStatus[]).map((s) => (
                  <button
                    key={s}
                    disabled={busy || selected.status === s}
                    onClick={() => void changeStatus(s)}
                    className={
                      "px-3 py-1.5 rounded-full text-sm border disabled:cursor-default " +
                      (selected.status === s
                        ? "bg-sage-700 text-white border-sage-700"
                        : "bg-white border-stone-300 hover:border-sage-400 disabled:opacity-60")
                    }
                  >
                    {STATUS_LABEL[s]}
                  </button>
                ))}
              </div>

              <div className="border-t border-stone-200 pt-4">
                {!confirmDelete ? (
                  <button
                    onClick={() => setConfirmDelete(true)}
                    className="inline-flex items-center gap-2 text-sm text-red-700 hover:text-red-800"
                  >
                    <Trash2 className="w-4 h-4" /> Elimina definitivamente
                  </button>
                ) : (
                  <div className="text-sm">
                    <p className="mb-3">
                      La richiesta di <strong>{fullName(selected)}</strong> verrà cancellata dal database.
                      Non si può annullare.
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => void remove()}
                        disabled={busy}
                        className="px-4 py-2 rounded-full bg-red-700 text-white hover:bg-red-800 disabled:opacity-60"
                      >
                        Sì, elimina
                      </button>
                      <button
                        onClick={() => setConfirmDelete(false)}
                        className="px-4 py-2 rounded-full border border-stone-300"
                      >
                        Annulla
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </article>
          )}
        </section>
      </div>
    </main>
  );
}
