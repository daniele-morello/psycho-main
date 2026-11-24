// Controlli dei campi comuni al modulo informazioni e alla prenotazione.
// Le stesse regole sono ripetute nelle funzioni del server.

const PERSON_NAME = /^[\p{L}][\p{L}\p{M}\s'‘’ʼ-]{0,79}$/u;
const PHONE_NUMBER = /^\+?[0-9]{6,30}$/;
const EMAIL_ADDRESS = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function personNameError(value: string, label: "nome" | "cognome"): string {
  const text = value.trim();
  if (!text) return `Inserisci il ${label}.`;
  if (!PERSON_NAME.test(text)) {
    return `Il ${label} può contenere solo lettere, spazi, apostrofi e trattini, senza numeri.`;
  }
  return "";
}

export function emailError(value: string): string {
  const text = value.trim();
  if (!text) return "Inserisci un indirizzo email.";
  if (!EMAIL_ADDRESS.test(text) || text.length > 254) {
    return "Inserisci un indirizzo email valido, ad esempio nome@dominio.it.";
  }
  return "";
}

export function phoneError(value: string): string {
  const text = value.trim();
  if (!text) return "";
  const digits = text.startsWith("+") ? text.slice(1) : text;
  if (/^[0-9]+$/.test(digits) && digits.length < 6) {
    return "Il numero deve contenere almeno 6 cifre. Puoi aggiungere un + all'inizio.";
  }
  if (!PHONE_NUMBER.test(text)) {
    return "Inserisci solo cifre, con un eventuale + all'inizio.";
  }
  return "";
}
