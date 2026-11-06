const steps = [
  {
    num: "01",
    title: "Prima consulenza",
    text: "Un primo incontro per conoscersi, ascoltare la tua storia e comprendere insieme quali sono le tue difficoltà e i tuoi obiettivi.",
  },
  {
    num: "02",
    title: "Definire il percorso",
    text: "Costruiamo un piano terapeutico su misura, definendo tempi, metodi e risultati attesi, con piena trasparenza.",
  },
  {
    num: "03",
    title: "Il lavoro terapeutico",
    text: "Incontri regolari in cui esplorare, comprendere e sperimentare nuove strategie, in un clima di fiducia e rispetto.",
  },
  {
    num: "04",
    title: "Crescita e autonomia",
    text: "L'obiettivo è acquisire strumenti che restino nel tempo, per continuare il cammino con nuova consapevolezza.",
  },
];

export default function Approach() {
  return (
    <section id="approach" className="py-24 md:py-32 bg-sage-800 text-clay-50">
      <div className="max-w-6xl mx-auto px-6 lg:px-8">
        <div className="max-w-2xl mb-16 reveal">
          <p className="text-sm tracking-wider-2 uppercase text-sage-300 mb-4">
            L'approccio
          </p>
          <h2 className="text-4xl md:text-5xl font-light leading-tight mb-6">
            Un percorso costruito
            <br />
            <span className="italic text-sage-200">insieme a te</span>
          </h2>
          <p className="text-sage-100/80 leading-relaxed">
            La psicoterapia non è un percorso uguale per tutti. Si adatta alla
            persona, alla sua storia e al momento che sta vivendo. Ecco come si
            articola il nostro cammino.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((s, i) => (
            <div
              key={s.num}
              className="reveal border-t border-sage-600/60 pt-6"
              style={{ transitionDelay: `${i * 100}ms` }}
            >
              <span className="font-cormorant text-4xl text-sage-300 block mb-4">
                {s.num}
              </span>
              <h3 className="text-xl font-medium mb-3">{s.title}</h3>
              <p className="text-sm text-sage-100/70 leading-relaxed">
                {s.text}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
