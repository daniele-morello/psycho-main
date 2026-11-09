import { useState } from "react";
import type { FormEvent } from "react";
import { MapPin, Phone, Mail, Clock, CheckCircle2, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

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
  const [sentTo, setSentTo] = useState("");
  const [selectedService, setSelectedService] = useState(services[0]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    setStatus("sending");
    setErrorMessage("");

    const formData = new FormData(form);
    const payload = {
      name: String(formData.get("name") || "").trim(),
      surname: String(formData.get("surname") || "").trim(),
      email: String(formData.get("email") || "").trim(),
      phone: String(formData.get("phone") || ""),
      message: String(formData.get("message") || ""),
      preferred_time: String(formData.get("preferred_time") || ""),
      service: selectedService,
    };

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!supabase || !supabaseUrl || !supabaseAnonKey) {
      setErrorMessage(
        "Invio non configurato: mancano le variabili Supabase nel file .env."
      );
      setStatus("error");
      return;
    }

    const { error } = await supabase.from("contact_requests").insert(payload);

    if (error) {
      setErrorMessage(
        "Non sono riuscita a registrare la richiesta. Riprova o scrivimi direttamente."
      );
      setStatus("error");
      return;
    }

    try {
      const res = await fetch(
        `${supabaseUrl}/functions/v1/send-confirmation-email`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${supabaseAnonKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );
      const body = (await res.json().catch(() => null)) as {
        emailSent?: boolean;
        error?: string;
      } | null;

      if (!res.ok || !body?.emailSent) {
        setErrorMessage(
          body?.error ||
            "La richiesta è salvata, ma la mail di conferma al mittente non è partita."
        );
        setStatus("error");
        return;
      }
    } catch {
      setErrorMessage(
        "La richiesta è salvata, ma la mail di conferma al mittente non è partita."
      );
      setStatus("error");
      return;
    }

    setSentTo(payload.email);
    setStatus("success");
    form.reset();
    setSelectedService(services[0]);
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
                  Grazie per avermi contattata. Una mail di conferma è in
                  arrivo su {sentTo}. Ti risponderò entro 24 ore per fissare la
                  prima consulenza.
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
                className="bg-clay-50 rounded-2xl p-8 md:p-10 space-y-5"
              >
                <div className="grid sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm text-stone-700 mb-2 font-medium">
                      Nome *
                    </label>
                    <input
                      name="name"
                      required
                      autoComplete="given-name"
                      className={inputClass}
                      placeholder="Il tuo nome"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-stone-700 mb-2 font-medium">
                      Cognome *
                    </label>
                    <input
                      name="surname"
                      required
                      autoComplete="family-name"
                      className={inputClass}
                      placeholder="Il tuo cognome"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-stone-700 mb-2 font-medium">
                    Telefono
                  </label>
                  <input
                    name="phone"
                    autoComplete="tel"
                    className={inputClass}
                    placeholder="Opzionale"
                  />
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
                    rows={4}
                    className={inputClass + " resize-none"}
                    placeholder="Raccontami brevemente come posso aiutarti..."
                  />
                </div>

                {status === "error" && (
                  <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3 border border-red-200">
                    {errorMessage ||
                      "Si è verificato un errore. Riprova o contattami direttamente via email."}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={status === "sending"}
                  className="w-full px-6 py-4 rounded-full bg-sage-600 text-clay-50 text-sm tracking-wide hover:bg-sage-700 transition-all duration-300 disabled:opacity-60 flex items-center justify-center gap-2"
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
