-- Adds the consultation mode chosen in the contact form.
-- Existing rows stay unchanged: the column is nullable and no UPDATE runs.

ALTER TABLE public.contact_requests
  ADD COLUMN IF NOT EXISTS consultation_mode text;
