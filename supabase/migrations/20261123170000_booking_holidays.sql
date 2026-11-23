-- Festività chiuse e santo patrono nelle impostazioni delle prenotazioni.
--
-- closed_holidays: codici delle festività nazionali in cui non si prenota
--   (elenco in supabase/functions/availability/holidays.ts). Per impostazione
--   predefinita sono tutte chiuse; si modificano dall'area riservata.
-- patron_day: giorno del santo patrono nel formato MM-GG, oppure NULL.
--
-- Le domeniche non servono qui: sono chiuse finché non si aggiungono fasce
-- di lavoro alla domenica in working_hours.

ALTER TABLE public.booking_settings
  ADD COLUMN IF NOT EXISTS closed_holidays text[] NOT NULL DEFAULT ARRAY[
    'capodanno', 'epifania', 'pasqua', 'pasquetta', 'liberazione', 'lavoro',
    'repubblica', 'ferragosto', 'san_francesco', 'ognissanti', 'immacolata',
    'natale', 'santo_stefano'
  ]::text[],
  ADD COLUMN IF NOT EXISTS patron_day text
    CHECK (patron_day IS NULL OR patron_day ~ '^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$');

ALTER TABLE public.booking_settings
  DROP CONSTRAINT IF EXISTS booking_settings_closed_holidays_check;
ALTER TABLE public.booking_settings
  ADD CONSTRAINT booking_settings_closed_holidays_check CHECK (
    closed_holidays <@ ARRAY[
      'capodanno', 'epifania', 'pasqua', 'pasquetta', 'liberazione', 'lavoro',
      'repubblica', 'ferragosto', 'san_francesco', 'ognissanti', 'immacolata',
      'natale', 'santo_stefano'
    ]::text[]
  );

-- La funzione di salvataggio riceve anche festività e patrono.
DROP FUNCTION IF EXISTS public.save_booking_settings(integer, integer, integer, integer, jsonb);

CREATE OR REPLACE FUNCTION public.save_booking_settings(
  p_session_minutes integer,
  p_buffer_minutes integer,
  p_min_notice_hours integer,
  p_max_days_ahead integer,
  p_hours jsonb,
  p_closed_holidays text[],
  p_patron_day text
) RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;
  IF p_hours IS NULL OR jsonb_typeof(p_hours) <> 'array' OR jsonb_array_length(p_hours) > 50 THEN
    RAISE EXCEPTION 'invalid hours' USING ERRCODE = '22023';
  END IF;

  UPDATE public.booking_settings
  SET session_minutes = p_session_minutes,
      buffer_minutes = p_buffer_minutes,
      min_notice_hours = p_min_notice_hours,
      max_days_ahead = p_max_days_ahead,
      closed_holidays = coalesce(p_closed_holidays, ARRAY[]::text[]),
      patron_day = nullif(btrim(coalesce(p_patron_day, '')), ''),
      updated_at = pg_catalog.now()
  WHERE id;

  DELETE FROM public.working_hours WHERE true;

  INSERT INTO public.working_hours (weekday, start_time, end_time)
  SELECT (h->>'weekday')::smallint, (h->>'start_time')::time, (h->>'end_time')::time
  FROM jsonb_array_elements(p_hours) AS h;

  IF EXISTS (
    SELECT 1
    FROM public.working_hours a
    JOIN public.working_hours b
      ON a.weekday = b.weekday AND a.id <> b.id
     AND a.start_time < b.end_time AND b.start_time < a.end_time
  ) THEN
    RAISE EXCEPTION 'overlapping hours' USING ERRCODE = '22023';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.save_booking_settings(integer, integer, integer, integer, jsonb, text[], text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_booking_settings(integer, integer, integer, integer, jsonb, text[], text) TO authenticated;
