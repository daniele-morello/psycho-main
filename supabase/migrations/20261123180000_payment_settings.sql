-- Impostazioni del pagamento online, della disdetta e della videochiamata.
-- Modificabili dall'area riservata (tab "Pagamento e disdetta").
--
-- online_price_cents: prezzo del primo colloquio online, in centesimi.
--   NULL = non impostato: finché manca, non si può chiedere il pagamento.
-- payment_window_hours: ore che il paziente ha per pagare dopo la conferma.
-- payment_cutoff_hours: il pagamento deve arrivare comunque almeno queste ore
--   prima della seduta.
-- refund_notice_hours: rimborso completo se la disdetta arriva almeno queste
--   ore prima della seduta.
-- cancellation_note: testo facoltativo aggiunto alla regola di disdetta.
-- video_platform / video_instructions: cosa viene detto al paziente sulla
--   videochiamata. Il link della singola seduta non è qui.
--
-- Nessun dato personale. Lettura e modifica solo admin con secondo fattore
-- (policy già presente su booking_settings).

ALTER TABLE public.booking_settings
  ADD COLUMN IF NOT EXISTS online_price_cents integer
    CHECK (online_price_cents IS NULL OR online_price_cents BETWEEN 100 AND 100000),
  ADD COLUMN IF NOT EXISTS payment_window_hours integer NOT NULL DEFAULT 48
    CHECK (payment_window_hours BETWEEN 1 AND 336),
  ADD COLUMN IF NOT EXISTS payment_cutoff_hours integer NOT NULL DEFAULT 24
    CHECK (payment_cutoff_hours BETWEEN 0 AND 336),
  ADD COLUMN IF NOT EXISTS refund_notice_hours integer NOT NULL DEFAULT 48
    CHECK (refund_notice_hours BETWEEN 0 AND 720),
  ADD COLUMN IF NOT EXISTS cancellation_note text
    CHECK (cancellation_note IS NULL OR char_length(cancellation_note) <= 500),
  ADD COLUMN IF NOT EXISTS video_platform text
    CHECK (video_platform IS NULL OR char_length(video_platform) <= 60),
  ADD COLUMN IF NOT EXISTS video_instructions text
    CHECK (video_instructions IS NULL OR char_length(video_instructions) <= 500);
