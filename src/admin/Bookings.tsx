import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { CalendarPlus, Clock, Loader2, Mail, Phone, RefreshCw, Repeat } from "lucide-react";
import { isProposedDue, type Booking, type BookingAction, type PaymentSettings, type RequestsApi } from "@/admin/api";
import Scheduler from "@/admin/Scheduler";
import {
  bankLines,
  cancellationText,
  formatEuro,
  platformText,
  transferReason,
  videoInstructionsText,
} from "@/lib/paymentText";

const TZ = "Europe/Rome";
const whenFmt = new Intl.DateTimeFormat("it-IT", {
  timeZone: TZ,
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
});
const deadlineFmt = new Intl.DateTimeFormat("it-IT", {
  timeZone: TZ,
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});
const when = (iso: string) => whenFmt.format(new Date(iso));
const modeLabel = (b: Booking) => (b.mode === "online" ? "online" : "in presenza");

function remaining(iso: string): string {
  const ms = Date.parse(iso) - Date.now();
  if (ms <= 0) return "scaduta";
  const h = Math.floor(ms / 3_600_000);
  if (h >= 48) return `scade tra ${Math.floor(h / 24)} giorni`;
  if (h >= 1) return `scade tra ${h} ${h === 1 ? "ora" : "ore"}`;
  return `scade tra ${Math.max(1, Math.round(ms / 60_000))} minuti`;
}

const SIGNATURE = "Cordiali saluti,\r\nDr.ssa Jerarda Damaris Ceglia";
const mailto = (to: string, subject: string, body: string) =>
  `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

const whatTitle = (b: Booking) => (b.first_booking_id ? "Conferma della seduta" : "Conferma del primo colloquio");
const ourSession = (b: Booking) => (b.first_booking_id ? "la nostra seduta" : "il nostro primo colloquio");

// Richiesta di bonifico anticipato per una seduta online accettata.
function transferMail(b: Booking, payment: PaymentSettings | null): string {
  const price = b.price_cents ? ` di ${formatEuro(b.price_cents)}` : "";
  const deadline = b.payment_deadline ? ` entro ${deadlineFmt.format(new Date(b.payment_deadline))}` : "";
  return mailto(
    b.email,
    "Coordinate per il bonifico – Dr.ssa Ceglia",
    [
      `Gentile ${b.name},`,
      "",
      `l'orario di ${when(b.starts_at)} è disponibile per ${ourSession(b)} online.`,
      `Per confermarlo ti chiedo di effettuare un bonifico${price}${deadline} a queste coordinate:`,
      "",
      ...((payment && bankLines(payment, b.ref)) ?? ["(coordinate non impostate)"]),
      "",
      "L'appuntamento sarà confermato quando riceverò il bonifico: ti scriverò per confermartelo.",
      "",
      payment ? cancellationText(payment) : "",
      "",
      SIGNATURE,
    ].join("\r\n"),
  );
}

function confirmMail(b: Booking, payment: PaymentSettings | null): string {
  const video =
    b.mode === "online" && payment
      ? [platformText(payment) ? `Piattaforma usata: ${platformText(payment)}.` : "", videoInstructionsText(payment) ?? ""]
      : [];
  return mailto(
    b.email,
    `${whatTitle(b)}${b.mode === "online" ? " online" : ""} – Dr.ssa Ceglia`,
    [
      `Gentile ${b.name},`,
      "",
      b.status === "paid"
        ? `ho ricevuto il bonifico: confermo ${ourSession(b)} online ${when(b.starts_at)}.`
        : `confermo ${ourSession(b)} ${modeLabel(b)} ${when(b.starts_at)}.`,
      b.payment_waived ? "La seduta è gratuita: non è richiesto alcun pagamento." : "",
      ...video,
      "",
      SIGNATURE,
    ]
      .filter((line, i, all) => line !== "" || all[i - 1] !== "")
      .join("\r\n"),
  );
}

// Cambio di orario: data e ora nuove, e cosa resta da fare.
function movedMail(b: Booking): string {
  const next =
    b.status === "pending"
      ? "Ti scriverò per confermare l'appuntamento."
      : b.status === "awaiting_payment" && b.payment_deadline
        ? `Ti ricordo di effettuare il bonifico entro ${deadlineFmt.format(new Date(b.payment_deadline))}, con causale «${transferReason(b.ref)}».`
        : "";
  return mailto(
    b.email,
    "Cambio di orario dell'appuntamento – Dr.ssa Ceglia",
    [
      `Gentile ${b.name},`,
      "",
      `ti scrivo per spostare il nostro appuntamento ${modeLabel(b)} a ${when(b.starts_at)}.`,
      next,
      "",
      "Se il nuovo orario non ti è possibile, rispondi a questa email.",
      "",
      SIGNATURE,
    ].join("\r\n"),
  );
}

