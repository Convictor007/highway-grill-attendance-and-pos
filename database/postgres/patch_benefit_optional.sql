-- Optional benefits: manual defaults, no deduction without member ID.
-- Run after patch_benefit_deductions.sql on live Postgres.

BEGIN;

ALTER TABLE employee_government_profiles
  ALTER COLUMN sss_deduction_mode SET DEFAULT 'manual',
  ALTER COLUMN philhealth_deduction_mode SET DEFAULT 'manual',
  ALTER COLUMN pagibig_deduction_mode SET DEFAULT 'manual',
  ALTER COLUMN tax_deduction_mode SET DEFAULT 'manual',
  ALTER COLUMN sss_enrolled SET DEFAULT false,
  ALTER COLUMN philhealth_enrolled SET DEFAULT false,
  ALTER COLUMN pagibig_enrolled SET DEFAULT false,
  ALTER COLUMN tax_enrolled SET DEFAULT false;

UPDATE employee_government_profiles SET sss_enrolled = false
  WHERE sss_number IS NULL OR TRIM(sss_number) = '';
UPDATE employee_government_profiles SET philhealth_enrolled = false
  WHERE philhealth_number IS NULL OR TRIM(philhealth_number) = '';
UPDATE employee_government_profiles SET pagibig_enrolled = false
  WHERE pagibig_number IS NULL OR TRIM(pagibig_number) = '';
UPDATE employee_government_profiles SET tax_enrolled = false
  WHERE tin IS NULL OR TRIM(tin) = '';

COMMIT;
