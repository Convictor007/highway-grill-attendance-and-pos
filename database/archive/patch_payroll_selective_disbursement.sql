-- Option A: selective payroll — per-employee pay / defer (safe to re-run)
USE highway_grill_hrms;

ALTER TABLE payroll_runs
  MODIFY status ENUM('draft', 'processing', 'partially_paid', 'approved', 'paid', 'cancelled')
  NOT NULL DEFAULT 'draft';

ALTER TABLE payslips
  ADD COLUMN payment_status ENUM('ready', 'paid', 'deferred') NOT NULL DEFAULT 'ready' AFTER net_pay;

ALTER TABLE payslips
  ADD COLUMN paid_at DATETIME NULL AFTER payment_status;

CREATE TABLE IF NOT EXISTS payroll_run_deferrals (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    payroll_run_id CHAR(36) NOT NULL,
    employee_id CHAR(36) NOT NULL,
    note VARCHAR(255) NULL,
    deferred_by CHAR(36) NULL,
    deferred_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_payroll_run_deferral (payroll_run_id, employee_id),
    FOREIGN KEY (payroll_run_id) REFERENCES payroll_runs(id) ON DELETE CASCADE,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (deferred_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

UPDATE payslips ps
INNER JOIN payroll_runs pr ON pr.id = ps.payroll_run_id
SET ps.payment_status = 'paid', ps.paid_at = COALESCE(ps.paid_at, pr.processed_at, ps.generated_at)
WHERE pr.status = 'paid' AND ps.payment_status = 'ready';
