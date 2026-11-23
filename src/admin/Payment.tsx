import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import type { PaymentSettings, RequestsApi } from "@/admin/api";
import {
  cancellationText,
  formatEuro,
  paymentDeadlineText,
  platformText,
  videoInstructionsText,
} from "@/lib/paymentText";

const inputClass =
  "px-3 py-2 rounded-lg border border-stone-300 bg-white text-stone-800 focus:outline-none focus:border-sage-500 focus:ring-2 focus:ring-sage-200";

type Draft = Omit<PaymentSettings, "online_price_cents"> & { price: string };

const toDraft = (p: PaymentSettings): Draft => ({
  ...p,
  price: p.online_price_cents === null ? "" : (p.online_price_cents / 100).toFixed(2).replace(".", ","),
});

// "70", "70,5", "70,50" o "70.50" -> centesimi; null se vuoto; NaN se non valido.
function parsePrice(text: string): number | null {
  const t = text.trim().replace(/\s|€/g, "").replace(",", ".");
  if (!t) return null;
  if (!/^\d{1,4}(\.\d{1,2})?$/.test(t)) return Number.NaN;
  return Math.round(Number(t) * 100);
}

const HOURS = {
  payment_window_hours: { min: 1, max: 336, label: "Tempo per pagare dopo la conferma (ore)" },
  payment_cutoff_hours: { min: 0, max: 336, label: "Pagamento comunque entro (ore prima della seduta)" },
  refund_notice_hours: { min: 0, max: 720, label: "Rimborso completo se si disdice almeno (ore prima)" },
} as const;
type HoursField = keyof typeof HOURS;

