import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const THERAPIST_EMAIL = "jerardadamarisceglia@gmail.com";
const RESEND_FROM = Deno.env.get("RESEND_FROM") ?? "onboarding@resend.dev";

interface RequestBody {
  name: string;
  email: string;
  phone?: string;
  service?: string;
  preferred_time?: string;
  message?: string;
}

function buildUserEmailHtml(data: RequestBody): string {
  const rows = [
    { label: "Servizio di interesse", value: data.service || "—" },
    { label: "Orario preferito", value: data.preferred_time || "—" },
    { label: "Telefono", value: data.phone || "—" },
  ];
  return `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f5f1ec;font-family:Georgia,'Times New Roman',serif;">
  <div style="max-width:560px;margin:40px auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e6d4c3;">
    <div style="background:#3b5440;padding:40px 32px;text-align:center;">
      <h1 style="color:#f4f7f4;margin:0;font-size:26px;font-weight:400;">Richiesta ricevuta</h1>
      <p style="color:#a3bba6;margin:8px 0 0;font-size:14px;letter-spacing:0.5px;">Studio di Psicoterapia — Dr.ssa Jerarda Damaris Ceglia</p>
    </div>
    <div style="padding:40px 32px;">
      <p style="color:#4a3f35;font-size:16px;line-height:1.6;">Gentile ${escapeHtml(data.name)},</p>
      <p style="color:#4a3f35;font-size:16px;line-height:1.6;">ho ricevuto la tua richiesta di prenotazione. Ti ricontatterò entro 24 ore per fissare la prima consulenza.</p>
      <p style="color:#6f5f50;font-size:14px;margin-bottom:24px;">Ecco un riepilogo delle informazioni che hai inviato:</p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
        ${rows
          .map(
            (r) => `<tr>
            <td style="padding:10px 0;border-bottom:1px solid #ebe4dc;color:#6f5f50;font-size:14px;">${r.label}</td>
            <td style="padding:10px 0;border-bottom:1px solid #ebe4dc;color:#2e261f;font-size:14px;text-align:right;">${escapeHtml(r.value)}</td>
          </tr>`
          )
          .join("")}
      </table>
      <div style="background:#faf6f1;border-radius:12px;padding:20px;margin-bottom:24px;">
        <p style="color:#6f5f50;font-size:13px;margin:0 0 6px;">Il tuo messaggio:</p>
        <p style="color:#2e261f;font-size:14px;line-height:1.6;margin:0;font-style:italic;">${escapeHtml(data.message || "—")}</p>
      </div>
      <p style="color:#6f5f50;font-size:14px;line-height:1.6;">Con i miei più cordiali saluti,<br/><strong style="color:#3b5440;">Dr.ssa Jerarda Damaris Ceglia</strong><br/>Psicologa e Psicoterapeuta</p>
    </div>
    <div style="padding:20px 32px;background:#faf6f1;text-align:center;">
      <p style="color:#a89684;font-size:12px;margin:0;">Questa email è generata automaticamente. Per qualsiasi domanda puoi scrivere a ${THERAPIST_EMAIL}</p>
    </div>
  </div>
</body></html>`;
}

function buildTherapistEmailHtml(data: RequestBody): string {
  const rows = [
    { label: "Nome", value: data.name || "—" },
    { label: "Email", value: data.email || "—" },
    { label: "Telefono", value: data.phone || "—" },
    { label: "Servizio", value: data.service || "—" },
    { label: "Orario preferito", value: data.preferred_time || "—" },
  ];
  return `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f5f1ec;font-family:Arial,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e6d4c3;">
    <div style="background:#3b5440;padding:32px;text-align:center;">
      <h1 style="color:#f4f7f4;margin:0;font-size:22px;font-weight:400;">Nuova richiesta di prenotazione</h1>
    </div>
    <div style="padding:32px;">
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
        ${rows
          .map(
            (r) => `<tr>
            <td style="padding:8px 0;border-bottom:1px solid #ebe4dc;color:#6f5f50;font-size:14px;">${r.label}</td>
            <td style="padding:8px 0;border-bottom:1px solid #ebe4dc;color:#2e261f;font-size:14px;text-align:right;">${escapeHtml(r.value)}</td>
          </tr>`
          )
          .join("")}
      </table>
      <div style="background:#faf6f1;border-radius:12px;padding:16px;">
        <p style="color:#6f5f50;font-size:13px;margin:0 0 6px;">Messaggio:</p>
        <p style="color:#2e261f;font-size:14px;line-height:1.6;margin:0;">${escapeHtml(data.message || "—")}</p>
      </div>
    </div>
  </div>
</body></html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function sendEmail(
  to: string,
  subject: string,
  html: string
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: RESEND_FROM,
      to: [to],
      reply_to: THERAPIST_EMAIL,
      subject,
      html,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    return { ok: false, error: `Resend error ${res.status}: ${body}` };
  }
  return { ok: true };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const data: RequestBody = await req.json();

    const senderEmail = data.email?.trim();

    if (!data.name || !senderEmail) {
      return new Response(
        JSON.stringify({ error: "Nome ed email sono obbligatori" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    data.email = senderEmail;

    if (!RESEND_API_KEY) {
      return new Response(
        JSON.stringify({ error: "RESEND_API_KEY non configurata" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Email di riepilogo al richiedente
    const userResult = await sendEmail(
      data.email,
      "Riepilogo della tua richiesta — Dr.ssa Jerarda Damaris Ceglia",
      buildUserEmailHtml(data)
    );

    // 2. Email di notifica alla terapeuta
    const therapistResult = await sendEmail(
      THERAPIST_EMAIL,
      `Nuova richiesta da ${data.name}`,
      buildTherapistEmailHtml(data)
    );

    if (!userResult.ok) {
      return new Response(
        JSON.stringify({ error: userResult.error }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        emailSent: true,
        therapistNotified: therapistResult.ok,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
