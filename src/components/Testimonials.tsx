import { Quote } from "lucide-react";

const testimonials = [
  {
    text: "Ho trovato in Jerarda un ascolto profondo e autentico. Mi ha aiutato a comprendere le mie paure e a ritrovare un equilibrio che credevo perduto. Un percorso che ha cambiato davvero la mia vita.",
    author: "Giulia M.",
    context: "Percorso individuale",
  },
  {
    text: "Arrivammo in studio in piena crisi. Oggi possiamo dire che la terapia ci ha salvato. Jerarda sa creare un clima dove entrambi ci siamo sentiti compresi e rispettati.",
    author: "Marco e Sara",
    context: "Terapia di coppia",
  },
  {
    text: "Dopo anni di ansia che mi paralizzava, finalmente sento di avere strumenti concreti. La professionalità di Jerarda unita alla sua umanità rende ogni incontro prezioso.",
    author: "Davide R.",
    context: "Ansia e stress",
  },
];

export default function Testimonials() {
  return (
    <section className="py-24 md:py-32 bg-stone-100">
      <div className="max-w-6xl mx-auto px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-16 reveal">
          <p className="text-sm tracking-wider-2 uppercase text-sage-600 mb-4">
            Le storie
          </p>
          <h2 className="text-4xl md:text-5xl text-stone-800 font-light leading-tight">
            Percorsi di cambiamento
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {testimonials.map((t, i) => (
            <figure
              key={t.author}
              className="reveal bg-clay-50 rounded-2xl p-8 border border-stone-200"
              style={{ transitionDelay: `${i * 120}ms` }}
            >
              <Quote className="w-8 h-8 text-sage-300 mb-4" strokeWidth={1} />
              <blockquote className="text-stone-700 leading-relaxed italic mb-6">
                "{t.text}"
              </blockquote>
              <figcaption>
                <p className="font-medium text-stone-800">{t.author}</p>
                <p className="text-sm text-sage-600 mt-1">{t.context}</p>
              </figcaption>
            </figure>
          ))}
        </div>

        <p className="text-center text-xs text-stone-500 mt-12 reveal">
          I testimonianze sono riportate con il consenso degli interessati. Nomi
          e dettagli sono stati modificati per tutelare la riservatezza.
        </p>
      </div>
    </section>
  );
}
