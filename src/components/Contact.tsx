import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { MapPin, Phone, Mail, Clock, CheckCircle2, Loader2 } from "lucide-react";

const PRIVACY_VERSION = "2026-11-10";
const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY;

const services = [
  "Psicoterapia individuale",
  "Terapia di coppia",
  "Psicologia clinica",
  "Counseling",
  "Supervisione",
  "Mindfulness",
  "Altro",
];

const inputClass =
  "w-full px-4 py-3 rounded-lg border border-stone-300 bg-clay-50/50 text-stone-800 placeholder-stone-400 focus:outline-none focus:border-sage-500 focus:ring-2 focus:ring-sage-200 transition-all";

export default function Contact() {
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">(
    "idle"
  );
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedService, setSelectedService] = useState(services[0]);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const idempotencyKey = useRef(crypto.randomUUID());

  useEffect(() => {
    // The widget is inactive until VITE_TURNSTILE_SITE_KEY is set. The server
    // enforces Turnstile only when TURNSTILE_SECRET_KEY is configured.
    if (!TURNSTILE_SITE_KEY || document.querySelector("script[data-turnstile]")) return;
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
    script.async = true;
    script.defer = true;
    script.dataset.turnstile = "true";
    document.head.appendChild(script);
  }, []);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    setStatus("sending");
    setErrorMessage("");

    const formData = new FormData(form);
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      setErrorMessage("Invio non disponibile in questo momento.");
      setStatus("error");
      return;
    }

    const turnstileToken = String(formData.get("cf-turnstile-response") || "");
    const payload = {
      name: String(formData.get("name") || "").trim(),
      email: String(formData.get("email") || "").trim(),
      phone: String(formData.get("phone") || ""),
      message: String(formData.get("message") || ""),
      preferred_time: String(formData.get("preferred_time") || ""),
      service: selectedService,
      privacyAccepted: formData.get("privacy_accepted") === "on",
      privacyVersion: PRIVACY_VERSION,
      idempotencyKey: idempotencyKey.current,
      turnstileToken,
      company_website: String(formData.get("company_website") || ""),
    };

    try {
      const response = await fetch(
        `${supabaseUrl}/functions/v1/send-confirmation-email`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${supabaseAnonKey}`,
            apikey: supabaseAnonKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );
      const result = (await response.json().catch(() => null)) as { received?: boolean; code?: string } | null;

      if (!response.ok || !result?.received) {
        setErrorMessage(
          result?.code === "rate_limited"
            ? "Hai inviato troppe richieste. Riprova più tardi."
            : "Non è stato possibile inviare la richiesta. Riprova più tardi.",
        );
        setStatus("error");
        return;
      }
    } catch {
      setErrorMessage("Non è stato possibile inviare la richiesta. Riprova più tardi.");
      setStatus("error");
      return;
    }

    idempotencyKey.current = crypto.randomUUID();
    setStatus("success");
    form.reset();
    setSelectedService(services[0]);
    setPrivacyAccepted(false);
  };

  return (
    <section id="contact" className="py-24 md:py-32 bg-sage-700 text-clay-50">
      <div className="max-w-6xl mx-auto px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16">
          <div className="reveal">
            <p className="text-sm tracking-wider-2 uppercase text-sage-300 mb-4">
              Contatti
            </p>
            <h2 className="text-4xl md:text-5xl font-light leading-tight mb-6">
              Iniziamo a
              <br />
              <span className="italic text-sage-200">parlarne insieme</span>
            </h2>
            <p className="text-sage-100/80 leading-relaxed mb-10 max-w-md">
              Compila il modulo o contattami direttamente. Rispondo entro 24
              ore per fissare una prima consulenza, senza impegno.
            </p>

            <div className="space-y-6">
              <div className="flex gap-4">
                <span className="flex-shrink-0 flex items-center justify-center w-12 h-12 rounded-full bg-sage-600/50 text-sage-200">
                  <MapPin className="w-5 h-5" strokeWidth={1.5} />
                </span>
                <div>
                  <h3 className="font-medium mb-1">Studio</h3>
                  <p className="text-sm text-sage-100/70">
                    Via dei Colli 18, Padova
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <span className="flex-shrink-0 flex items-center justify-center w-12 h-12 rounded-full bg-sage-600/50 text-sage-200">
                  <Phone className="w-5 h-5" strokeWidth={1.5} />
                </span>
                <div>
                  <h3 className="font-medium mb-1">Telefono</h3>
                  <p className="text-sm text-sage-100/70">+39 340 123 4567</p>
                </div>
              </div>
              <div className="flex gap-4">
                <span className="flex-shrink-0 flex items-center justify-center w-12 h-12 rounded-full bg-sage-600/50 text-sage-200">
                  <Mail className="w-5 h-5" strokeWidth={1.5} />
                </span>
                <div>
                  <h3 className="font-medium mb-1">Email</h3>
                  <p className="text-sm text-sage-100/70">
                    jerardadamarisceglia@gmail.com
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <span className="flex-shrink-0 flex items-center justify-center w-12 h-12 rounded-full bg-sage-600/50 text-sage-200">
                  <Clock className="w-5 h-5" strokeWidth={1.5} />
                </span>
                <div>
                  <h3 className="font-medium mb-1">Orari</h3>
                  <p className="text-sm text-sage-100/70">
                    Lun – Ven: 9:00 – 19:00
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="reveal">
            {status === "success" ? (
              <div className="bg-clay-50 rounded-2xl p-10 text-center h-full flex flex-col items-center justify-center">
                <CheckCircle2 className="w-16 h-16 text-sage-600 mb-5" strokeWidth={1.2} />
                <h3 className="text-2xl text-stone-800 font-medium mb-3">
                  Messaggio ricevuto
                </h3>
                <p className="text-stone-600 leading-relaxed mb-6 max-w-sm">
                  Grazie per avermi contattata. Ho ricevuto la tua richiesta e
                  ti risponderò entro 24 ore.
                </p>
                <button
                  onClick={() => setStatus("idle")}
                  className="px-6 py-3 rounded-full border border-sage-300 text-sage-700 text-sm hover:bg-sage-50 transition-colors"
                >
                  Invia un altro messaggio
                </button>
              </div>
            ) : (
              <form
                onSubmit={handleSubmit}
                className="relative bg-clay-50 rounded-2xl p-8 md:p-10 space-y-5"
              >
                <div className="absolute -left-[9999px] h-px w-px overflow-hidden" aria-hidden="true">
                  <label>
                    Sito web
                    <input
                      name="company_website"
                      type="text"
                      tabIndex={-1}
                      autoComplete="off"
                    />
                  </label>
                </div>
                <div className="grid sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm text-stone-700 mb-2 font-medium">
                      Nome *
                    </label>
                    <input
                      name="name"
                      required
                      className={inputClass}
                      placeholder="Il tuo nome"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-stone-700 mb-2 font-medium">
                      Telefono
                    </label>
                    <input
                      name="phone"
                      className={inputClass}
                      placeholder="Opzionale"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-stone-700 mb-2 font-medium">
                    Email *
                  </label>
                  <input
                    name="email"
                    type="email"
                    required
                    className={inputClass}
                    placeholder="la-tua@email.it"
                  />
                </div>

                <div>
                  <label className="block text-sm text-stone-700 mb-2 font-medium">
                    Servizio di interesse
                  </label>
                  <select
                    value={selectedService}
                    onChange={(e) => setSelectedService(e.target.value)}
                    className={inputClass}
                  >
                    {services.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-stone-700 mb-2 font-medium">
                    Orario preferito
                  </label>
                  <input
                    name="preferred_time"
                    className={inputClass}
                    placeholder="Es. mattina, martedì pomeriggio"
                  />
                </div>

                <div>
                  <label className="block text-sm text-stone-700 mb-2 font-medium">
                    Messaggio *
                  </label>
                  <textarea
                    name="message"
                    required
                    maxLength={2000}
                    rows={4}
                    className={inputClass + " resize-none"}
                    placeholder="Raccontami brevemente come posso aiutarti..."
                  />
                  <p className="mt-2 text-xs text-stone-500 leading-relaxed">
                    Non inserire informazioni cliniche, diagnosi o dettagli
                    sanitari in questo modulo.
                  </p>
                </div>

                <label className="flex items-start gap-3 text-sm text-stone-700">
                  <input
                    name="privacy_accepted"
                    type="checkbox"
                    required
                    checked={privacyAccepted}
                    onChange={(e) => setPrivacyAccepted(e.target.checked)}
                    className="mt-1"
                  />
                  <span>
                    Acconsento al trattamento dei dati inseriti per essere
                    ricontattato, come descritto nell'informativa privacy.
                  </span>
                </label>

                {TURNSTILE_SITE_KEY ? (
                  <div
                    className="cf-turnstile"
                    data-sitekey={TURNSTILE_SITE_KEY}
                  />
                ) : null}

                {status === "error" && (
                  <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3 border border-red-200">
                    {errorMessage ||
                      "Si è verificato un errore. Riprova o contattami direttamente via email."}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={status === "sending" || !privacyAccepted}
                  className="w-full px-6 py-4 rounded-full bg-sage-600 text-clay-50 text-sm tracking-wide hover:bg-sage-700 transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {status === "sending" ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Invio in corso...
                    </>
                  ) : (
                    "Invia richiesta"
                  )}
                </button>

                <p className="text-xs text-stone-500 text-center">
                  I tuoi dati sono trattati con totale riservatezza, secondo la
                  normativa sulla privacy.
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
