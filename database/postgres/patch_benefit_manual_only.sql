-- Force manual-only deductions (no embedded statutory formulas on payroll).
BEGIN;

UPDATE employee_government_profiles SET
  sss_deduction_mode = 'manual',
  philhealth_deduction_mode = 'manual',
  pagibig_deduction_mode = 'manual',
  tax_deduction_mode = 'manual';

COMMIT;
