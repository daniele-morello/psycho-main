import { Heart, Shield, Clock } from "lucide-react";

const values = [
  {
    icon: Heart,
    title: "Ascolto autentico",
    text: "Ogni storia è unica. Il primo passo è sentirsi compresi senza giudizio.",
  },
  {
    icon: Shield,
    title: "Riservatezza totale",
    text: "Il segreto professionale è il fondamento di ogni relazione terapeutica.",
  },
  {
    icon: Clock,
    title: "Tempi rispettati",
    text: "Nessuna fretta. Si procede al ritmo giusto per ogni persona.",
  },
];

export default function About() {
  return (
    <section id="about" className="py-24 md:py-32 bg-clay-50">
      <div className="max-w-6xl mx-auto px-6 lg:px-8">
        <div className="grid md:grid-cols-2 gap-16 items-center">
          <div className="reveal relative">
            <div className="absolute -top-6 -left-6 w-40 h-40 bg-sage-100 rounded-2xl -z-10" />
            <img
              src="https://images.pexels.com/photos/4098357/pexels-photo-4098357.jpeg?auto=compress&cs=tinysrgb&w=800"
              alt="Dr.ssa Jerarda Damaris Ceglia"
              className="rounded-2xl shadow-xl w-full object-cover"
            />
            <div className="absolute -bottom-6 -right-6 bg-clay-50 p-5 rounded-xl shadow-lg max-w-[200px] hidden sm:block">
              <p className="font-cormorant text-3xl text-sage-600">15+</p>
              <p className="text-sm text-stone-600 mt-1">
                anni di esperienza clinica
              </p>
            </div>
          </div>

          <div className="reveal">
            <p className="text-sm tracking-wider-2 uppercase text-sage-600 mb-4">
              La terapeuta
            </p>
            <h2 className="text-4xl md:text-5xl text-stone-800 font-light leading-tight mb-6">
              Dr.ssa Jerarda Damaris Ceglia
            </h2>
            <p className="text-stone-600 leading-relaxed mb-5">
              Psicologa e psicoterapeuta, mi sono laureata all'Università di
              Caserta e mi sono specializzata in psicoterapia cognitivo-comportamentale.
              Negli anni ho maturato esperienza clinica in strutture pubbliche e
              privato, accompagnando adulti, coppie e adolescenti.
            </p>
            <p className="text-stone-600 leading-relaxed mb-8">
              Credo che la psicoterapia sia prima di tutto un incontro umano.
              Il mio impegno è offrire uno spazio accogliente dove poter
              esplorare pensieri ed emozioni, ritrovare chiarezza e costruire
              cambiamenti autentici e duraturi.
            </p>

            <div className="space-y-5">
              {values.map((v) => (
                <div key={v.title} className="flex gap-4">
                  <span className="flex-shrink-0 flex items-center justify-center w-11 h-11 rounded-full bg-sage-50 text-sage-600 border border-sage-200">
                    <v.icon className="w-5 h-5" strokeWidth={1.5} />
                  </span>
                  <div>
                    <h3 className="text-lg text-stone-800 font-medium">
                      {v.title}
                    </h3>
                    <p className="text-sm text-stone-600 leading-relaxed">
                      {v.text}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
