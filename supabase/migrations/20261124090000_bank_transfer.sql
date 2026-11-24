-- Pagamento delle sedute online con bonifico anticipato (al posto di Stripe).
--
-- Flusso: la professionista accetta la richiesta online e invia le coordinate
-- (stato awaiting_payment); quando riceve il bonifico lo segna come ricevuto
-- (stato paid) e solo allora l'appuntamento è confermato. Le sedute in presenza
-- si pagano allo studio e non cambiano.
--
-- bank_holder / bank_iban: coordinate della professionista, mostrate al
-- paziente nell'email con la richiesta di bonifico. Nessun dato del paziente.
-- L'IBAN si salva senza spazi e in maiuscolo.

ALTER TABLE public.booking_settings
  ADD COLUMN IF NOT EXISTS bank_holder text
    CHECK (bank_holder IS NULL OR char_length(bank_holder) BETWEEN 2 AND 100),
  ADD COLUMN IF NOT EXISTS bank_iban text
    CHECK (bank_iban IS NULL OR bank_iban ~ '^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$');
