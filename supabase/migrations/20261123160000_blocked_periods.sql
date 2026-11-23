-- Blocchi manuali: periodi in cui non si prenota, a prescindere dal calendario
-- (ferie, congressi, un pomeriggio libero).
--
-- Gli orari arrivano dall'area riservata come ora locale italiana e vengono
-- convertiti qui con il fuso di booking_settings.timezone (Europe/Rome), così
-- non dipendono dal fuso del computer da cui si inseriscono.
--
-- L'etichetta è facoltativa e breve (max 60 caratteri). L'area riservata chiede
-- di non scriverci nomi di pazienti. Accesso solo admin con secondo fattore.

CREATE TABLE IF NOT EXISTS public.blocked_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  all_day boolean NOT NULL DEFAULT false,
  label text CHECK (label IS NULL OR char_length(label) <= 60),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at),
  CHECK (ends_at - starts_at <= interval '366 days')
);

CREATE INDEX IF NOT EXISTS blocked_periods_range_idx ON public.blocked_periods (starts_at, ends_at);

ALTER TABLE public.blocked_periods ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.blocked_periods FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.blocked_periods TO authenticated;
GRANT SELECT ON TABLE public.blocked_periods TO service_role;

DROP POLICY IF EXISTS "admin_all_blocked_periods" ON public.blocked_periods;
CREATE POLICY "admin_all_blocked_periods"
  ON public.blocked_periods FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- p_start_local / p_end_local: ora locale (senza fuso). Per un blocco di giornate
-- intere l'area riservata manda l'inizio del primo giorno e l'inizio del giorno
-- dopo l'ultimo.
CREATE OR REPLACE FUNCTION public.add_blocked_period(
  p_start_local timestamp,
  p_end_local timestamp,
  p_all_day boolean,
  p_label text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  tz text;
  new_id uuid;
  clean_label text := nullif(btrim(coalesce(p_label, '')), '');
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;

  SELECT timezone INTO tz FROM public.booking_settings WHERE id;
  tz := coalesce(tz, 'Europe/Rome');

  IF (p_end_local AT TIME ZONE tz) <= pg_catalog.now() THEN
    RAISE EXCEPTION 'period in the past' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.blocked_periods (starts_at, ends_at, all_day, label)
  VALUES (p_start_local AT TIME ZONE tz, p_end_local AT TIME ZONE tz, coalesce(p_all_day, false), clean_label)
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.add_blocked_period(timestamp, timestamp, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_blocked_period(timestamp, timestamp, boolean, text) TO authenticated;
