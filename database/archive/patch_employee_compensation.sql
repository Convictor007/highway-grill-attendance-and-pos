-- Employee pay rate (hourly or daily) for payroll — run once
USE highway_grill_hrms;

ALTER TABLE employees
  ADD COLUMN pay_basis ENUM('hourly', 'daily') NOT NULL DEFAULT 'hourly' AFTER employment_type;

ALTER TABLE employees
  ADD COLUMN pay_rate DECIMAL(10,2) NULL COMMENT 'Hourly or daily rate' AFTER pay_basis;

UPDATE employees e
LEFT JOIN positions p ON p.id = e.position_id
SET e.pay_rate = COALESCE(e.pay_rate, p.min_hourly, 80.00)
WHERE e.status = 'active' AND (e.pay_rate IS NULL OR e.pay_rate = 0);
