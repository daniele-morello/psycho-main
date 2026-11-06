import { useState } from "react";
import { Plus, Minus } from "lucide-react";

const faqs = [
  {
    q: "Quanto dura una seduta di psicoterapia?",
    a: "Una seduta dura generalmente 50 minuti. La frequenza è solitamente settimanale, ma viene concordata insieme in base alle esigenze e al percorso terapeutico.",
  },
  {
    q: "Qual è la durata media di un percorso?",
    a: "Non esiste una risposta univoca. Alcuni percorsi sono brevi (8–12 incontri), altri più lunghi. La durata dipende dagli obiettivi, dalla natura delle difficoltà e dal ritmo di ogni persona.",
  },
  {
    q: "La prima consulenza è vincolante?",
    a: "No. Il primo incontro serve a conoscersi e capire se c'è sintonia. Se non ti senti a tuo agio, sei libero di non proseguire, senza alcun impegno.",
  },
  {
    q: "I contenuti delle sedute sono riservati?",
    a: "Assolutamente sì. Il segreto professionale è un dovere etico e legale. Nessuna informazione viene condivisa senza il tuo esplicito consenso.",
  },
  {
    q: "Sono disponibili sedute online?",
    a: "Sì, offro sedute in videochiamata su piattaforme sicure, per chi preferisce o ha difficoltà a spostarsi. L'efficacia del percorso online è equivalente a quello in studio.",
  },
  {
    q: "Quali sono i costi?",
    a: "Il costo della seduta viene comunicato durante la prima consulenza. Offro anche un numero limitato di posti a tariffe agevolate — non esitare a parlarmene apertamente.",
  },
];

export default function FAQ() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="py-24 md:py-32 bg-clay-50">
      <div className="max-w-3xl mx-auto px-6 lg:px-8">
        <div className="text-center mb-16 reveal">
          <p className="text-sm tracking-wider-2 uppercase text-sage-600 mb-4">
            Domande frequenti
          </p>
          <h2 className="text-4xl md:text-5xl text-stone-800 font-light leading-tight">
            Informazioni utili
          </h2>
        </div>

        <div className="space-y-3">
          {faqs.map((item, i) => {
            const isOpen = open === i;
            return (
              <div
                key={i}
                className="reveal bg-white rounded-xl border border-stone-200 overflow-hidden"
              >
                <button
                  className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left"
                  onClick={() => setOpen(isOpen ? null : i)}
                >
                  <span className="text-lg text-stone-800 font-medium">
                    {item.q}
                  </span>
                  <span className="flex-shrink-0 text-sage-600">
                    {isOpen ? (
                      <Minus className="w-5 h-5" />
                    ) : (
                      <Plus className="w-5 h-5" />
                    )}
                  </span>
                </button>
                <div
                  className={`grid transition-all duration-300 ${
                    isOpen
                      ? "grid-rows-[1fr] opacity-100"
                      : "grid-rows-[0fr] opacity-0"
                  }`}
                >
                  <div className="overflow-hidden">
                    <p className="px-6 pb-5 text-stone-600 leading-relaxed">
                      {item.a}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
