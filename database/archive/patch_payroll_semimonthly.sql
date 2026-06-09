USE highway_grill_hrms;

SET @has_run_type := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payroll_runs' AND COLUMN_NAME = 'run_type'
);
SET @sql := IF(@has_run_type = 0,
    "ALTER TABLE payroll_runs ADD COLUMN run_type ENUM('regular','13th_month') NOT NULL DEFAULT 'regular' AFTER pay_date",
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_pf := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payroll_runs' AND COLUMN_NAME = 'pay_frequency'
);
SET @sql := IF(@has_pf = 0,
    "ALTER TABLE payroll_runs ADD COLUMN pay_frequency ENUM('semi_monthly','monthly') NOT NULL DEFAULT 'semi_monthly' AFTER run_type",
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_hp := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payslips' AND COLUMN_NAME = 'holiday_pay'
);
SET @sql := IF(@has_hp = 0,
    "ALTER TABLE payslips ADD COLUMN holiday_pay DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER overtime_pay",
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS employee_benefit_enrollments (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    employee_id CHAR(36) NOT NULL,
    benefit_code VARCHAR(50) NOT NULL,
    benefit_name VARCHAR(100) NOT NULL,
    amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    frequency ENUM('monthly', 'per_payroll') NOT NULL DEFAULT 'monthly',
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    notes TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    INDEX idx_benefit_employee (employee_id, is_active)
) ENGINE=InnoDB;
