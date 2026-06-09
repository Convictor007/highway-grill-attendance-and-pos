-- Mock paid semi-monthly payroll + payslips for all active employee-portal users.
-- Safe to re-run. Use on existing DBs without full reseed.
USE highway_grill_hrms;

SET @branch_id = (SELECT id FROM branches LIMIT 1);
SET @hr_user_id = (
  SELECT u.id FROM users u
  JOIN roles r ON r.role_id = u.role_id
  WHERE r.role_slug IN ('hr', 'admin')
  ORDER BY r.role_slug = 'hr' DESC
  LIMIT 1
);
SET @prev_month_start = DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 1 MONTH), '%Y-%m-01');
SET @prev_month_mid = DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 1 MONTH), '%Y-%m-15');
SET @prev_month_16 = DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 1 MONTH), '%Y-%m-16');
SET @prev_month_end = LAST_DAY(DATE_SUB(CURDATE(), INTERVAL 1 MONTH));

INSERT INTO employee_benefit_enrollments (id, employee_id, benefit_code, benefit_name, amount, frequency, is_active)
SELECT UUID(), e.id, 'rice', 'Rice allowance', 1500.00, 'monthly', 1
FROM employees e
INNER JOIN users u ON u.employee_id = e.id
INNER JOIN roles r ON r.role_id = u.role_id AND r.role_slug = 'employee'
WHERE e.status = 'active'
  AND NOT EXISTS (
    SELECT 1 FROM employee_benefit_enrollments be
    WHERE be.employee_id = e.id AND be.benefit_code = 'rice'
  );

INSERT INTO payroll_runs (
  id, branch_id, period_start, period_end, pay_date, run_type, pay_frequency,
  status, total_gross, total_net, processed_by, processed_at
)
SELECT UUID(), @branch_id, @prev_month_start, @prev_month_mid, @prev_month_mid,
  'regular', 'semi_monthly', 'paid', 8540.00, 7844.00, @hr_user_id, NOW()
FROM DUAL
WHERE @branch_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM payroll_runs pr
    WHERE pr.branch_id = @branch_id AND pr.period_start = @prev_month_start
      AND pr.period_end = @prev_month_mid AND pr.run_type = 'regular'
  );

SET @pay_run_1 = (
  SELECT id FROM payroll_runs
  WHERE branch_id = @branch_id AND period_start = @prev_month_start
    AND period_end = @prev_month_mid AND run_type = 'regular' LIMIT 1
);

INSERT INTO payslips (
  id, payroll_run_id, employee_id, regular_hours, overtime_hours, holiday_hours,
  basic_pay, overtime_pay, holiday_pay, tips_amount, service_charge,
  gross_pay, sss_amount, philhealth_amount, pagibig_amount, tax_amount, other_deductions, net_pay, generated_at
)
SELECT UUID(), @pay_run_1, e.id, 88.00, 4.00, 0.00, 7040.00, 400.00, 0.00, 350.00, 750.00,
  8540.00, 382.50, 213.50, 100.00, 0.00, 0.00, 7844.00, NOW()
FROM employees e
INNER JOIN users u ON u.employee_id = e.id
INNER JOIN roles r ON r.role_id = u.role_id AND r.role_slug = 'employee'
WHERE @pay_run_1 IS NOT NULL AND e.status = 'active'
  AND NOT EXISTS (SELECT 1 FROM payslips WHERE payroll_run_id = @pay_run_1 AND employee_id = e.id);

INSERT INTO payroll_runs (
  id, branch_id, period_start, period_end, pay_date, run_type, pay_frequency,
  status, total_gross, total_net, processed_by, processed_at
)
SELECT UUID(), @branch_id, @prev_month_16, @prev_month_end, @prev_month_end,
  'regular', 'semi_monthly', 'paid', 8910.00, 8176.50, @hr_user_id, NOW()
FROM DUAL
WHERE @branch_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM payroll_runs pr
    WHERE pr.branch_id = @branch_id AND pr.period_start = @prev_month_16
      AND pr.period_end = @prev_month_end AND pr.run_type = 'regular'
  );

SET @pay_run_2 = (
  SELECT id FROM payroll_runs
  WHERE branch_id = @branch_id AND period_start = @prev_month_16
    AND period_end = @prev_month_end AND run_type = 'regular' LIMIT 1
);

INSERT INTO payslips (
  id, payroll_run_id, employee_id, regular_hours, overtime_hours, holiday_hours,
  basic_pay, overtime_pay, holiday_pay, tips_amount, service_charge,
  gross_pay, sss_amount, philhealth_amount, pagibig_amount, tax_amount, other_deductions, net_pay, generated_at
)
SELECT UUID(), @pay_run_2, e.id, 96.00, 2.00, 0.00, 7680.00, 200.00, 0.00, 280.00, 750.00,
  8910.00, 382.50, 222.75, 100.00, 0.00, 28.25, 8176.50, NOW()
FROM employees e
INNER JOIN users u ON u.employee_id = e.id
INNER JOIN roles r ON r.role_id = u.role_id AND r.role_slug = 'employee'
WHERE @pay_run_2 IS NOT NULL AND e.status = 'active'
  AND NOT EXISTS (SELECT 1 FROM payslips WHERE payroll_run_id = @pay_run_2 AND employee_id = e.id);

UPDATE payroll_runs pr
SET
  total_gross = (SELECT COALESCE(SUM(gross_pay), 0) FROM payslips ps WHERE ps.payroll_run_id = pr.id),
  total_net = (SELECT COALESCE(SUM(net_pay), 0) FROM payslips ps WHERE ps.payroll_run_id = pr.id)
WHERE pr.id IN (@pay_run_1, @pay_run_2);
