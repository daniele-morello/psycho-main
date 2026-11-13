-- Adds the surname collected by the contact form.
-- Existing rows stay unchanged: the column is nullable and no UPDATE runs.

ALTER TABLE public.contact_requests
  ADD COLUMN IF NOT EXISTS surname text;
