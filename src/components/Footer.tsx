import { Brain } from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-stone-900 text-stone-400 py-14">
      <div className="max-w-6xl mx-auto px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex items-center gap-2.5 text-stone-300">
            <span className="flex items-center justify-center w-10 h-10 rounded-full border border-stone-600">
              <Brain className="w-5 h-5" strokeWidth={1.4} />
            </span>
            <span className="font-cormorant text-xl">
              <span className="font-medium">Jerarda Damaris</span>{" "}
              <span className="font-light italic">Ceglia</span>
            </span>
          </div>

          <nav className="flex flex-wrap items-center gap-6 text-sm">
            <a href="#about" className="hover:text-sage-400 transition-colors">
              Chi sono
            </a>
            <a href="#approach" className="hover:text-sage-400 transition-colors">
              Approccio
            </a>
            <a href="#services" className="hover:text-sage-400 transition-colors">
              Servizi
            </a>
            <a href="#faq" className="hover:text-sage-400 transition-colors">
              Domande
            </a>
            <a href="#contact" className="hover:text-sage-400 transition-colors">
              Contatti
            </a>
          </nav>
        </div>

        <div className="mt-10 pt-8 border-t border-stone-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-stone-500">
          <p>Psicologa iscritta all'Albo dell'Ordine di Padova · n. 4521</p>
          <p>
            © {new Date().getFullYear()} Dr.ssa Jerarda Damaris Ceglia. Tutti i diritti
            riservati.
          </p>
        </div>
      </div>
    </footer>
  );
}