export default function Payment({ api }: { api: RequestsApi }) {
  const [saved, setSaved] = useState<Draft | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const load = useCallback(async () => {
    try {
      const d = toDraft(await api.getPayment());
      setSaved(d);
      setDraft(d);
    } catch {
      setLoadError(true);
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  const cents = draft ? parsePrice(draft.price) : null;
  const errors = useMemo(() => {
    if (!draft) return [];
    const e: string[] = [];
    if (Number.isNaN(cents) || (cents !== null && (cents < 100 || cents > 100000))) {
      e.push("Prezzo: scrivi un importo tra 1 e 1000 euro, ad esempio 70 o 70,50.");
    }
    (Object.keys(HOURS) as HoursField[]).forEach((k) => {
      const v = draft[k];
      if (!Number.isInteger(v) || v < HOURS[k].min || v > HOURS[k].max) {
        e.push(`${HOURS[k].label}: un numero intero tra ${HOURS[k].min} e ${HOURS[k].max}.`);
      }
    });
    return e;
  }, [draft, cents]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);

  if (loadError) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-6">
        <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          Non è stato possibile caricare le impostazioni di pagamento. Riprova o esci e rientra.
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

  const update = (patch: Partial<Draft>) => {
    setDraft((d) => (d ? { ...d, ...patch } : d));
    setState("idle");
  };

  const save = async () => {
    if (errors.length) return;
    setState("saving");
    const clean = (s: string | null) => (s && s.trim() ? s.trim() : null);
    const payload: PaymentSettings = {
      online_price_cents: cents,
      payment_window_hours: draft.payment_window_hours,
      payment_cutoff_hours: draft.payment_cutoff_hours,
      refund_notice_hours: draft.refund_notice_hours,
      cancellation_note: clean(draft.cancellation_note),
      video_platform: clean(draft.video_platform),
      video_instructions: clean(draft.video_instructions),
    };
    try {
      await api.savePayment(payload);
      const d = toDraft(payload);
      setSaved(d);
      setDraft(d);
      setState("saved");
    } catch {
      setState("error");
    }
  };

  const terms: PaymentSettings = { ...draft, online_price_cents: Number.isNaN(cents) ? null : cents };

  return (
    <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      <section className="bg-white rounded-2xl border border-stone-200 p-6 space-y-5">
        <div>
          <h2 className="text-lg font-medium mb-1">Pagamento del primo colloquio online</h2>
          <p className="text-sm text-stone-500">
            Il pagamento è richiesto solo per le sedute online, dopo che hai confermato l'appuntamento. Le
            sedute in presenza si pagano allo studio.
          </p>
        </div>

        <label className="block text-sm">
          <span className="block text-stone-700 font-medium mb-2">Prezzo (€)</span>
          <input
            inputMode="decimal"
            value={draft.price}
            onChange={(e) => update({ price: e.target.value })}
            placeholder="Ad esempio 70"
            className={inputClass + " w-32"}
          />
          <span className="block text-xs text-stone-500 mt-1">
            Finché il prezzo è vuoto, il pagamento online non si può chiedere.
          </span>
        </label>

        <div className="grid sm:grid-cols-3 gap-4">
          {(Object.keys(HOURS) as HoursField[]).map((k) => (
            <label key={k} className="block text-sm">
              <span className="block text-stone-700 font-medium mb-2">{HOURS[k].label}</span>
              <input
                type="number"
                min={HOURS[k].min}
                max={HOURS[k].max}
                step={1}
                value={Number.isNaN(draft[k]) ? "" : draft[k]}
                onChange={(e) => update({ [k]: e.target.valueAsNumber } as Partial<Draft>)}
                className={inputClass + " w-24"}
              />
            </label>
          ))}
        </div>

        <label className="block text-sm">
          <span className="block text-stone-700 font-medium mb-2">Nota sulla disdetta (facoltativa)</span>
          <textarea
            rows={2}
            maxLength={500}
            value={draft.cancellation_note ?? ""}
            onChange={(e) => update({ cancellation_note: e.target.value })}
            placeholder="Ad esempio: per disdire rispondi all'email di conferma."
            className={inputClass + " w-full resize-none"}
          />
        </label>
      </section>

      <section className="bg-white rounded-2xl border border-stone-200 p-6 space-y-5">
        <h2 className="text-lg font-medium">Videochiamata</h2>
        <label className="block text-sm">
          <span className="block text-stone-700 font-medium mb-2">Piattaforma</span>
          <input
            maxLength={60}
            value={draft.video_platform ?? ""}
            onChange={(e) => update({ video_platform: e.target.value })}
            placeholder="Il nome del servizio che usi"
            className={inputClass + " w-full sm:w-80"}
          />
          <span className="block text-xs text-stone-500 mt-1">
            Scegli un servizio con un contratto sul trattamento dei dati e server nell'UE. Evita le app di
            messaggistica.
          </span>
        </label>
        <label className="block text-sm">
          <span className="block text-stone-700 font-medium mb-2">Istruzioni per il paziente (facoltative)</span>
          <textarea
            rows={2}
            maxLength={500}
            value={draft.video_instructions ?? ""}
            onChange={(e) => update({ video_instructions: e.target.value })}
            placeholder="Ad esempio: riceverai il link il giorno prima della seduta."
            className={inputClass + " w-full resize-none"}
          />
        </label>
      </section>

      <section className="bg-sage-50 rounded-2xl border border-sage-200 p-6 text-sm space-y-2">
        <h2 className="text-base font-medium mb-1">Cosa vedrà il paziente prima di pagare</h2>
        <p>
          <strong>Importo:</strong>{" "}
          {terms.online_price_cents !== null ? formatEuro(terms.online_price_cents) : "non impostato"}
        </p>
        <p>
          <strong>Scadenza:</strong> {paymentDeadlineText(terms)}
        </p>
        <p>
          <strong>Disdetta:</strong> {cancellationText(terms)}
        </p>
        <p>
          <strong>Piattaforma usata:</strong> {platformText(terms) ?? "non impostata"}
        </p>
        {videoInstructionsText(terms) && (
          <p>
            <strong>Videochiamata:</strong> {videoInstructionsText(terms)}
          </p>
        )}
      </section>

      <div className="sticky bottom-0 bg-stone-100/95 backdrop-blur py-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div className="text-sm">
          {errors.length > 0 ? (
            <ul role="alert" className="text-red-700 space-y-1">
              {errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          ) : state === "saved" ? (
            <p className="text-sage-700 inline-flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4" /> Impostazioni salvate.
            </p>
          ) : state === "error" ? (
            <p role="alert" className="text-red-700">Le impostazioni non sono state salvate. Riprova.</p>
          ) : null}
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => {
              setDraft(saved);
              setState("idle");
            }}
            disabled={!dirty || state === "saving"}
            className="px-4 py-2 rounded-full border border-stone-300 bg-white text-sm disabled:opacity-50"
          >
            Annulla modifiche
          </button>
          <button
            onClick={() => void save()}
            disabled={!dirty || errors.length > 0 || state === "saving"}
            className="px-5 py-2 rounded-full bg-sage-700 text-white text-sm hover:bg-sage-800 disabled:opacity-50 inline-flex items-center gap-2"
          >
            {state === "saving" && <Loader2 className="w-4 h-4 animate-spin" />}
            Salva
          </button>
        </div>
      </div>
    </main>
  );
}
