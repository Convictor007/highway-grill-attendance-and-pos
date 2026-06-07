USE highway_grill_hrms;

-- payroll run type (regular vs 13th month)
SET @has_col := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payroll_runs' AND COLUMN_NAME = 'run_type'
);
SET @sql := IF(@has_col = 0,
    "ALTER TABLE payroll_runs ADD COLUMN run_type ENUM('regular','13th_month') NOT NULL DEFAULT 'regular' AFTER pay_date",
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- recurring employee benefits / allowances
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

-- sample PH holidays (2026) — safe to re-run
INSERT IGNORE INTO holidays (id, branch_id, holiday_date, name, holiday_type, pay_multiplier) VALUES
(UUID(), NULL, '2026-01-01', 'New Year\'s Day', 'national', 2.00),
(UUID(), NULL, '2026-04-09', 'Araw ng Kagitingan', 'national', 2.00),
(UUID(), NULL, '2026-04-17', 'Maundy Thursday', 'national', 2.00),
(UUID(), NULL, '2026-04-18', 'Good Friday', 'national', 2.00),
(UUID(), NULL, '2026-05-01', 'Labor Day', 'national', 2.00),
(UUID(), NULL, '2026-06-12', 'Independence Day', 'national', 2.00),
(UUID(), NULL, '2026-12-25', 'Christmas Day', 'national', 2.00),
(UUID(), NULL, '2026-12-30', 'Rizal Day', 'national', 2.00);
