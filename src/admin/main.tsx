import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AdminApp, Shell } from "@/admin/AdminApp";
import { demoApi } from "@/admin/api";
import { adminClient } from "@/admin/client";
import "./admin.css";

const root = createRoot(document.getElementById("root")!);
const demo = import.meta.env.DEV && new URLSearchParams(window.location.search).has("demo");

root.render(
  <StrictMode>
    {demo ? (
      <Shell api={demoApi()} demo onSignOut={() => window.location.assign("admin.html")} />
    ) : adminClient ? (
      <AdminApp client={adminClient} />
    ) : (
      <p style={{ padding: 24 }}>Configurazione mancante: VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.</p>
    )}
  </StrictMode>,
);
