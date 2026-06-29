-- Add 'emailed' to payslips.payment_status (Ready to pay -> Email sent -> Paid).
-- Idempotent: safe to run multiple times.

BEGIN;

ALTER TABLE payslips DROP CONSTRAINT IF EXISTS payslips_payment_status_check;

ALTER TABLE payslips
  ADD CONSTRAINT payslips_payment_status_check
  CHECK (payment_status IN ('pending', 'ready', 'emailed', 'paid', 'deferred'));

COMMIT;
