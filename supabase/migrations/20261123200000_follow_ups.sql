-- Sedute successive fissate dalla professionista (singole o ricorrenti) e
-- sedute online gratuite in casi straordinari.
--
-- Una seduta successiva è una riga di bookings con first_booking_id = la prima
-- prenotazione del paziente. Nasce nello stato "proposed": tiene occupato
-- l'orario (nessuno può prenotarlo dal sito) ma va confermata ogni volta
-- dall'area riservata. Se l'orario passa senza conferma diventa "expired".
--
-- series_id raggruppa le sedute create insieme con una cadenza (settimanale,
-- ogni 2 o 4 settimane), così si può interrompere la serie.
--
-- PRIVACY: le sedute successive NON copiano nome, email o telefono: li leggono
-- dalla prima prenotazione. Eliminando la prima prenotazione (richiesta
-- dell'interessato) si eliminano anche tutte le sedute collegate.

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS first_booking_id uuid
    CONSTRAINT bookings_first_booking_id_fkey REFERENCES public.bookings (id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS series_id uuid,
  -- Casi straordinari: seduta online confermata senza pagamento.
  ADD COLUMN IF NOT EXISTS payment_waived boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS bookings_first_booking_idx ON public.bookings (first_booking_id);
CREATE INDEX IF NOT EXISTS bookings_series_idx ON public.bookings (series_id);

-- Nuovo stato "proposed" (si toglie il vecchio controllo sullo stato, qualunque
-- nome gli abbia dato Postgres).
DO $$
DECLARE c text;
BEGIN
  FOR c IN
    SELECT conname FROM pg_catalog.pg_constraint
    WHERE conrelid = 'public.bookings'::regclass AND contype = 'c'
      AND pg_catalog.pg_get_constraintdef(oid) LIKE '%status%'
      AND pg_catalog.pg_get_constraintdef(oid) LIKE '%expired%'
  LOOP
    EXECUTE pg_catalog.format('ALTER TABLE public.bookings DROP CONSTRAINT %I', c);
  END LOOP;
END $$;
ALTER TABLE public.bookings ADD CONSTRAINT bookings_status_check
  CHECK (status IN ('pending', 'proposed', 'declined', 'confirmed', 'awaiting_payment', 'paid', 'cancelled', 'expired'));

-- I dati del paziente e del consenso servono solo sulla prima prenotazione.
ALTER TABLE public.bookings
  ALTER COLUMN name DROP NOT NULL,
  ALTER COLUMN surname DROP NOT NULL,
  ALTER COLUMN email DROP NOT NULL,
  ALTER COLUMN adult_confirmed DROP NOT NULL,
  ALTER COLUMN privacy_version DROP NOT NULL,
  ALTER COLUMN privacy_accepted_at DROP NOT NULL,
  ALTER COLUMN idempotency_key DROP NOT NULL,
  ALTER COLUMN confirm_deadline DROP NOT NULL;

ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_patient_data;
ALTER TABLE public.bookings ADD CONSTRAINT bookings_patient_data CHECK (
  (first_booking_id IS NULL
    AND name IS NOT NULL AND surname IS NOT NULL AND email IS NOT NULL
    AND adult_confirmed IS NOT NULL AND privacy_version IS NOT NULL
    AND privacy_accepted_at IS NOT NULL AND idempotency_key IS NOT NULL
    AND confirm_deadline IS NOT NULL)
  OR
  (first_booking_id IS NOT NULL
    AND name IS NULL AND surname IS NULL AND email IS NULL AND phone IS NULL
    AND idempotency_key IS NULL AND first_booking_id <> id)
);

-- Anche le sedute proposte occupano l'orario.
ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_no_overlap;
ALTER TABLE public.bookings ADD CONSTRAINT bookings_no_overlap
  EXCLUDE USING gist (tstzrange(starts_at, ends_at, '[)') WITH &&)
  WHERE (status IN ('pending', 'proposed', 'awaiting_payment', 'confirmed', 'paid'));

-- Scadenze: anche le sedute proposte non confermate prima dell'inizio.
CREATE OR REPLACE FUNCTION public.expire_bookings()
RETURNS TABLE (id uuid, calendar_event_id text)
LANGUAGE sql
SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp
AS $$
  UPDATE public.bookings b
  SET status = 'expired'
  WHERE (b.status = 'pending' AND b.confirm_deadline <= pg_catalog.now())
     OR (b.status = 'proposed' AND b.starts_at <= pg_catalog.now())
     OR (b.status = 'awaiting_payment' AND b.payment_deadline <= pg_catalog.now())
  RETURNING b.id, b.calendar_event_id;
$$;

REVOKE ALL ON FUNCTION public.expire_bookings() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_bookings() TO service_role;
