USE highway_grill_hrms;

CREATE TABLE IF NOT EXISTS employee_loans (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    employee_id CHAR(36) NOT NULL,
    loan_type ENUM('salary', 'cash_advance') NOT NULL DEFAULT 'salary',
    principal DECIMAL(10,2) NOT NULL,
    balance DECIMAL(10,2) NOT NULL,
    term_months SMALLINT NOT NULL DEFAULT 6,
    monthly_deduction DECIMAL(10,2) NOT NULL,
    purpose TEXT,
    status ENUM('pending', 'approved', 'active', 'paid', 'rejected', 'cancelled') NOT NULL DEFAULT 'pending',
    approved_by CHAR(36) NULL,
    approved_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS loan_payments (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    loan_id CHAR(36) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    paid_on DATE NOT NULL,
    notes VARCHAR(255),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (loan_id) REFERENCES employee_loans(id) ON DELETE CASCADE
) ENGINE=InnoDB;

INSERT IGNORE INTO permissions (permission_key, permission_name, module) VALUES
('loans.self', 'View and apply for loans', 'payroll'),
('loans.manage', 'Approve and manage employee loans', 'payroll');

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r
JOIN permissions p ON p.permission_key IN ('loans.manage')
WHERE r.role_slug IN ('admin', 'hr');

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r
JOIN permissions p ON p.permission_key = 'loans.self'
WHERE r.role_slug = 'employee';
