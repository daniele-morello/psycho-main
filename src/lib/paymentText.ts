// Testi su pagamento (bonifico anticipato) e disdetta mostrati al paziente.
// Usati dall'area riservata, nell'anteprima e nelle email già pronte: stesso
// testo ovunque.

export type PaymentTerms = {
  online_price_cents: number | null;
  payment_window_hours: number;
  payment_cutoff_hours: number;
  refund_notice_hours: number;
  cancellation_note: string | null;
  video_platform: string | null;
  video_instructions: string | null;
  bank_holder: string | null;
  bank_iban: string | null;
};

// IBAN scritto a gruppi di 4 per leggerlo meglio.
export const formatIban = (iban: string) => iban.replace(/\s+/g, "").toUpperCase().replace(/(.{4})/g, "$1 ").trim();

// Causale neutra: solo il codice della prenotazione. Nessun riferimento a
// psicoterapia o salute, perché la causale resta negli estratti conto.
export const transferReason = (ref: string) => `Prenotazione rif. ${ref}`;

// Coordinate per il bonifico, una per riga. null se mancano.
export function bankLines(t: PaymentTerms, ref: string): string[] | null {
  if (!t.bank_holder?.trim() || !t.bank_iban?.trim()) return null;
  return [
    `Intestatario: ${t.bank_holder.trim()}`,
    `IBAN: ${formatIban(t.bank_iban)}`,
    `Causale: ${transferReason(ref)}`,
  ];
}

export const formatEuro = (cents: number) =>
  new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(cents / 100);

const hoursText = (h: number) => (h === 1 ? "1 ora" : `${h} ore`);

export function paymentDeadlineText(t: PaymentTerms): string {
  return t.payment_cutoff_hours > 0
    ? `Il bonifico va effettuato entro ${hoursText(t.payment_window_hours)} dalla richiesta e comunque almeno ${hoursText(t.payment_cutoff_hours)} prima della seduta. L'appuntamento è confermato quando il bonifico viene ricevuto; se non arriva in tempo, l'orario torna disponibile.`
    : `Il bonifico va effettuato entro ${hoursText(t.payment_window_hours)} dalla richiesta. L'appuntamento è confermato quando il bonifico viene ricevuto; se non arriva in tempo, l'orario torna disponibile.`;
}

export function cancellationText(t: PaymentTerms): string {
  const base =
    t.refund_notice_hours > 0
      ? `Se disdici almeno ${hoursText(t.refund_notice_hours)} prima della seduta, ricevi il rimborso completo con bonifico. Dopo questo termine la seduta non è rimborsabile.`
      : "Puoi disdire fino all'inizio della seduta e ricevere il rimborso completo con bonifico.";
  const note = t.cancellation_note?.trim();
  return note ? `${base} ${note}` : base;
}

export const platformText = (t: PaymentTerms): string | null => t.video_platform?.trim() || null;

export const videoInstructionsText = (t: PaymentTerms): string | null => t.video_instructions?.trim() || null;
