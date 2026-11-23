import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// La sessione sta in sessionStorage: chiudendo la scheda o il browser si esce.
// Non resta nulla su un computer condiviso.
export const adminClient: SupabaseClient | null =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: {
          storage: window.sessionStorage,
          storageKey: "studio-admin-auth",
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
        },
      })
    : null;
