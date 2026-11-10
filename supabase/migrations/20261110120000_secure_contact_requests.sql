-- Secure contact requests.
-- Existing rows are left unchanged: new columns are nullable and no UPDATE/DELETE runs.
-- After this migration the public anon key can no longer insert. Only the Edge
-- Function, using the service role, can insert new requests.

ALTER TABLE contact_requests
  ADD COLUMN IF NOT EXISTS privacy_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS privacy_version text,
  ADD COLUMN IF NOT EXISTS idempotency_key uuid;

CREATE UNIQUE INDEX IF NOT EXISTS contact_requests_idempotency_key_key
  ON contact_requests (idempotency_key);

CREATE TABLE IF NOT EXISTS contact_rate_limits (
  email_hash text NOT NULL,
  window_start timestamptz NOT NULL,
  request_count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (email_hash, window_start)
);

ALTER TABLE contact_rate_limits ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE contact_rate_limits FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE contact_rate_limits TO service_role;

-- Single-statement upsert. Concurrent requests with the same hash and window
-- serialize on the primary key, so the counter cannot be lost.
CREATE OR REPLACE FUNCTION public.consume_contact_rate_limit(
  p_email_hash text,
  p_window_start timestamptz
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  new_count integer;
BEGIN
  IF p_email_hash IS NULL OR length(p_email_hash) < 32 OR length(p_email_hash) > 128 THEN
    RAISE EXCEPTION 'invalid rate limit key';
  END IF;

  IF p_window_start IS NULL THEN
    RAISE EXCEPTION 'invalid rate limit window';
  END IF;

  INSERT INTO public.contact_rate_limits (email_hash, window_start, request_count)
  VALUES (p_email_hash, p_window_start, 1)
  ON CONFLICT (email_hash, window_start)
  DO UPDATE SET request_count = public.contact_rate_limits.request_count + 1
  RETURNING request_count INTO new_count;

  RETURN new_count;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_contact_rate_limit(text, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_contact_rate_limit(text, timestamptz) TO service_role;

-- Manual cleanup only. The one-hour window makes rows older than 48 hours useless.
-- This function is not scheduled. Do not enable pg_cron until that plan is accepted.
CREATE OR REPLACE FUNCTION public.delete_expired_contact_rate_limits()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM public.contact_rate_limits
  WHERE window_start < pg_catalog.now() - interval '48 hours';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_expired_contact_rate_limits() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_expired_contact_rate_limits() TO service_role;

-- Removes the public insert path. Existing rows stay.
DROP POLICY IF EXISTS "anon_insert_contact_requests" ON public.contact_requests;

REVOKE ALL ON TABLE public.contact_requests FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT ON TABLE public.contact_requests TO service_role;
