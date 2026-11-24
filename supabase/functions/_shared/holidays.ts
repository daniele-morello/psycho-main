// Festività nazionali italiane. Modulo puro, usato sia dalla funzione
// availability sia dall'area riservata (stesso elenco, stesse date).
//
// Il santo patrono dipende dal comune: non è qui, si imposta dall'area riservata.

export type HolidayCode =
  | "capodanno"
  | "epifania"
  | "pasqua"
  | "pasquetta"
  | "liberazione"
  | "lavoro"
  | "repubblica"
  | "ferragosto"
  | "san_francesco"
  | "ognissanti"
  | "immacolata"
  | "natale"
  | "santo_stefano";

type Holiday = { code: HolidayCode; label: string } & ({ date: string } | { easterOffset: number });

export const HOLIDAYS: Holiday[] = [
  { code: "capodanno", label: "Capodanno (1 gennaio)", date: "01-01" },
  { code: "epifania", label: "Epifania (6 gennaio)", date: "01-06" },
  { code: "pasqua", label: "Pasqua", easterOffset: 0 },
  { code: "pasquetta", label: "Lunedì dell'Angelo (Pasquetta)", easterOffset: 1 },
  { code: "liberazione", label: "Festa della Liberazione (25 aprile)", date: "04-25" },
  { code: "lavoro", label: "Festa del Lavoro (1 maggio)", date: "05-01" },
  { code: "repubblica", label: "Festa della Repubblica (2 giugno)", date: "06-02" },
  { code: "ferragosto", label: "Ferragosto (15 agosto)", date: "08-15" },
  { code: "san_francesco", label: "San Francesco d'Assisi (4 ottobre)", date: "10-04" },
  { code: "ognissanti", label: "Ognissanti (1 novembre)", date: "11-01" },
  { code: "immacolata", label: "Immacolata Concezione (8 dicembre)", date: "12-08" },
  { code: "natale", label: "Natale (25 dicembre)", date: "12-25" },
  { code: "santo_stefano", label: "Santo Stefano (26 dicembre)", date: "12-26" },
];

export const ALL_HOLIDAY_CODES: HolidayCode[] = HOLIDAYS.map((h) => h.code);

// Domenica di Pasqua (calendario gregoriano, algoritmo di Meeus/Jones/Butcher).
export function easterSunday(year: number): { month: number; day: number } {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { month, day };
}

const mmdd = (month: number, day: number) => `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

// Motivo della chiusura per quel giorno (anno, mese 1-12, giorno), oppure null.
export function closedHoliday(
  year: number,
  month: number,
  day: number,
  closedCodes: string[],
  patronDay: string | null,
): string | null {
  const key = mmdd(month, day);
  if (patronDay && patronDay === key) return "Santo patrono";
  const easter = easterSunday(year);
  const easterMs = Date.UTC(year, easter.month - 1, easter.day);
  const thisMs = Date.UTC(year, month - 1, day);
  for (const h of HOLIDAYS) {
    if (!closedCodes.includes(h.code)) continue;
    const hit = "date" in h ? h.date === key : thisMs === easterMs + h.easterOffset * 86_400_000;
    if (hit) return h.label;
  }
  return null;
}
