/*
# Create contact_requests table (single-tenant, no auth)

1. New Tables
- `contact_requests`
  - `id` (uuid, primary key)
  - `name` (text, not null) — sender's full name
  - `email` (text, not null) — sender's email
  - `phone` (text) — optional phone number
  - `message` (text, not null) — the message body
  - `preferred_time` (text) — optional preferred appointment time
  - `service` (text) — optional area of interest
  - `status` (text, default 'new') — tracking status: new, contacted, closed
  - `created_at` (timestamptz, default now())

2. Security
- Enable RLS on `contact_requests`.
- Grant INSERT to anon + authenticated so visitors can submit the form.
- Allow anon + authenticated INSERT (the form is intentionally public).
- No SELECT/UPDATE/DELETE for anon — only the therapist (service_role) reads and manages requests.
*/

CREATE TABLE IF NOT EXISTS contact_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  message text NOT NULL,
  preferred_time text,
  service text,
  status text NOT NULL DEFAULT 'new',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE contact_requests ENABLE ROW LEVEL SECURITY;

GRANT INSERT ON contact_requests TO anon, authenticated;

DROP POLICY IF EXISTS "anon_insert_contact_requests" ON contact_requests;
CREATE POLICY "anon_insert_contact_requests"
ON contact_requests FOR INSERT
TO anon, authenticated WITH CHECK (true);
