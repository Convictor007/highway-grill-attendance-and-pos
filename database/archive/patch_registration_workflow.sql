-- Registration workflow migration (run on existing highway_grill_hrms database)
USE highway_grill_hrms;

ALTER TABLE employees
    MODIFY status ENUM('pending', 'active', 'on_leave', 'resigned', 'terminated') NOT NULL DEFAULT 'active';

ALTER TABLE users
    ADD COLUMN account_status ENUM('awaiting_hr', 'pending', 'active', 'rejected') NOT NULL DEFAULT 'active' AFTER is_active;

ALTER TABLE users
    ADD COLUMN approved_at DATETIME NULL AFTER account_status,
    ADD COLUMN approved_by CHAR(36) NULL AFTER approved_at,
    ADD COLUMN activated_at DATETIME NULL AFTER approved_by,
    ADD COLUMN activated_by CHAR(36) NULL AFTER activated_at;

ALTER TABLE users
    ADD CONSTRAINT fk_users_approved_by FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
    ADD CONSTRAINT fk_users_activated_by FOREIGN KEY (activated_by) REFERENCES users(id) ON DELETE SET NULL;

UPDATE users SET account_status = 'active' WHERE account_status = '' OR account_status IS NULL;

-- Remove demo crew without login accounts
DELETE sa FROM shift_assignments sa
INNER JOIN employees e ON e.id = sa.employee_id
WHERE e.emp_number IN ('HG-101', 'HG-102', 'HG-103', 'HG-104');

DELETE FROM employees WHERE emp_number IN ('HG-101', 'HG-102', 'HG-103', 'HG-104');
