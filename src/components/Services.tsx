import { Heart, Users, Sparkles, Brain, BookOpen, Sun } from "lucide-react";

const services = [
  {
    icon: Heart,
    title: "Psicoterapia individuale",
    text: "Ansia, depressione, stress, elaborazione del lutto, difficoltà relazionali e momenti di transizione della vita.",
  },
  {
    icon: Users,
    title: "Terapia di coppia",
    text: "Comunicazione, conflitti, crisi relazionali e ricostruzione della complicità in un clima neutro e costruttivo.",
  },
  {
    icon: Brain,
    title: "Psicologia clinica",
    text: "Valutazione psicodiagnostica, consulenza e supporto per difficoltà emotive e psicologiche.",
  },
  {
    icon: Sparkles,
    title: "Counseling",
    text: "Percorsi brevi di supporto per affrontare sfide specifiche e prendere decisioni con maggiore chiarezza.",
  },
  {
    icon: BookOpen,
    title: "Supervisione",
    text: "Supervisione clinica per colleghi psicologi e psicoterapeuti in formazione o in attività professionale.",
  },
  {
    icon: Sun,
    title: "Percorsi di mindfulness",
    text: "Tecniche di gestione dello stress, mindfulness e meditazione per coltivare consapevolezza ed equilibrio.",
  },
];

export default function Services() {
  return (
    <section id="services" className="py-24 md:py-32 bg-clay-50">
      <div className="max-w-6xl mx-auto px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-16 reveal">
          <p className="text-sm tracking-wider-2 uppercase text-sage-600 mb-4">
            I servizi
          </p>
          <h2 className="text-4xl md:text-5xl text-stone-800 font-light leading-tight">
            Aree di intervento
          </h2>
          <p className="text-stone-600 leading-relaxed mt-6">
            Offro percorsi terapeutici personalizzati per adulti, coppie e
            adolescenti, in un ambiente riservato e accogliente.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((s, i) => (
            <article
              key={s.title}
              className="reveal group bg-white rounded-2xl p-8 border border-stone-200 hover:border-sage-300 hover:shadow-xl transition-all duration-500 hover:-translate-y-1"
              style={{ transitionDelay: `${(i % 3) * 100}ms` }}
            >
              <span className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-sage-50 text-sage-600 mb-5 group-hover:bg-sage-600 group-hover:text-clay-50 transition-all duration-500">
                <s.icon className="w-6 h-6" strokeWidth={1.5} />
              </span>
              <h3 className="text-2xl text-stone-800 font-medium mb-3">
                {s.title}
              </h3>
              <p className="text-sm text-stone-600 leading-relaxed">
                {s.text}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
