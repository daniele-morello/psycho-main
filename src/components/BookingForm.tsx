import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { CalendarCheck, CheckCircle2, Loader2 } from "lucide-react";
import { emailError, personNameError, phoneError } from "@/lib/validation";

// Prenotazione del primo colloquio.
//
// Mostra solo le fasce libere calcolate dal server (orari, blocchi, festività,
// calendario e prenotazioni già fatte). Chiede solo i dati necessari a fissare
// l'appuntamento: niente messaggio, niente motivo della richiesta.

const PRIVACY_VERSION = "2026-11-24";
const TZ = "Europe/Rome";

const inputClass =
  "w-full px-4 py-3 rounded-lg border border-stone-300 bg-clay-50/50 text-stone-800 placeholder-stone-400 focus:outline-none focus:border-sage-500 focus:ring-2 focus:ring-sage-200 transition-all";
const chipClass = (active: boolean) =>
  "px-3 py-2 rounded-lg border text-sm transition-colors " +
  (active
    ? "bg-sage-600 border-sage-600 text-clay-50"
    : "bg-white border-stone-300 text-stone-700 hover:border-sage-400");

const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const dayShort = new Intl.DateTimeFormat("it-IT", { timeZone: TZ, weekday: "short", day: "numeric", month: "short" });
const dayLong = new Intl.DateTimeFormat("it-IT", { timeZone: TZ, weekday: "long", day: "numeric", month: "long", year: "numeric" });
const timeFmt = new Intl.DateTimeFormat("it-IT", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });

type Availability = { slots: string[]; online: boolean; calendar: string };
type Mode = "in_presenza" | "online";

const functionsUrl = (name: string) => `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${name}`;
const headers = () => ({
  Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
  apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
  "Content-Type": "application/json",
});

