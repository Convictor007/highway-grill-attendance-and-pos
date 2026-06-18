-- =============================================================================
-- seed_benefits.sql — government profiles + allowances for active crew
-- Safe to re-run (upserts). Run after patch_benefit_deductions + patch_benefit_optional.
--
-- Scenarios (by employee row order, excluding admin-linked accounts):
--   1 mod 4 = 0 → SSS + PhilHealth + Pag-IBIG + TIN (full manual deductions)
--   1 mod 4 = 1 → SSS + Pag-IBIG only
--   1 mod 4 = 2 → PhilHealth only
--   1 mod 4 = 3 → skipped (no profile — optional benefits)
-- =============================================================================

WITH crew AS (
  SELECT
    e.id,
    e.emp_number,
    ROW_NUMBER() OVER (ORDER BY e.id) AS rn
  FROM employees e
  WHERE e.status = 'active'
    AND NOT EXISTS (
      SELECT 1
      FROM users u
      INNER JOIN roles r ON r.role_id = u.role_id
      WHERE u.employee_id = e.id AND r.role_slug = 'admin'
    )
),
numbered AS (
  SELECT
    id,
    emp_number,
    rn,
    (rn - 1) % 4 AS bucket,
    LPAD((id * 17 % 10000000)::text, 7, '0') AS sss_mid,
    LPAD((id * 23 % 1000000000)::text, 9, '0') AS phil_mid,
    LPAD((id * 29 % 10000000)::text, 8, '0') AS pag_mid,
    LPAD((id * 31 % 100000000)::text, 9, '0') AS tin_mid
  FROM crew
  WHERE (rn - 1) % 4 <> 3
)
INSERT INTO employee_government_profiles (
  employee_id,
  sss_number,
  philhealth_number,
  pagibig_number,
  tin,
  sss_enrolled,
  philhealth_enrolled,
  pagibig_enrolled,
  tax_enrolled,
  sss_deduction_mode,
  sss_monthly_amount,
  philhealth_deduction_mode,
  philhealth_monthly_amount,
  pagibig_deduction_mode,
  pagibig_monthly_amount,
  tax_deduction_mode,
  tax_monthly_amount,
  notes
)
SELECT
  n.id,
  CASE WHEN n.bucket IN (0, 1) THEN '34-' || n.sss_mid || '-' || (n.id % 10)::text ELSE NULL END,
  CASE WHEN n.bucket IN (0, 2) THEN '12-' || n.phil_mid || '-' || (n.id % 10)::text ELSE NULL END,
  CASE WHEN n.bucket IN (0, 1) THEN '1212-' || SUBSTRING(n.pag_mid FROM 1 FOR 4) || '-' || SUBSTRING(n.pag_mid FROM 5 FOR 4) ELSE NULL END,
  CASE WHEN n.bucket = 0 THEN n.tin_mid || '-000' ELSE NULL END,
  n.bucket IN (0, 1),
  n.bucket IN (0, 2),
  n.bucket IN (0, 1),
  n.bucket = 0,
  'manual',
  CASE WHEN n.bucket IN (0, 1) THEN 270.00 ELSE NULL END,
  'manual',
  CASE WHEN n.bucket IN (0, 2) THEN 147.88 ELSE NULL END,
  'manual',
  CASE WHEN n.bucket IN (0, 1) THEN 100.00 ELSE NULL END,
  'manual',
  CASE WHEN n.bucket = 0 THEN 0.00 ELSE NULL END,
  'Seeded benefit profile (' || n.emp_number || ')'
FROM numbered n
ON CONFLICT (employee_id) DO UPDATE SET
  sss_number = EXCLUDED.sss_number,
  philhealth_number = EXCLUDED.philhealth_number,
  pagibig_number = EXCLUDED.pagibig_number,
  tin = EXCLUDED.tin,
  sss_enrolled = EXCLUDED.sss_enrolled,
  philhealth_enrolled = EXCLUDED.philhealth_enrolled,
  pagibig_enrolled = EXCLUDED.pagibig_enrolled,
  tax_enrolled = EXCLUDED.tax_enrolled,
  sss_deduction_mode = EXCLUDED.sss_deduction_mode,
  sss_monthly_amount = EXCLUDED.sss_monthly_amount,
  philhealth_deduction_mode = EXCLUDED.philhealth_deduction_mode,
  philhealth_monthly_amount = EXCLUDED.philhealth_monthly_amount,
  pagibig_deduction_mode = EXCLUDED.pagibig_deduction_mode,
  pagibig_monthly_amount = EXCLUDED.pagibig_monthly_amount,
  tax_deduction_mode = EXCLUDED.tax_deduction_mode,
  tax_monthly_amount = EXCLUDED.tax_monthly_amount,
  notes = EXCLUDED.notes,
  updated_at = NOW();

-- Rice allowance for crew with at least one government ID on file
INSERT INTO employee_benefit_enrollments (employee_id, benefit_code, benefit_name, amount, frequency, is_active, notes)
SELECT
  gp.employee_id,
  'rice',
  'Rice allowance',
  1500.00,
  'monthly',
  true,
  'Seeded allowance'
FROM employee_government_profiles gp
INNER JOIN employees e ON e.id = gp.employee_id AND e.status = 'active'
WHERE (gp.sss_number IS NOT NULL
   OR gp.philhealth_number IS NOT NULL
   OR gp.pagibig_number IS NOT NULL)
  AND NOT EXISTS (
    SELECT 1 FROM employee_benefit_enrollments be
    WHERE be.employee_id = gp.employee_id AND be.benefit_code = 'rice'
  );

-- Meal allowance for full-benefit employees (bucket 0)
INSERT INTO employee_benefit_enrollments (employee_id, benefit_code, benefit_name, amount, frequency, is_active, notes)
SELECT
  gp.employee_id,
  'meal',
  'Meal allowance',
  800.00,
  'per_payroll',
  true,
  'Seeded allowance'
FROM employee_government_profiles gp
WHERE gp.sss_number IS NOT NULL
  AND gp.philhealth_number IS NOT NULL
  AND gp.pagibig_number IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM employee_benefit_enrollments be
    WHERE be.employee_id = gp.employee_id AND be.benefit_code = 'meal'
  );

SELECT
  'benefits seed complete' AS status,
  (SELECT COUNT(*)::int FROM employee_government_profiles) AS government_profiles,
  (SELECT COUNT(*)::int FROM employee_benefit_enrollments WHERE benefit_code IN ('rice', 'meal')) AS allowance_rows,
  (SELECT COUNT(*)::int FROM employee_government_profiles WHERE sss_number IS NOT NULL) AS with_sss,
  (SELECT COUNT(*)::int FROM employee_government_profiles WHERE philhealth_number IS NOT NULL) AS with_philhealth,
  (SELECT COUNT(*)::int FROM employee_government_profiles WHERE pagibig_number IS NOT NULL) AS with_pagibig;
