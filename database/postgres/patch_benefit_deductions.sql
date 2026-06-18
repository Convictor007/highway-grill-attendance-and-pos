-- Per-employee statutory deduction amounts (auto from salary or fixed monthly).
-- Run once on live Postgres after deploying benefits deduction management.

BEGIN;

ALTER TABLE employee_government_profiles
  ADD COLUMN IF NOT EXISTS sss_deduction_mode VARCHAR(10) NOT NULL DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS sss_monthly_amount NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS philhealth_deduction_mode VARCHAR(10) NOT NULL DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS philhealth_monthly_amount NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS pagibig_deduction_mode VARCHAR(10) NOT NULL DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS pagibig_monthly_amount NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS tax_deduction_mode VARCHAR(10) NOT NULL DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS tax_monthly_amount NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS tax_enrolled BOOLEAN NOT NULL DEFAULT true;

COMMIT;
