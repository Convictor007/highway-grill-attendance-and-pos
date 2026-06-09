-- Stay-in / housing deduction per employee (deducted each payroll period)
USE highway_grill_hrms;

ALTER TABLE employees
  ADD COLUMN is_stay_in TINYINT(1) NOT NULL DEFAULT 0
    COMMENT 'Employee uses company stay-in housing',
  ADD COLUMN housing_deduction DECIMAL(10,2) NOT NULL DEFAULT 0
    COMMENT 'Housing deduction amount per payroll run (semi-monthly default)';