export default function BookingForm({ onOpenPrivacy }: { onOpenPrivacy: () => void }) {
  const [data, setData] = useState<Availability | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [day, setDay] = useState<string | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("in_presenza");
  const [adult, setAdult] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [message, setMessage] = useState("");
  const [booked, setBooked] = useState<{ when: string; mode: Mode } | null>(null);
  const idempotencyKey = useRef(crypto.randomUUID());

  const load = useCallback(async () => {
    setLoadError(false);
    try {
      const response = await fetch(functionsUrl("availability"), { headers: headers() });
      if (!response.ok) throw new Error();
      setData((await response.json()) as Availability);
    } catch {
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    if (import.meta.env.VITE_SUPABASE_URL) void load();
    else setLoadError(true);
  }, [load]);

  const days = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const s of data?.slots ?? []) {
      const key = dayKey.format(new Date(s));
      map.set(key, [...(map.get(key) ?? []), s]);
    }
    return map;
  }, [data]);

  const selectedDay = day && days.has(day) ? day : null;

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const name = String(f.get("name") || "");
    const surname = String(f.get("surname") || "");
    const email = String(f.get("email") || "");
    const phone = String(f.get("phone") || "");
    const next: Record<string, string> = {
      slot: slot ? "" : "Scegli giorno e orario.",
      name: personNameError(name, "nome"),
      surname: personNameError(surname, "cognome"),
      email: emailError(email),
      phone: phoneError(phone),
      adult: adult ? "" : "La prenotazione online è riservata ai maggiorenni.",
    };
    setErrors(next);
    if (Object.values(next).some(Boolean) || !privacy || !slot) return;

    setStatus("sending");
    setMessage("");
    try {
      const response = await fetch(functionsUrl("book"), {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          name: name.trim(),
          surname: surname.trim(),
          email: email.trim(),
          phone: phone.trim(),
          start: slot,
          mode,
          adult: true,
          privacyAccepted: true,
          privacyVersion: PRIVACY_VERSION,
          idempotencyKey: idempotencyKey.current,
          company_website: String(f.get("company_website") || ""),
        }),
      });
      const result = (await response.json().catch(() => null)) as { received?: boolean; code?: string } | null;
      if (response.ok && result?.received) {
        setBooked({ when: slot, mode });
        setStatus("done");
        idempotencyKey.current = crypto.randomUUID();
        return;
      }
      setStatus("error");
      if (result?.code === "slot_taken") {
        setMessage("Questo orario è appena stato prenotato da qualcun altro. Scegline un altro.");
        setSlot(null);
        void load();
      } else if (result?.code === "rate_limited") {
        setMessage("Hai inviato troppe richieste. Riprova più tardi.");
      } else {
        setMessage("Non è stato possibile inviare la prenotazione. Riprova più tardi.");
      }
    } catch {
      setStatus("error");
      setMessage("Non è stato possibile inviare la prenotazione. Riprova più tardi.");
    }
  };

  if (status === "done" && booked) {
    return (
      <div className="bg-clay-50 rounded-2xl p-10 text-center h-full flex flex-col items-center justify-center">
        <CheckCircle2 className="w-16 h-16 text-sage-600 mb-5" strokeWidth={1.2} />
        <h3 className="text-2xl text-stone-800 font-medium mb-3">Richiesta inviata</h3>
        <p className="text-stone-600 leading-relaxed mb-2 max-w-sm">
          Hai chiesto un primo colloquio {booked.mode === "online" ? "online" : "in presenza"}{" "}
          <strong>{dayLong.format(new Date(booked.when))}</strong> alle{" "}
          <strong>{timeFmt.format(new Date(booked.when))}</strong>.
        </p>
        <p className="text-stone-600 leading-relaxed max-w-sm">
          L'orario resta riservato per te.{" "}
          {booked.mode === "online"
            ? "Se è disponibile ti invierò le coordinate per il bonifico: l'appuntamento sarà confermato quando lo riceverò."
            : "Ti scriverò per confermare l'appuntamento."}
        </p>
      </div>
    );
  }

  const noSlots = data && (data.calendar !== "ok" || data.slots.length === 0);

  return (
    <form onSubmit={(e) => void submit(e)} className="relative bg-clay-50 rounded-2xl p-8 md:p-10 space-y-5">
      <div className="sr-only" aria-hidden="true">
        <label>
          Sito web
          <input name="company_website" type="text" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <div>
        <p className="block text-sm text-stone-700 mb-2 font-medium">Giorno *</p>
        {loadError ? (
          <p className="text-sm text-red-700">
            Non riesco a caricare gli orari disponibili. Riprova più tardi o usa «Chiedo informazioni».
          </p>
        ) : !data ? (
          <Loader2 className="w-5 h-5 animate-spin text-sage-600" />
        ) : noSlots ? (
          <p className="text-sm text-stone-600">
            Al momento non ci sono orari prenotabili online. Scrivimi con «Chiedo informazioni» e troveremo un
            momento insieme.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2" role="group" aria-label="Giorni disponibili">
            {[...days.entries()].slice(0, 14).map(([key, slots]) => (
              <button
                key={key}
                type="button"
                aria-pressed={selectedDay === key}
                onClick={() => {
                  setDay(key);
                  setSlot(null);
                }}
                className={chipClass(selectedDay === key) + " capitalize"}
              >
                {dayShort.format(new Date(slots[0]))}
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedDay && (
        <div>
          <p className="block text-sm text-stone-700 mb-2 font-medium">Orario *</p>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Orari disponibili">
            {(days.get(selectedDay) ?? []).map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={slot === s}
                onClick={() => setSlot(s)}
                className={chipClass(slot === s)}
              >
                {timeFmt.format(new Date(s))}
              </button>
            ))}
          </div>
        </div>
      )}
      {errors.slot && <p role="alert" className="text-xs text-red-700">{errors.slot}</p>}

      {data?.online ? (
        <div>
          <p className="block text-sm text-stone-700 mb-2 font-medium">Modalità *</p>
          <div className="flex gap-2" role="group" aria-label="Modalità">
            <button type="button" aria-pressed={mode === "in_presenza"} onClick={() => setMode("in_presenza")} className={chipClass(mode === "in_presenza")}>
              In presenza
            </button>
            <button type="button" aria-pressed={mode === "online"} onClick={() => setMode("online")} className={chipClass(mode === "online")}>
              Online
            </button>
          </div>
          {mode === "online" && (
            <p className="mt-2 text-xs text-stone-500">
              La seduta online si paga in anticipo con bonifico: se l'orario è disponibile riceverai le coordinate via
              email, e l'appuntamento sarà confermato quando il bonifico arriva.
            </p>
          )}
        </div>
      ) : (
        data && !noSlots && <p className="text-sm text-stone-600">Il primo colloquio si svolge in presenza, allo studio.</p>
      )}

      <div className="grid sm:grid-cols-2 gap-5">
        <label className="block">
          <span className="block text-sm text-stone-700 mb-2 font-medium">Nome *</span>
          <input name="name" required autoComplete="given-name" className={inputClass} placeholder="Il tuo nome" />
          {errors.name && <span role="alert" className="block mt-2 text-xs text-red-700">{errors.name}</span>}
        </label>
        <label className="block">
          <span className="block text-sm text-stone-700 mb-2 font-medium">Cognome *</span>
          <input name="surname" required autoComplete="family-name" className={inputClass} placeholder="Il tuo cognome" />
          {errors.surname && <span role="alert" className="block mt-2 text-xs text-red-700">{errors.surname}</span>}
        </label>
      </div>
      <label className="block">
        <span className="block text-sm text-stone-700 mb-2 font-medium">Email *</span>
        <input name="email" type="email" required autoComplete="email" className={inputClass} placeholder="la-tua@email.it" />
        {errors.email && <span role="alert" className="block mt-2 text-xs text-red-700">{errors.email}</span>}
      </label>
      <label className="block">
        <span className="block text-sm text-stone-700 mb-2 font-medium">Telefono</span>
        <input name="phone" type="tel" inputMode="tel" autoComplete="tel" className={inputClass} placeholder="Opzionale" />
        {errors.phone && <span role="alert" className="block mt-2 text-xs text-red-700">{errors.phone}</span>}
      </label>

      <label className="flex items-start gap-3 text-sm text-stone-700 leading-relaxed">
        <input type="checkbox" checked={adult} onChange={(e) => setAdult(e.target.checked)} className="mt-1" />
        <span>Dichiaro di essere maggiorenne. *</span>
      </label>
      {errors.adult && (
        <p role="alert" className="text-xs text-red-700 -mt-3">
          {errors.adult} Per un minore usa «Chiedo informazioni».
        </p>
      )}

      <div className="flex items-start gap-3 text-sm text-stone-700 leading-relaxed">
        <input
          id="booking_privacy"
          type="checkbox"
          required
          checked={privacy}
          onChange={(e) => setPrivacy(e.target.checked)}
          className="mt-1"
        />
        <p>
          <label htmlFor="booking_privacy">Chiedo di fissare questo appuntamento e dichiaro di aver letto l'</label>
          <a
            href={`${import.meta.env.BASE_URL}informativa-privacy.html`}
            className="text-sage-700 underline underline-offset-2 hover:text-sage-800"
            onClick={(event) => {
              if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
              event.preventDefault();
              onOpenPrivacy();
            }}
          >
            Informativa sulla Privacy
          </a>
          <label htmlFor="booking_privacy">.</label>
        </p>
      </div>

      {status === "error" && message && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3 border border-red-200">{message}</p>
      )}

      <button
        type="submit"
        disabled={status === "sending" || !privacy || !data || Boolean(noSlots)}
        className="w-full px-6 py-4 rounded-full bg-sage-600 text-clay-50 text-sm tracking-wide hover:bg-sage-700 transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {status === "sending" ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" /> Invio in corso...
          </>
        ) : (
          <>
            <CalendarCheck className="w-4 h-4" /> Prenota il primo colloquio
          </>
        )}
      </button>
    </form>
  );
}
