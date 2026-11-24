-- Prenotazioni del primo colloquio.
--
-- Stati:
--   pending           richiesta del paziente, da confermare o rifiutare
--   declined          rifiutata dalla professionista
--   confirmed         confermata (in presenza: si paga allo studio)
--   awaiting_payment  confermata, seduta online in attesa di pagamento
--   paid              seduta online pagata
--   cancelled         annullata dopo la conferma (disdetta)
--   expired           non confermata o non pagata in tempo
--
-- Una fascia è occupata dagli stati pending, awaiting_payment, confirmed e paid.
-- Il vincolo di esclusione impedisce due prenotazioni attive sovrapposte anche
-- se arrivano nello stesso istante.
--
-- PRIVACY: si raccolgono solo i dati necessari a fissare l'appuntamento. Nessun
-- campo per messaggi o motivi della richiesta. In Google Calendar finisce solo
-- il codice di riferimento (ref), mai nome o contatti. Le scritture passano dalle
-- funzioni del server; l'area riservata legge solo con ruolo admin e secondo
-- fattore.

ALTER TABLE public.booking_settings
  ADD COLUMN IF NOT EXISTS confirm_window_hours integer NOT NULL DEFAULT 48
    CHECK (confirm_window_hours BETWEEN 1 AND 336);

CREATE TABLE IF NOT EXISTS public.bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ref text NOT NULL UNIQUE DEFAULT upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6)),
  created_at timestamptz NOT NULL DEFAULT now(),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  mode text NOT NULL CHECK (mode IN ('online', 'in_presenza')),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'declined', 'confirmed', 'awaiting_payment', 'paid', 'cancelled', 'expired')),
  status_changed_at timestamptz NOT NULL DEFAULT now(),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  surname text NOT NULL CHECK (char_length(surname) BETWEEN 1 AND 80),
  email text NOT NULL CHECK (char_length(email) <= 254),
  phone text CHECK (phone IS NULL OR char_length(phone) <= 30),
  adult_confirmed boolean NOT NULL CHECK (adult_confirmed),
  privacy_version text NOT NULL,
  privacy_accepted_at timestamptz NOT NULL,
  idempotency_key uuid NOT NULL UNIQUE,
  confirm_deadline timestamptz NOT NULL,
  payment_deadline timestamptz,
  price_cents integer CHECK (price_cents IS NULL OR price_cents >= 100),
  pay_token uuid UNIQUE,
  link_sent_at timestamptz,
  paid_at timestamptz,
  calendar_event_id text,
  CHECK (ends_at > starts_at),
  CONSTRAINT bookings_no_overlap EXCLUDE USING gist (tstzrange(starts_at, ends_at, '[)') WITH &&)
    WHERE (status IN ('pending', 'awaiting_payment', 'confirmed', 'paid'))
);

CREATE INDEX IF NOT EXISTS bookings_status_idx ON public.bookings (status, starts_at);

CREATE OR REPLACE FUNCTION public.bookings_touch_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.status_changed_at := pg_catalog.now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bookings_touch_status ON public.bookings;
CREATE TRIGGER bookings_touch_status
  BEFORE UPDATE OF status ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.bookings_touch_status();

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.bookings FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.bookings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.bookings TO service_role;

DROP POLICY IF EXISTS "admin_select_bookings" ON public.bookings;
CREATE POLICY "admin_select_bookings"
  ON public.bookings FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Prenotazioni non confermate o non pagate in tempo -> expired. Restituisce gli
-- id con evento in calendario, che la funzione chiamante cancella da Google.
CREATE OR REPLACE FUNCTION public.expire_bookings()
RETURNS TABLE (id uuid, calendar_event_id text)
LANGUAGE sql
SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp
AS $$
  UPDATE public.bookings b
  SET status = 'expired'
  WHERE (b.status = 'pending' AND b.confirm_deadline <= pg_catalog.now())
     OR (b.status = 'awaiting_payment' AND b.payment_deadline <= pg_catalog.now())
  RETURNING b.id, b.calendar_event_id;
$$;

REVOKE ALL ON FUNCTION public.expire_bookings() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_bookings() TO service_role;
