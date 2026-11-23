import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Loader2, LockKeyhole, LogOut, ShieldCheck } from "lucide-react";
import Requests from "@/admin/Requests";
import { supabaseApi, type RequestsApi } from "@/admin/api";

const IDLE_LIMIT_MS = 20 * 60 * 1000;

type Stage =
  | { kind: "loading" }
  | { kind: "signedOut"; notice?: string }
  | { kind: "enroll"; factorId: string; qr: string; secret: string }
  | { kind: "challenge"; factorId: string }
  | { kind: "ready" };

const inputClass =
  "w-full px-4 py-3 rounded-lg border border-stone-300 bg-white text-stone-800 focus:outline-none focus:border-sage-500 focus:ring-2 focus:ring-sage-200";
const buttonClass =
  "w-full px-5 py-3 rounded-full bg-sage-700 text-white text-sm hover:bg-sage-800 disabled:opacity-60 flex items-center justify-center gap-2";

function Card({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-stone-200 p-8">
        {children}
      </div>
    </div>
  );
}

export function AdminApp({ client }: { client: SupabaseClient }) {
  const [stage, setStage] = useState<Stage>({ kind: "loading" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const api = useMemo(() => supabaseApi(client), [client]);

  const signOut = useCallback(
    async (notice?: string) => {
      await client.auth.signOut().catch(() => undefined);
      setStage({ kind: "signedOut", notice });
    },
    [client],
  );

  const resolve = useCallback(async () => {
    const { data: sessionData } = await client.auth.getSession();
    const session = sessionData.session;
    if (!session) return setStage({ kind: "signedOut" });

    // Il ruolo lo imposta solo il server (app_metadata). Lo stesso controllo,
    // con il secondo fattore, è ripetuto nel database a ogni lettura.
    if (session.user.app_metadata?.role !== "admin") {
      return signOut("Questo account non ha accesso all'area riservata.");
    }

    const { data: aal } = await client.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.currentLevel === "aal2") return setStage({ kind: "ready" });

    const { data: factors, error: factorsError } = await client.auth.mfa.listFactors();
    if (factorsError) return signOut("Errore nel controllo del secondo fattore. Riprova.");
    const verified = factors.totp.find((f) => f.status === "verified");
    if (verified) return setStage({ kind: "challenge", factorId: verified.id });

    // Primo accesso: si configura l'app di autenticazione. Le configurazioni
    // lasciate a metà vengono rimosse prima di crearne una nuova.
    for (const f of factors.all.filter((f) => f.status === "unverified")) {
      await client.auth.mfa.unenroll({ factorId: f.id });
    }
    const { data: enrolled, error: enrollError } = await client.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "Area riservata",
    });
    if (enrollError || !enrolled) {
      return signOut("Non è stato possibile configurare il secondo fattore.");
    }
    setStage({
      kind: "enroll",
      factorId: enrolled.id,
      qr: enrolled.totp.qr_code,
      secret: enrolled.totp.secret,
    });
  }, [client, signOut]);

  useEffect(() => {
    void resolve();
  }, [resolve]);

  // Uscita automatica dopo 20 minuti senza attività.
  useEffect(() => {
    if (stage.kind === "signedOut" || stage.kind === "loading") return;
    let timer = window.setTimeout(() => void signOut("Sessione chiusa per inattività."), IDLE_LIMIT_MS);
    const reset = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void signOut("Sessione chiusa per inattività."), IDLE_LIMIT_MS);
    };
    const events = ["pointerdown", "keydown", "scroll"] as const;
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    return () => {
      window.clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [stage.kind, signOut]);

  const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    const { error: loginError } = await client.auth.signInWithPassword({
      email: String(form.get("email") || "").trim(),
      password: String(form.get("password") || ""),
    });
    setBusy(false);
    if (loginError) {
      // Messaggio generico: non dice se l'email esiste.
      setError("Email o password non corretti.");
      return;
    }
    await resolve();
  };

  const handleCode = async (e: FormEvent<HTMLFormElement>, factorId: string) => {
    e.preventDefault();
    const code = String(new FormData(e.currentTarget).get("code") || "").replace(/\s/g, "");
    setBusy(true);
    setError("");
    const { error: verifyError } = await client.auth.mfa.challengeAndVerify({ factorId, code });
    setBusy(false);
    if (verifyError) {
      setError("Codice non valido o scaduto. Riprova con il codice attuale.");
      return;
    }
    await resolve();
  };

  if (stage.kind === "loading") {
    return (
      <Card>
        <Loader2 className="w-6 h-6 animate-spin mx-auto text-sage-600" />
      </Card>
    );
  }

  if (stage.kind === "signedOut") {
    return (
      <Card>
        <LockKeyhole className="w-8 h-8 text-sage-600 mb-4" strokeWidth={1.5} />
        <h1 className="text-xl font-medium mb-1">Area riservata</h1>
        <p className="text-sm text-stone-500 mb-6">Accesso riservato alla professionista.</p>
        {stage.notice && (
          <p className="text-sm text-stone-700 bg-stone-100 rounded-lg px-3 py-2 mb-4">{stage.notice}</p>
        )}
        <form onSubmit={handleLogin} className="space-y-4">
          <input name="email" type="email" required autoComplete="username" placeholder="Email" className={inputClass} />
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
            placeholder="Password"
            className={inputClass}
          />
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          <button type="submit" disabled={busy} className={buttonClass}>
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            Accedi
          </button>
        </form>
      </Card>
    );
  }

  if (stage.kind === "enroll" || stage.kind === "challenge") {
    const enrolling = stage.kind === "enroll";
    return (
      <Card>
        <ShieldCheck className="w-8 h-8 text-sage-600 mb-4" strokeWidth={1.5} />
        <h1 className="text-xl font-medium mb-1">
          {enrolling ? "Configura il secondo fattore" : "Codice di verifica"}
        </h1>
        <p className="text-sm text-stone-500 mb-5">
          {enrolling
            ? "Inquadra il codice con un'app di autenticazione (ad esempio Google Authenticator o Microsoft Authenticator), poi scrivi il codice a 6 cifre."
            : "Scrivi il codice a 6 cifre mostrato dalla tua app di autenticazione."}
        </p>
        {stage.kind === "enroll" && (
          <div className="mb-5">
            <img src={stage.qr} alt="Codice QR per l'app di autenticazione" className="w-48 h-48 mx-auto" />
            <p className="text-xs text-stone-500 mt-3 break-all">
              Se non puoi inquadrarlo, inserisci a mano questa chiave: <span className="font-mono">{stage.secret}</span>
            </p>
          </div>
        )}
        <form onSubmit={(e) => handleCode(e, stage.factorId)} className="space-y-4">
          <input
            name="code"
            required
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9 ]{6,7}"
            maxLength={7}
            placeholder="123456"
            className={inputClass + " text-center tracking-[0.4em] text-lg"}
          />
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          <button type="submit" disabled={busy} className={buttonClass}>
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            Verifica
          </button>
          <button type="button" onClick={() => void signOut()} className="w-full text-sm text-stone-500 hover:text-stone-700">
            Annulla
          </button>
        </form>
      </Card>
    );
  }

  return <Shell onSignOut={() => void signOut("Sei uscita dall'area riservata.")} api={api} />;
}

export function Shell({
  onSignOut,
  api,
  demo = false,
}: {
  onSignOut: () => void;
  api: RequestsApi;
  demo?: boolean;
}) {
  return (
    <div className="min-h-screen">
      <header className="bg-sage-800 text-white">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <p className="font-medium">
            Area riservata
            {demo && <span className="ml-2 text-xs bg-clay-400 text-white rounded px-2 py-0.5">DEMO – dati inventati</span>}
          </p>
          <button onClick={onSignOut} className="flex items-center gap-2 text-sm text-sage-100 hover:text-white">
            <LogOut className="w-4 h-4" /> Esci
          </button>
        </div>
      </header>
      <Requests api={api} />
    </div>
  );
}
