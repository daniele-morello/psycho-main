import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { loadAvailability } from "../_shared/availability.ts";
import { expireBookings } from "../_shared/bookings.ts";
import { corsHeaders, json } from "../_shared/http.ts";

// Fasce libere per la prenotazione online.
//
// Unisce: orari di lavoro, impostazioni (con festività chiuse e santo patrono),
// blocchi manuali, prenotazioni già attive e gli intervalli "occupato" del
// Google Calendar della professionista (solo free/busy).
//
// PRIVACY: la risposta contiene solo gli orari di inizio delle fasce libere e se
// la seduta online è prenotabile. Nessun dato personale, nessun motivo
// dell'occupazione. Se il calendario non si legge non si offre nessuna fascia.
//
// Secret: GOOGLE_SERVICE_ACCOUNT_JSON, GOOGLE_CALENDAR_ID. L'online è prenotabile
// quando nell'area riservata ci sono prezzo e coordinate per il bonifico.

const METHODS = "GET";

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(request, METHODS) });
  if (request.method !== "GET") return json(request, METHODS, 405, { code: "invalid" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return json(request, METHODS, 503, { code: "unavailable" });
  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });

  await expireBookings(supabase);
  const result = await loadAvailability(supabase);
  if (!result.ok) return json(request, METHODS, 503, { code: "unavailable" });

  return json(request, METHODS, 200, {
    slots: result.slots.map((s) => new Date(s).toISOString()),
    session_minutes: result.settings.session_minutes,
    online: result.onlineAvailable,
    calendar: result.calendar,
  });
});
