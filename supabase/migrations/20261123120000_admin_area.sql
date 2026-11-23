-- Area riservata: la professionista legge e gestisce le richieste di contatto.
--
-- Chi è amministratore:
--   * ha app_metadata.role = 'admin' (lo può impostare solo service_role, non l'utente);
--   * ha completato il secondo fattore (TOTP): il token deve avere aal = 'aal2'.
-- Senza entrambe le condizioni le policy non restituiscono nessuna riga.
--
-- Le righe esistenti non vengono modificate. Il vincolo sullo stato è NOT VALID:
-- vale per le scritture nuove e non ricontrolla le righe già presenti.
--
-- Questa migration NON attiva pg_cron: la pulizia si avvia dall'area riservata.

-- 1. Chi è amministratore -----------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
     AND coalesce(auth.jwt() ->> 'aal', '') = 'aal2';
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;

-- 2. Stato della richiesta ----------------------------------------------------

ALTER TABLE public.contact_requests
  ADD COLUMN IF NOT EXISTS status_changed_at timestamptz;

ALTER TABLE public.contact_requests
  DROP CONSTRAINT IF EXISTS contact_requests_status_check;
ALTER TABLE public.contact_requests
  ADD CONSTRAINT contact_requests_status_check
  CHECK (status IN ('new', 'contacted', 'closed')) NOT VALID;

CREATE OR REPLACE FUNCTION public.contact_requests_touch_status()
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

DROP TRIGGER IF EXISTS contact_requests_touch_status ON public.contact_requests;
CREATE TRIGGER contact_requests_touch_status
  BEFORE UPDATE OF status ON public.contact_requests
  FOR EACH ROW EXECUTE FUNCTION public.contact_requests_touch_status();

-- 3. Permessi: lettura, cambio di stato ed eliminazione, solo per l'admin ------
-- L'admin può modificare SOLO la colonna status: messaggio e dati inviati dalla
-- persona restano come sono arrivati.

GRANT SELECT, DELETE ON TABLE public.contact_requests TO authenticated;
GRANT UPDATE (status) ON TABLE public.contact_requests TO authenticated;

DROP POLICY IF EXISTS "admin_select_contact_requests" ON public.contact_requests;
CREATE POLICY "admin_select_contact_requests"
  ON public.contact_requests FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "admin_update_contact_requests" ON public.contact_requests;
CREATE POLICY "admin_update_contact_requests"
  ON public.contact_requests FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_delete_contact_requests" ON public.contact_requests;
CREATE POLICY "admin_delete_contact_requests"
  ON public.contact_requests FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- 4. Conservazione ------------------------------------------------------------
-- Una richiesta si cancella quando:
--   * è "chiusa" da più di 6 mesi, oppure
--   * è stata ricevuta più di 12 mesi fa, qualunque sia lo stato.
-- Le stesse regole sono descritte nell'area riservata (src/admin/Requests.tsx)
-- e vanno aggiornate insieme.
--
-- SECURITY INVOKER: le funzioni girano con i permessi di chi le chiama, quindi
-- passano anche dalle policy RLS qui sopra, oltre al controllo is_admin().
-- La pulizia di contact_rate_limits resta a delete_expired_contact_rate_limits()
-- (solo service_role), da programmare con pg_cron.

CREATE OR REPLACE FUNCTION public.count_expired_contact_requests()
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  expired integer;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;

  SELECT count(*) INTO expired
  FROM public.contact_requests
  WHERE (status = 'closed'
         AND coalesce(status_changed_at, created_at) < pg_catalog.now() - interval '6 months')
     OR created_at < pg_catalog.now() - interval '12 months';

  RETURN expired;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_expired_contact_requests()
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  deleted_count integer;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.contact_requests
  WHERE (status = 'closed'
         AND coalesce(status_changed_at, created_at) < pg_catalog.now() - interval '6 months')
     OR created_at < pg_catalog.now() - interval '12 months';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  RETURN deleted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.count_expired_contact_requests() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_expired_contact_requests() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.count_expired_contact_requests() TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_expired_contact_requests() TO authenticated;
