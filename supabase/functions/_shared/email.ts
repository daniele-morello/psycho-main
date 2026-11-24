// Invio email con Resend. Senza dominio verificato Resend consegna solo
// all'indirizzo del proprietario dell'account: gli altri invii falliscono e
// vengono solo registrati nei log, senza bloccare l'operazione.

export const THERAPIST_EMAIL = "jerardadamarisceglia@gmail.com";

// Destinatario degli avvisi alla professionista (solo numeri, nessun dato del
// paziente). ALERT_EMAIL permette di cambiarlo senza toccare il codice.
export const alertEmail = () => Deno.env.get("ALERT_EMAIL")?.trim() || THERAPIST_EMAIL;

export function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export async function sendEmail(kind: string, to: string, subject: string, html: string): Promise<void> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("RESEND_FROM")?.trim();
  if (!apiKey || !from) {
    console.error(JSON.stringify({ event: "email_not_configured", kind }));
    return;
  }
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [to], reply_to: THERAPIST_EMAIL, subject, html }),
    });
    if (!response.ok) console.error(JSON.stringify({ event: `${kind}_email_failed`, status: response.status }));
  } catch {
    console.error(JSON.stringify({ event: `${kind}_email_network_error` }));
  }
}

const romeFormat = new Intl.DateTimeFormat("it-IT", {
  timeZone: "Europe/Rome",
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
export const formatRome = (iso: string) => romeFormat.format(new Date(iso));
