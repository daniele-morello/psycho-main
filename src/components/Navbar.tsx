import { useEffect, useState } from "react";
import { Menu, X, Brain } from "lucide-react";

const links = [
  { label: "Chi sono", href: "#about" },
  { label: "Approccio", href: "#approach" },
  { label: "Servizi", href: "#services" },
  { label: "Domande", href: "#faq" },
  { label: "Contatti", href: "#contact" },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-500 ${
        scrolled
          ? "bg-clay-50/95 backdrop-blur-md shadow-[0_1px_20px_rgba(0,0,0,0.06)]"
          : "bg-transparent"
      }`}
    >
      <nav className="max-w-6xl mx-auto px-6 lg:px-8 flex items-center justify-between h-20">
        <a href="#hero" className="flex items-center gap-2.5 group">
          <span
            className={`flex items-center justify-center w-10 h-10 rounded-full border transition-colors duration-500 ${
              scrolled
                ? "border-sage-500 text-sage-600"
                : "border-white/60 text-white"
            }`}
          >
            <Brain className="w-5 h-5" strokeWidth={1.4} />
          </span>
          <span
            className={`font-cormorant text-xl tracking-wide transition-colors duration-500 ${
              scrolled ? "text-stone-800" : "text-white"
            }`}
          >
            <span className="font-medium">Jerarda Damaris</span>{" "}
            <span className="font-light italic">Ceglia</span>
          </span>
        </a>

        <ul className="hidden md:flex items-center gap-9">
          {links.map((l) => (
            <li key={l.href}>
              <a
                href={l.href}
                className={`text-sm tracking-wide transition-colors duration-300 relative after:absolute after:bottom-[-4px] after:left-0 after:w-0 after:h-px after:bg-sage-500 after:transition-all hover:after:w-full ${
                  scrolled
                    ? "text-stone-600 hover:text-sage-600"
                    : "text-white/85 hover:text-white"
                }`}
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>

        <a
          href="#contact"
          className={`hidden md:inline-flex items-center px-5 py-2.5 rounded-full text-sm tracking-wide transition-all duration-300 ${
            scrolled
              ? "bg-sage-600 text-clay-50 hover:bg-sage-700 shadow-sm"
              : "bg-white/15 text-white border border-white/30 backdrop-blur-sm hover:bg-white/25"
          }`}
        >
          Prenota un incontro
        </a>

        <button
          className={`md:hidden ${scrolled ? "text-stone-700" : "text-white"}`}
          onClick={() => setOpen((o) => !o)}
          aria-label="Menu"
        >
          {open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </nav>

      {open && (
        <div className="md:hidden bg-clay-50 border-t border-stone-200">
          <ul className="px-6 py-4 space-y-3">
            {links.map((l) => (
              <li key={l.href}>
                <a
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="block py-1.5 text-stone-700 hover:text-sage-600 transition-colors"
                >
                  {l.label}
                </a>
              </li>
            ))}
            <li>
              <a
                href="#contact"
                onClick={() => setOpen(false)}
                className="inline-block mt-2 px-5 py-2.5 rounded-full bg-sage-600 text-clay-50 text-sm"
              >
                Prenota un incontro
              </a>
            </li>
          </ul>
        </div>
      )}
    </header>
  );
}
