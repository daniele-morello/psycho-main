import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { MapPin, Phone, Mail, Clock, CheckCircle2, Loader2 } from "lucide-react";
import PrivacyNoticeDialog from "@/components/PrivacyNoticeDialog";

const PRIVACY_VERSION = "2026-11-23";
const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY;

const services = [
  "Psicoterapia individuale",
  "Terapia di coppia",
  "Psicologia clinica",
  "Altro",
];

const inputClass =
  "w-full px-4 py-3 rounded-lg border border-stone-300 bg-clay-50/50 text-stone-800 placeholder-stone-400 focus:outline-none focus:border-sage-500 focus:ring-2 focus:ring-sage-200 transition-all";
const consultationModes = ["Online", "In presenza"] as const;
const CONSULTATION_REQUIRED_MESSAGE = "Seleziona la modalità della consulenza";
const PERSON_NAME = /^[\p{L}][\p{L}\p{M}\s'\u2018\u2019\u02BC-]{0,79}$/u;
const PHONE_NUMBER = /^\+?[0-9]{6,30}$/;
const EMAIL_ADDRESS = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STUDIO_ADDRESS = "Via dei Colli 18, Padova";
const STUDIO_PHONE_TEXT = "+39 340 123 4567";
const STUDIO_PHONE_LINK = "tel:+393401234567";
const STUDIO_EMAIL = "jerardadamarisceglia@gmail.com";
const contactLinkClass =
  "text-sm text-sage-100/70 no-underline select-text rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-200";

function personNameError(value: string, label: "nome" | "cognome"): string {
  const text = value.trim();
  if (!text) return `Inserisci il ${label}.`;
  if (!PERSON_NAME.test(text)) {
    return `Il ${label} può contenere solo lettere, spazi, apostrofi e trattini, senza numeri.`;
  }
  return "";
}

function emailError(value: string): string {
  const text = value.trim();
  if (!text) return "Inserisci un indirizzo email.";
  if (!EMAIL_ADDRESS.test(text) || text.length > 254) {
    return "Inserisci un indirizzo email valido, ad esempio nome@dominio.it.";
  }
  return "";
}

function phoneError(value: string): string {
  const text = value.trim();
  if (!text) return "";
  const digits = text.startsWith("+") ? text.slice(1) : text;
  if (/^[0-9]+$/.test(digits) && digits.length < 6) {
    return "Il numero deve contenere almeno 6 cifre. Puoi aggiungere un + all'inizio.";
  }
  if (!PHONE_NUMBER.test(text)) {
    return "Inserisci solo cifre, con un eventuale + all'inizio.";
  }
  return "";
}

export default function Contact() {
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">(
    "idle"
  );
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedService, setSelectedService] = useState(services[0]);
  const [consultationMode, setConsultationMode] = useState("");
  const [consultationError, setConsultationError] = useState("");
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({
    name: "",
    surname: "",
    email: "",
    phone: "",
  });
  const [privacyOpen, setPrivacyOpen] = useState(false);
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
    const formData = new FormData(form);
    const name = String(formData.get("name") || "");
    const surname = String(formData.get("surname") || "");
    const email = String(formData.get("email") || "");
    const phone = String(formData.get("phone") || "");
    const nextErrors = {
      name: personNameError(name, "nome"),
      surname: personNameError(surname, "cognome"),
      email: emailError(email),
      phone: phoneError(phone),
    };
    setFieldErrors(nextErrors);
    const fields = ["name", "surname", "email", "phone"] as const;
    fields.forEach((field) => {
      const element = form.elements.namedItem(field);
      if (element instanceof HTMLInputElement) {
        element.setCustomValidity(nextErrors[field]);
      }
    });
    const firstInvalid = fields.find((field) => nextErrors[field]);
    if (firstInvalid) {
      const field = form.elements.namedItem(firstInvalid);
      if (field instanceof HTMLInputElement) field.reportValidity();
      setErrorMessage("");
      setStatus("idle");
      return;
    }

    setStatus("sending");
    setErrorMessage("");
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      setErrorMessage("Invio non disponibile in questo momento.");
      setStatus("error");
      return;
    }

    const turnstileToken = String(formData.get("cf-turnstile-response") || "");
    const payload = {
      name: name.trim(),
      surname: surname.trim(),
      email: email.trim(),
      phone: phone.trim(),
      message: String(formData.get("message") || "").trim(),
      preferred_time: String(formData.get("preferred_time") || ""),
      service: selectedService,
      consultation_mode: consultationMode,
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
    setConsultationMode("");
    setConsultationError("");
    setFieldErrors({ name: "", surname: "", email: "", phone: "" });
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
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(STUDIO_ADDRESS)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-allow-select=""
                    className={contactLinkClass}
                  >
                    {STUDIO_ADDRESS}
                    <span className="sr-only">, apre Google Maps</span>
                  </a>
                </div>
              </div>
              <div className="flex gap-4">
                <span className="flex-shrink-0 flex items-center justify-center w-12 h-12 rounded-full bg-sage-600/50 text-sage-200">
                  <Phone className="w-5 h-5" strokeWidth={1.5} />
                </span>
                <div>
                  <h3 className="font-medium mb-1">Telefono</h3>
                  <a href={STUDIO_PHONE_LINK} data-allow-select="" className={contactLinkClass}>
                    {STUDIO_PHONE_TEXT}
                  </a>
                </div>
              </div>
              <div className="flex gap-4">
                <span className="flex-shrink-0 flex items-center justify-center w-12 h-12 rounded-full bg-sage-600/50 text-sage-200">
                  <Mail className="w-5 h-5" strokeWidth={1.5} />
                </span>
                <div>
                  <h3 className="font-medium mb-1">Email</h3>
                  <a
                    href={`mailto:${STUDIO_EMAIL}`}
                    data-allow-select=""
                    className={contactLinkClass}
                  >
                    {STUDIO_EMAIL}
                  </a>
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
                <div className="sr-only" aria-hidden="true">
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
                      autoComplete="given-name"
                      aria-invalid={fieldErrors.name ? true : undefined}
                      aria-describedby={fieldErrors.name ? "name-error" : undefined}
                      className={inputClass}
                      placeholder="Il tuo nome"
                      onInput={(event) => event.currentTarget.setCustomValidity("")}
                      onBlur={(event) => {
                        const message = event.currentTarget.value.trim()
                          ? personNameError(event.currentTarget.value, "nome")
                          : "";
                        setFieldErrors((prev) =>
                          prev.name === message ? prev : { ...prev, name: message },
                        );
                      }}
                    />
                    {fieldErrors.name && (
                      <p id="name-error" role="alert" className="mt-2 text-xs text-red-700">
                        {fieldErrors.name}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm text-stone-700 mb-2 font-medium">
                      Cognome *
                    </label>
                    <input
                      name="surname"
                      required
                      autoComplete="family-name"
                      aria-invalid={fieldErrors.surname ? true : undefined}
                      aria-describedby={fieldErrors.surname ? "surname-error" : undefined}
                      className={inputClass}
                      placeholder="Il tuo cognome"
                      onInput={(event) => event.currentTarget.setCustomValidity("")}
                      onBlur={(event) => {
                        const message = event.currentTarget.value.trim()
                          ? personNameError(event.currentTarget.value, "cognome")
                          : "";
                        setFieldErrors((prev) =>
                          prev.surname === message ? prev : { ...prev, surname: message },
                        );
                      }}
                    />
                    {fieldErrors.surname && (
                      <p id="surname-error" role="alert" className="mt-2 text-xs text-red-700">
                        {fieldErrors.surname}
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-stone-700 mb-2 font-medium">
                    Telefono
                  </label>
                  <input
                    name="phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    pattern="\+?[0-9]{6,30}"
                    aria-invalid={fieldErrors.phone ? true : undefined}
                    aria-describedby={fieldErrors.phone ? "phone-error" : undefined}
                    className={inputClass}
                    placeholder="Opzionale"
                    title="Inserisci solo cifre, con un eventuale + all'inizio."
                    onInput={(event) => {
                      event.currentTarget.setCustomValidity("");
                      if (!phoneError(event.currentTarget.value)) {
                        setFieldErrors((prev) => ({ ...prev, phone: "" }));
                      }
                    }}
                    onBlur={(event) => {
                      const message = phoneError(event.currentTarget.value);
                      setFieldErrors((prev) =>
                        prev.phone === message ? prev : { ...prev, phone: message },
                      );
                    }}
                    onInvalid={(event) => {
                      const message = phoneError(event.currentTarget.value);
                      if (!message) return;
                      setFieldErrors((prev) =>
                        prev.phone === message ? prev : { ...prev, phone: message },
                      );
                    }}
                  />
                  {fieldErrors.phone && (
                    <p id="phone-error" role="alert" className="mt-2 text-xs text-red-700">
                      {fieldErrors.phone}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm text-stone-700 mb-2 font-medium">
                    Email *
                  </label>
                  <input
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    aria-invalid={fieldErrors.email ? true : undefined}
                    aria-describedby={fieldErrors.email ? "email-error" : undefined}
                    className={inputClass}
                    placeholder="la-tua@email.it"
                    onInput={(event) => {
                      event.currentTarget.setCustomValidity("");
                      if (!emailError(event.currentTarget.value)) {
                        setFieldErrors((prev) => ({ ...prev, email: "" }));
                      }
                    }}
                    onBlur={(event) => {
                      const message = event.currentTarget.value.trim()
                        ? emailError(event.currentTarget.value)
                        : "";
                      setFieldErrors((prev) =>
                        prev.email === message ? prev : { ...prev, email: message },
                      );
                    }}
                    onInvalid={(event) => {
                      const message = event.currentTarget.value.trim()
                        ? emailError(event.currentTarget.value)
                        : "";
                      if (!message) return;
                      setFieldErrors((prev) =>
                        prev.email === message ? prev : { ...prev, email: message },
                      );
                    }}
                  />
                  {fieldErrors.email && (
                    <p id="email-error" role="alert" className="mt-2 text-xs text-red-700">
                      {fieldErrors.email}
                    </p>
                  )}
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
                  <label
                    htmlFor="consultation_mode"
                    className="block text-sm text-stone-700 mb-2 font-medium"
                  >
                    Come preferisci svolgere la consulenza? *
                  </label>
                  <select
                    id="consultation_mode"
                    name="consultation_mode"
                    required
                    value={consultationMode}
                    aria-invalid={consultationError ? true : undefined}
                    aria-describedby={consultationError ? "consultation-mode-error" : undefined}
                    onChange={(event) => {
                      const value = event.target.value;
                      setConsultationMode(value);
                      if (value === "Online" || value === "In presenza") {
                        setConsultationError("");
                      }
                    }}
                    onInvalid={(event) => {
                      event.preventDefault();
                      setConsultationError((prev) =>
                        prev === CONSULTATION_REQUIRED_MESSAGE
                          ? prev
                          : CONSULTATION_REQUIRED_MESSAGE,
                      );
                    }}
                    className={inputClass}
                  >
                    <option value="">Seleziona</option>
                    {consultationModes.map((mode) => (
                      <option key={mode} value={mode}>
                        {mode}
                      </option>
                    ))}
                  </select>
                  {consultationError && (
                    <p
                      id="consultation-mode-error"
                      role="alert"
                      className="mt-2 text-xs text-red-700"
                    >
                      {consultationError}
                    </p>
                  )}
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
                    Messaggio
                  </label>
                  <textarea
                    name="message"
                    maxLength={2000}
                    rows={4}
                    aria-describedby="message-hint"
                    className={inputClass + " resize-none"}
                    placeholder="Opzionale"
                  />
                  <p id="message-hint" className="mt-2 text-xs text-stone-500 leading-relaxed">
                    Non inserire qui dettagli sulla tua salute: ne parleremo al
                    primo colloquio.
                  </p>
                </div>

                <div className="flex items-start gap-3 text-sm text-stone-700 leading-relaxed">
                  <input
                    id="privacy_accepted"
                    name="privacy_accepted"
                    type="checkbox"
                    required
                    checked={privacyAccepted}
                    onChange={(e) => setPrivacyAccepted(e.target.checked)}
                    className="mt-1"
                  />
                  <p>
                    <label htmlFor="privacy_accepted">
                      Chiedo di essere ricontattato riguardo a questa richiesta
                      e dichiaro di aver letto l'
                    </label>
                    <a
                      href={`${import.meta.env.BASE_URL}informativa-privacy.html`}
                      className="text-sage-700 underline underline-offset-2 hover:text-sage-800"
                      onClick={(event) => {
                        if (
                          event.metaKey ||
                          event.ctrlKey ||
                          event.shiftKey ||
                          event.altKey ||
                          event.button !== 0
                        ) {
                          return;
                        }
                        event.preventDefault();
                        setPrivacyOpen(true);
                      }}
                    >
                      Informativa sulla Privacy
                    </a>
                    <label htmlFor="privacy_accepted">.</label>
                  </p>
                </div>

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
      <PrivacyNoticeDialog open={privacyOpen} onClose={() => setPrivacyOpen(false)} />
    </section>
  );
}