const declineMail = (b: Booking) =>
  mailto(
    b.email,
    "La tua richiesta di appuntamento – Dr.ssa Ceglia",
    [
      `Gentile ${b.name},`,
      "",
      `purtroppo non posso confermare l'appuntamento che hai richiesto per ${when(b.starts_at)}.`,
      "",
      "",
      SIGNATURE,
    ].join("\r\n"),
  );

const ERRORS: Record<string, string> = {
  payment_not_configured:
    "Per le sedute online mancano prezzo o coordinate per il bonifico: impostali nel tab «Pagamento e disdetta», oppure usa «Conferma gratuita».",
  too_late: "L'appuntamento è già passato.",
  too_late_to_pay:
    "Non c'è più tempo per il bonifico prima della seduta: sposta l'appuntamento più avanti, confermalo come gratuito oppure rifiutalo.",
  wrong_status: "La prenotazione è cambiata nel frattempo. Ho aggiornato l'elenco.",
  forbidden: "Sessione non valida: esci e rientra.",
};

type Prompt = { id: string; kind: "confirmed" | "declined" | "link" | "moved" };
type Planner = { kind: "schedule" | "move"; id: string };

export default function Bookings({ api, onChange }: { api: RequestsApi; onChange: () => void }) {
  const [rows, setRows] = useState<Booking[] | null>(null);
  const [payment, setPayment] = useState<PaymentSettings | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmDecline, setConfirmDecline] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [showArchive, setShowArchive] = useState(false);
  const [showLater, setShowLater] = useState(false);
  const [planner, setPlanner] = useState<Planner | null>(null);
  const [notice, setNotice] = useState("");
  const [confirmSkip, setConfirmSkip] = useState<{ id: string; series: boolean } | null>(null);
  const [confirmFree, setConfirmFree] = useState<string | null>(null);
  const [confirmPaid, setConfirmPaid] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [list, pay] = await Promise.all([api.listBookings(), api.getPayment().catch(() => null)]);
      setRows(list);
      setPayment(pay);
    } catch {
      setError("Non è stato possibile caricare le prenotazioni. Riprova o esci e rientra.");
      setRows((r) => r ?? []);
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (action: BookingAction, b: Booking): Promise<boolean> => {
    setBusy(b.id);
    setError("");
    setNotice("");
    const result = await api.manageBooking(action, b.id);
    setBusy(null);
    await load();
    onChange();
    if (result.code) {
      setError(ERRORS[result.code] ?? "L'operazione non è riuscita. Riprova.");
      return false;
    }
    return true;
  };

  if (rows === null) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-sage-600" />
      </div>
    );
  }

  const now = Date.now();
  const pending = rows.filter((b) => b.status === "pending" || isProposedDue(b, now));
  const later = rows.filter((b) => b.status === "proposed" && !isProposedDue(b, now));
  const awaiting = rows.filter((b) => b.status === "awaiting_payment");
  const upcoming = rows.filter((b) => (b.status === "confirmed" || b.status === "paid") && Date.parse(b.ends_at) > now);
  const archive = rows
    .filter((b) => !pending.includes(b) && !later.includes(b) && !awaiting.includes(b) && !upcoming.includes(b))
    .reverse();

  // Ultima seduta fissata del paziente: da lì si propone la successiva.
  const rootOf = (b: Booking) => b.first_booking_id ?? b.id;
  const lastSession = (b: Booking) =>
    rows
      .filter((x) => rootOf(x) === rootOf(b) && ["proposed", "confirmed", "paid", "awaiting_payment"].includes(x.status))
      .reduce((max, x) => (x.starts_at > max ? x.starts_at : max), b.starts_at);

  const plannerFor = (b: Booking) =>
    planner?.id === b.id && (
      <Scheduler
        api={api}
        booking={b}
        moving={planner.kind === "move" ? b : undefined}
        suggestFrom={lastSession(b)}
        onClose={() => setPlanner(null)}
        onDone={async (message) => {
          const moved = planner.kind === "move" && b.status !== "proposed";
          setPlanner(null);
          setNotice(message);
          await load();
          onChange();
          if (moved) setPrompt({ id: b.id, kind: "moved" });
        }}
      />
    );

  // In presenza: conferma subito. Online: accetta l'orario e chiede il bonifico;
  // la conferma arriva con «Bonifico ricevuto».
  const confirmButton = (b: Booking) => (
    <button
      className={primary}
      disabled={busy === b.id}
      onClick={async () => {
        if (!(await act("confirm", b))) return;
        if (b.mode === "online") {
          setNotice("Orario accettato. Ora invia le coordinate per il bonifico dalla sezione «In attesa di bonifico».");
        } else {
          setPrompt({ id: b.id, kind: "confirmed" });
        }
      }}
    >
      {b.mode === "online" ? "Accetta e chiedi il bonifico" : "Conferma"}
    </button>
  );

  const moveButton = (b: Booking) => (
    <button
      className={secondary}
      disabled={busy === b.id}
      onClick={() => {
        setNotice("");
        setPlanner({ kind: "move", id: b.id });
      }}
    >
      Sposta
    </button>
  );

  // Seduta online gratuita: solo per casi straordinari, con conferma esplicita.
  const freeButton = (b: Booking) =>
    b.mode === "online" && (
      <button className={secondary} disabled={busy === b.id} onClick={() => setConfirmFree(b.id)}>
        Conferma gratuita
      </button>
    );

  const freeBox = (b: Booking) => (
    <div className="mt-3 rounded-lg border border-clay-200 bg-clay-50 px-3 py-2 text-sm">
      <p className="mb-2">
        Confermare questa seduta online <strong>senza pagamento</strong>? È pensato per casi straordinari: la persona non
        dovrà fare il bonifico
        {b.status === "awaiting_payment" ? " (se le hai già inviato le coordinate, avvisala con la conferma)" : ""}.
      </p>
      <div className="flex gap-2">
        <button
          className={primary}
          disabled={busy === b.id}
          onClick={async () => {
            setConfirmFree(null);
            if (await act("waive_payment", b)) setPrompt({ id: b.id, kind: "confirmed" });
          }}
        >
          Sì, conferma gratuita
        </button>
        <button className={secondary} onClick={() => setConfirmFree(null)}>
          No
        </button>
      </div>
    </div>
  );

  const seriesLabel = (b: Booking) => {
    if (!b.series_id) return null;
    const series = rows.filter((x) => x.series_id === b.series_id).sort((x, y) => x.starts_at.localeCompare(y.starts_at));
    return `serie ${series.findIndex((x) => x.id === b.id) + 1} di ${series.length}`;
  };

  const card = (b: Booking, extra: ReactNode) => (
    <li key={b.id} className="bg-white rounded-xl border border-stone-200 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2 mb-1">
        <p className="font-medium first-letter:uppercase">{when(b.starts_at)}</p>
        <span className="text-xs text-stone-500">rif. {b.ref}</span>
      </div>
      <p className="text-sm text-stone-700 mb-2">
        {b.name} {b.surname} · {modeLabel(b)}
        {b.mode === "online" && b.price_cents ? ` · ${formatEuro(b.price_cents)}` : ""}
        {b.payment_waived ? " · gratuita" : ""}
        {b.first_booking_id ? (
          <span className="ml-2 inline-flex items-center gap-1 text-xs text-sage-700">
            {b.series_id && <Repeat className="w-3 h-3" />}
            {b.series_id ? seriesLabel(b) : "seduta successiva"}
          </span>
        ) : (
          <span className="ml-2 text-xs text-stone-500">primo colloquio</span>
        )}
      </p>
      <div className="flex flex-wrap gap-3 text-xs text-stone-500 mb-3">
        <span className="inline-flex items-center gap-1">
          <Mail className="w-3.5 h-3.5" /> {b.email}
        </span>
        {b.phone && (
          <a href={`tel:${b.phone}`} className="inline-flex items-center gap-1 hover:text-stone-800">
            <Phone className="w-3.5 h-3.5" /> {b.phone}
          </a>
        )}
      </div>
      {extra}
      {confirmFree === b.id && freeBox(b)}
      {prompt?.id === b.id && prompt.kind === "moved" && (
        <div className="mt-3 rounded-lg border border-sage-200 bg-sage-50 px-3 py-2 text-sm">
          <p className="mb-2">Orario cambiato. Avvisa {b.name} del nuovo orario.</p>
          <a className={primary} href={movedMail(b)} onClick={() => setPrompt(null)}>
            Scrivi il nuovo orario
          </a>
        </div>
      )}
      {plannerFor(b)}
    </li>
  );

  const button = "px-3 py-1.5 rounded-full text-sm border disabled:opacity-60";
  const primary = button + " bg-sage-700 border-sage-700 text-white hover:bg-sage-800";
  const secondary = button + " bg-white border-stone-300 hover:border-sage-400";
  const danger = button + " bg-red-700 border-red-700 text-white hover:bg-red-800";

  const promptBox = (text: string, yes: () => void) => (
    <div className="mt-3 rounded-lg border border-sage-200 bg-sage-50 px-3 py-2 text-sm">
      <p className="mb-2">{text}</p>
      <div className="flex gap-2">
        <button className={primary} onClick={yes}>
          Sì
        </button>
        <button className={secondary} onClick={() => setPrompt(null)}>
          Non ancora
        </button>
      </div>
    </div>
  );

  return (
    <main className="max-w-3xl mx-auto px-4 py-6 space-y-8">
      <div className="flex items-center justify-between">
        <p className="text-sm text-stone-600">
          Da confermare: <strong>{pending.length}</strong> · In attesa di bonifico: <strong>{awaiting.length}</strong>
        </p>
        <button onClick={() => void load()} className="p-2 text-stone-500 hover:text-stone-800" aria-label="Aggiorna" title="Aggiorna">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="text-sm text-sage-800 bg-sage-50 border border-sage-200 rounded-lg px-4 py-3">
          {notice}
        </p>
      )}

      <section>
        <h2 className="text-lg font-medium mb-3">Da confermare</h2>
        {pending.length === 0 ? (
          <p className="text-sm text-stone-500">Nessuna prenotazione da confermare.</p>
        ) : (
          <ul className="space-y-3">
            {pending.map((b) =>
              b.status === "proposed" ? (
                card(
                  b,
                  <>
                    <p className="text-xs text-clay-800 inline-flex items-center gap-1 mb-3">
                      <Clock className="w-3.5 h-3.5" /> Seduta proposta: confermala, spostala o saltala. Se non la confermi
                      prima dell'inizio si annulla da sola.
                    </p>
                    {proposedActions(b, true)}
                  </>,
                )
              ) : card(
                b,
                <>
                  <p className="text-xs text-clay-800 inline-flex items-center gap-1 mb-3">
                    <Clock className="w-3.5 h-3.5" /> Da confermare entro {deadlineFmt.format(new Date(b.confirm_deadline ?? b.starts_at))} (
                    {remaining(b.confirm_deadline ?? b.starts_at)}). Poi si annulla da sola.
                  </p>
                  {confirmDecline === b.id ? (
                    <div className="flex flex-wrap gap-2 items-center text-sm">
                      <span>Rifiutare la richiesta? L'orario torna libero.</span>
                      <button
                        className={danger}
                        disabled={busy === b.id}
                        onClick={async () => {
                          setConfirmDecline(null);
                          if (await act("decline", b)) setPrompt({ id: b.id, kind: "declined" });
                        }}
                      >
                        Sì, rifiuta
                      </button>
                      <button className={secondary} onClick={() => setConfirmDecline(null)}>
                        Annulla
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {confirmButton(b)}
                      {freeButton(b)}
                      {moveButton(b)}
                      <button className={secondary} disabled={busy === b.id} onClick={() => setConfirmDecline(b.id)}>
                        Rifiuta
                      </button>
                    </div>
                  )}
                </>,
              ),
            )}
          </ul>
        )}
      </section>

      {later.length > 0 && (
        <section>
          <button onClick={() => setShowLater((v) => !v)} className="text-lg font-medium mb-3 inline-flex items-center gap-2">
            Sedute proposte più avanti ({later.length})
            <span className="text-sm font-normal text-stone-500 underline underline-offset-2">
              {showLater ? "nascondi" : "mostra"}
            </span>
          </button>
          <p className="text-xs text-stone-500 mb-3">
            Tengono già occupato l'orario. Compaiono tra le cose da confermare una settimana prima.
          </p>
          {showLater && <ul className="space-y-3">{later.map((b) => card(b, proposedActions(b, false)))}</ul>}
        </section>
      )}

      {awaiting.length > 0 && (
        <section>
          <h2 className="text-lg font-medium mb-3">In attesa di bonifico</h2>
          <ul className="space-y-3">
            {awaiting.map((b) =>
              card(
                b,
                <>
                  <p className="text-xs text-clay-800 inline-flex items-center gap-1 mb-2">
                    <Clock className="w-3.5 h-3.5" /> Bonifico entro{" "}
                    {b.payment_deadline ? deadlineFmt.format(new Date(b.payment_deadline)) : "—"} (
                    {b.payment_deadline ? remaining(b.payment_deadline) : ""}). Se non arriva in tempo, l'orario torna libero.
                  </p>
                  <p className={"text-xs mb-1 " + (b.link_sent_at ? "text-sage-700" : "text-red-700 font-medium")}>
                    {b.link_sent_at
                      ? `Coordinate inviate il ${deadlineFmt.format(new Date(b.link_sent_at))}.`
                      : "Coordinate per il bonifico non ancora inviate."}
                  </p>
                  <p className="text-xs text-stone-500 mb-3">
                    Causale da cercare nell'estratto conto: «{transferReason(b.ref)}».
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button className={primary} disabled={busy === b.id} onClick={() => setConfirmPaid(b.id)}>
                      Bonifico ricevuto
                    </button>
                    <a
                      className={secondary}
                      href={transferMail(b, payment)}
                      onClick={() => {
                        if (!b.link_sent_at) setPrompt({ id: b.id, kind: "link" });
                      }}
                    >
                      {b.link_sent_at ? "Reinvia le coordinate" : "Invia le coordinate per il bonifico"}
                    </a>
                    {moveButton(b)}
                    {freeButton(b)}
                    <button className={secondary} disabled={busy === b.id} onClick={() => setConfirmCancel(b.id)}>
                      Annulla appuntamento
                    </button>
                  </div>
                  {prompt?.id === b.id && prompt.kind === "link" &&
                    promptBox("Hai inviato l'email con le coordinate per il bonifico?", async () => {
                      setPrompt(null);
                      await act("link_sent", b);
                    })}
                  {confirmPaid === b.id && (
                    <div className="mt-3 rounded-lg border border-sage-200 bg-sage-50 px-3 py-2 text-sm">
                      <p className="mb-2">
                        Hai ricevuto il bonifico{b.price_cents ? ` di ${formatEuro(b.price_cents)}` : ""} con causale «
                        {transferReason(b.ref)}»? L'appuntamento diventa confermato.
                      </p>
                      <div className="flex gap-2">
                        <button
                          className={primary}
                          disabled={busy === b.id}
                          onClick={async () => {
                            setConfirmPaid(null);
                            if (await act("mark_paid", b)) setPrompt({ id: b.id, kind: "confirmed" });
                          }}
                        >
                          Sì, confermalo
                        </button>
                        <button className={secondary} onClick={() => setConfirmPaid(null)}>
                          No
                        </button>
                      </div>
                    </div>
                  )}
                  {confirmCancel === b.id && cancelBox(b)}
                </>,
              ),
            )}
          </ul>
        </section>
      )}

      <section>
        <h2 className="text-lg font-medium mb-3">Appuntamenti confermati</h2>
        {upcoming.length === 0 ? (
          <p className="text-sm text-stone-500">Nessun appuntamento in programma.</p>
        ) : (
          <ul className="space-y-3">
            {upcoming.map((b) =>
              card(
                b,
                <>
                  <p className="text-xs text-sage-700 mb-3">
                    {b.status === "paid" ? "Confermato e pagato." : "Confermato."}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      className={primary + " inline-flex items-center gap-1"}
                      onClick={() => {
                        setNotice("");
                        setPlanner({ kind: "schedule", id: b.id });
                      }}
                    >
                      <CalendarPlus className="w-4 h-4" /> Fissa il prossimo appuntamento
                    </button>
                    <a className={secondary} href={confirmMail(b, payment)}>
                      Scrivi la conferma
                    </a>
                    {moveButton(b)}
                    <button className={secondary} disabled={busy === b.id} onClick={() => setConfirmCancel(b.id)}>
                      Annulla appuntamento
                    </button>
                  </div>
                  {prompt?.id === b.id && prompt.kind === "confirmed" && (
                    <p className="mt-3 text-sm text-sage-800 bg-sage-50 border border-sage-200 rounded-lg px-3 py-2">
                      Confermato. Usa «Scrivi la conferma» per avvisare la persona.
                    </p>
                  )}
                  {confirmCancel === b.id && cancelBox(b)}
                </>,
              ),
            )}
          </ul>
        )}
      </section>

      {prompt?.kind === "declined" && (() => {
        const b = rows.find((x) => x.id === prompt.id);
        return b ? (
          <div className="rounded-xl border border-stone-200 bg-white p-4 text-sm">
            <p className="mb-2">Richiesta rifiutata. Vuoi avvisare {b.name} {b.surname}?</p>
            <a className={primary} href={declineMail(b)} onClick={() => setPrompt(null)}>
              Scrivi l'email
            </a>
          </div>
        ) : null;
      })()}

      <section>
        <button onClick={() => setShowArchive((v) => !v)} className="text-sm text-stone-600 underline underline-offset-2">
          {showArchive ? "Nascondi l'archivio" : `Mostra l'archivio (${archive.length})`}
        </button>
        {showArchive && (
          <ul className="space-y-3 mt-3">
            {archive.map((b) =>
              card(
                b,
                <ArchiveActions b={b} busy={busy === b.id} onDelete={() => void act("delete", b)} />,
              ),
            )}
          </ul>
        )}
      </section>
    </main>
  );

  function proposedActions(b: Booking, due: boolean) {
    return (
      <>
        <div className="flex flex-wrap gap-2">
          {due && confirmButton(b)}
          {due && freeButton(b)}
          {moveButton(b)}
          <button className={secondary} disabled={busy === b.id} onClick={() => setConfirmSkip({ id: b.id, series: false })}>
            Salta questa seduta
          </button>
          {b.series_id && (
            <button className={secondary} disabled={busy === b.id} onClick={() => setConfirmSkip({ id: b.id, series: true })}>
              Interrompi la serie
            </button>
          )}
        </div>
        {confirmSkip?.id === b.id && (
          <div className="mt-3 flex flex-wrap gap-2 items-center text-sm">
            <span>
              {confirmSkip.series
                ? "Annullare questa seduta e tutte le successive della serie? Gli orari tornano liberi."
                : "Saltare questa seduta? L'orario torna libero."}
            </span>
            <button
              className={danger}
              disabled={busy === b.id}
              onClick={async () => {
                const series = confirmSkip.series;
                setConfirmSkip(null);
                if (await act(series ? "cancel_series" : "cancel", b)) {
                  setNotice(series ? "Serie interrotta." : "Seduta saltata.");
                }
              }}
            >
              Sì
            </button>
            <button className={secondary} onClick={() => setConfirmSkip(null)}>
              No
            </button>
          </div>
        )}
      </>
    );
  }

  function cancelBox(b: Booking) {
    return (
      <div className="mt-3 flex flex-wrap gap-2 items-center text-sm">
        <span>
          Annullare l'appuntamento? L'orario torna libero.
          {b.status === "paid" ? " L'eventuale rimborso va fatto con un bonifico." : ""}
        </span>
        <button
          className={danger}
          disabled={busy === b.id}
          onClick={async () => {
            setConfirmCancel(null);
            await act("cancel", b);
          }}
        >
          Sì, annulla
        </button>
        <button className={secondary} onClick={() => setConfirmCancel(null)}>
          No
        </button>
      </div>
    );
  }
}

const STATUS_TEXT: Record<string, string> = {
  declined: "Rifiutata",
  cancelled: "Annullata",
  expired: "Scaduta (non confermata o non pagata in tempo)",
  confirmed: "Svolta",
  paid: "Svolta (pagata)",
};

function ArchiveActions({ b, busy, onDelete }: { b: Booking; busy: boolean; onDelete: () => void }) {
  const [ask, setAsk] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-stone-500">{STATUS_TEXT[b.status] ?? b.status}</span>
      {ask ? (
        <>
          <span>
            Eliminare definitivamente?{b.first_booking_id ? "" : " Si eliminano anche tutte le sedute successive collegate."} Non si
            può annullare.
          </span>
          <button className="px-3 py-1.5 rounded-full text-sm bg-red-700 text-white disabled:opacity-60" disabled={busy} onClick={onDelete}>
            Sì, elimina
          </button>
          <button className="px-3 py-1.5 rounded-full text-sm border border-stone-300" onClick={() => setAsk(false)}>
            No
          </button>
        </>
      ) : (
        <button className="text-red-700 hover:text-red-800 underline underline-offset-2" onClick={() => setAsk(true)}>
          Elimina
        </button>
      )}
    </div>
  );
}
