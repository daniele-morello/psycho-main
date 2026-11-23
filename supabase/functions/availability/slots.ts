// Calcolo delle fasce libere. Modulo puro (nessuna dipendenza da Deno o dalla
// rete), così si può provare anche in locale con Node.

import { closedHoliday } from "./holidays.ts";

export type Interval = { start: number; end: number }; // millisecondi UTC, fine esclusa
export type WorkingHour = { weekday: number; start: string; end: string }; // 1 = lunedì, "HH:MM"

export type SlotInput = {
  now: number;
  timezone: string;
  sessionMinutes: number;
  bufferMinutes: number;
  minNoticeHours: number;
  maxDaysAhead: number;
  hours: WorkingHour[];
  unavailable: Interval[];
  closedHolidays: string[];
  patronDay: string | null; // "MM-DD"
};

const MINUTE = 60_000;
const DAY = 86_400_000;

// Differenza tra l'ora locale del fuso e UTC, in ms, nell'istante dato.
function tzOffset(utcMs: number, timezone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(utcMs));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

// Istante UTC di un'ora locale (anno, mese 1-12, giorno, minuti dalla mezzanotte).
// Gestisce il cambio dell'ora legale ricalcolando lo scarto una seconda volta.
export function zonedToUtc(y: number, m: number, d: number, minutes: number, timezone: string): number {
  const guess = Date.UTC(y, m - 1, d, 0, minutes);
  const first = tzOffset(guess, timezone);
  const candidate = guess - first;
  const second = tzOffset(candidate, timezone);
  return second === first ? candidate : guess - second;
}

function todayIn(timezone: string, now: number): [number, number, number] {
  const [y, m, d] = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(new Date(now))
    .split("-")
    .map(Number);
  return [y, m, d];
}

const toMinutes = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

export function computeSlots(input: SlotInput): number[] {
  const { now, timezone, sessionMinutes, bufferMinutes } = input;
  const earliest = now + input.minNoticeHours * 3_600_000;
  const latest = now + input.maxDaysAhead * DAY;
  const step = sessionMinutes + bufferMinutes;
  const [ty, tm, td] = todayIn(timezone, now);
  const slots: number[] = [];

  for (let i = 0; i <= input.maxDaysAhead; i++) {
    const date = new Date(Date.UTC(ty, tm - 1, td + i));
    const y = date.getUTCFullYear();
    const m = date.getUTCMonth() + 1;
    const d = date.getUTCDate();
    const weekday = ((date.getUTCDay() + 6) % 7) + 1;
    if (closedHoliday(y, m, d, input.closedHolidays, input.patronDay)) continue;

    for (const h of input.hours.filter((w) => w.weekday === weekday)) {
      const end = toMinutes(h.end);
      for (let t = toMinutes(h.start); t + sessionMinutes <= end; t += step) {
        const start = zonedToUtc(y, m, d, t, timezone);
        const finish = start + sessionMinutes * MINUTE;
        if (start < earliest || start > latest) continue;
        const clash = input.unavailable.some((u) => u.start < finish && start < u.end);
        if (!clash) slots.push(start);
      }
    }
  }
  return slots.sort((a, b) => a - b);
}
