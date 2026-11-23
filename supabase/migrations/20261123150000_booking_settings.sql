-- Impostazioni delle prenotazioni, modificabili dall'area riservata.
--
-- booking_settings: una sola riga con durata della seduta, pausa, preavviso
--   minimo e orizzonte di prenotazione.
-- working_hours: fasce di lavoro per giorno della settimana (1 = lunedì ...
--   7 = domenica, come ISO 8601). Più fasce nello stesso giorno sono ammesse
--   (per esempio 9-13 e 15-19), purché non si sovrappongano.
--
-- Nessun dato personale in queste tabelle. Lettura e scrittura solo per l'admin
-- con secondo fattore (is_admin). Il calcolo delle disponibilità per i pazienti
-- arriverà con la fase successiva, lato server.

CREATE TABLE IF NOT EXISTS public.booking_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  session_minutes integer NOT NULL DEFAULT 50 CHECK (session_minutes BETWEEN 15 AND 240),
  buffer_minutes integer NOT NULL DEFAULT 10 CHECK (buffer_minutes BETWEEN 0 AND 120),
  min_notice_hours integer NOT NULL DEFAULT 24 CHECK (min_notice_hours BETWEEN 0 AND 720),
  max_days_ahead integer NOT NULL DEFAULT 60 CHECK (max_days_ahead BETWEEN 1 AND 365),
  timezone text NOT NULL DEFAULT 'Europe/Rome',
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.booking_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.working_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  weekday smallint NOT NULL CHECK (weekday BETWEEN 1 AND 7),
  start_time time NOT NULL,
  end_time time NOT NULL,
  CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS working_hours_weekday_idx ON public.working_hours (weekday, start_time);

ALTER TABLE public.booking_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.working_hours ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.booking_settings FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.working_hours FROM PUBLIC, anon, authenticated;
GRANT SELECT, UPDATE ON TABLE public.booking_settings TO authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.working_hours TO authenticated;
GRANT SELECT ON TABLE public.booking_settings, public.working_hours TO service_role;

DROP POLICY IF EXISTS "admin_all_booking_settings" ON public.booking_settings;
CREATE POLICY "admin_all_booking_settings"
  ON public.booking_settings FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_all_working_hours" ON public.working_hours;
CREATE POLICY "admin_all_working_hours"
  ON public.working_hours FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Salva impostazioni e orari in un'unica transazione: o tutto o niente.
-- p_hours: [{"weekday":1,"start_time":"09:00","end_time":"13:00"}, ...]
CREATE OR REPLACE FUNCTION public.save_booking_settings(
  p_session_minutes integer,
  p_buffer_minutes integer,
  p_min_notice_hours integer,
  p_max_days_ahead integer,
  p_hours jsonb
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
      updated_at = pg_catalog.now()
  WHERE id;

  DELETE FROM public.working_hours WHERE true;

  INSERT INTO public.working_hours (weekday, start_time, end_time)
  SELECT (h->>'weekday')::smallint, (h->>'start_time')::time, (h->>'end_time')::time
  FROM jsonb_array_elements(p_hours) AS h;

  -- Fasce sovrapposte nello stesso giorno: annulla tutto.
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

REVOKE ALL ON FUNCTION public.save_booking_settings(integer, integer, integer, integer, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_booking_settings(integer, integer, integer, integer, jsonb) TO authenticated;
