// Testi su pagamento e disdetta mostrati al paziente. Usati dall'area riservata
// (anteprima) e, con la fase 4, dalla pagina di pagamento: stesso testo ovunque.

export type PaymentTerms = {
  online_price_cents: number | null;
  payment_window_hours: number;
  payment_cutoff_hours: number;
  refund_notice_hours: number;
  cancellation_note: string | null;
  video_platform: string | null;
  video_instructions: string | null;
};

export const formatEuro = (cents: number) =>
  new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(cents / 100);

const hoursText = (h: number) => (h === 1 ? "1 ora" : `${h} ore`);

export function paymentDeadlineText(t: PaymentTerms): string {
  return t.payment_cutoff_hours > 0
    ? `Il pagamento va completato entro ${hoursText(t.payment_window_hours)} dalla conferma dell'appuntamento e comunque almeno ${hoursText(t.payment_cutoff_hours)} prima della seduta. Se non arriva in tempo, l'appuntamento viene annullato.`
    : `Il pagamento va completato entro ${hoursText(t.payment_window_hours)} dalla conferma dell'appuntamento. Se non arriva in tempo, l'appuntamento viene annullato.`;
}

export function cancellationText(t: PaymentTerms): string {
  const base =
    t.refund_notice_hours > 0
      ? `Se disdici almeno ${hoursText(t.refund_notice_hours)} prima della seduta, ricevi il rimborso completo. Dopo questo termine la seduta non è rimborsabile.`
      : "Puoi disdire fino all'inizio della seduta e ricevere il rimborso completo.";
  const note = t.cancellation_note?.trim();
  return note ? `${base} ${note}` : base;
}

export const platformText = (t: PaymentTerms): string | null => t.video_platform?.trim() || null;

export const videoInstructionsText = (t: PaymentTerms): string | null => t.video_instructions?.trim() || null;
