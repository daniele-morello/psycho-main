import { ArrowDown } from "lucide-react";

export default function Hero() {
  return (
    <section
      id="hero"
      className="relative min-h-screen flex items-center justify-center overflow-hidden"
    >
      <div className="absolute inset-0">
        <img
          src="https://images.pexels.com/photos/5850079/pexels-photo-5850079.jpeg?auto=compress&cs=tinysrgb&w=1920"
          alt="Paesaggio sereno all'alba"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-stone-900/50 via-stone-900/30 to-stone-900/60" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-6 text-center text-white pt-20">
        <p
          className="text-sm tracking-wider-2 uppercase mb-6 animate-fade-in"
          style={{ animationDelay: "0.2s" }}
        >
          Psicoterapia · Individuale e di Coppia
        </p>
        <h1
          className="text-5xl md:text-7xl lg:text-8xl leading-[1.05] font-light animate-fade-up"
          style={{ animationDelay: "0.4s" }}
        >
          Uno spazio sicuro
          <br />
          <span className="italic font-medium text-sage-200">
            per ritrovare te stesso
          </span>
        </h1>
        <p
          className="mt-8 max-w-2xl mx-auto text-lg md:text-xl text-stone-100/90 font-light leading-relaxed animate-fade-up"
          style={{ animationDelay: "0.7s" }}
        >
          Un percorso di psicoterapia costruito su ascolto, fiducia e rispetto,
          per attraversare i momenti difficili e coltivare un benessere duraturo.
        </p>
        <div
          className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-up"
          style={{ animationDelay: "1s" }}
        >
          <a
            href="#contact"
            className="px-8 py-4 rounded-full bg-sage-600 hover:bg-sage-700 text-clay-50 text-sm tracking-wide transition-all duration-300 shadow-lg hover:shadow-xl hover:-translate-y-0.5"
          >
            Prenota una prima consulenza
          </a>
          <a
            href="#about"
            className="px-8 py-4 rounded-full border border-white/40 text-white text-sm tracking-wide hover:bg-white/10 transition-all duration-300 backdrop-blur-sm"
          >
            Conosci la terapeuta
          </a>
        </div>
      </div>

      <a
        href="#about"
        className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/70 hover:text-white transition-colors animate-gentle-float"
        aria-label="Scorri"
      >
        <ArrowDown className="w-5 h-5" />
      </a>
    </section>
  );
}
