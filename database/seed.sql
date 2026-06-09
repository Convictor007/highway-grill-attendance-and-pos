-- =============================================================================
-- Highway Grill HRMS — seed data (run after database/schema.sql)
-- =============================================================================
-- Safe to re-run (skips existing rows). For a clean slate, run schema.sql first
-- (it drops the database) or delete highway_grill_hrms in phpMyAdmin.
--
-- Roles: admin | hr | employee
-- Dev password (AUTH_HASH_PASSWORDS=false): dsadsadsa
--
-- | Role     | Email                         | Employee |
-- |----------|-------------------------------|----------|
-- | Admin    | admin@highwaygrill.local      | HG-ADM   |
-- | HR       | hr@highwaygrill.local         | HG-HR    |
-- | Employee | employee@highwaygrill.local   | HG-EMP   |
-- | Crew     | (self-register)               | HG-200   | Darryl john reyes — Dishwasher
-- =============================================================================

USE highway_grill_hrms;

-- -----------------------------------------------------------------------------
-- 1. Roles & permissions
-- -----------------------------------------------------------------------------

INSERT IGNORE INTO roles (role_slug, role_name, description, role_type, display_order) VALUES
('admin', 'Admin', 'Full system access — settings, users, all HR modules', 'system', 1),
('hr', 'HR', 'Human resources — employees, attendance, leave, payroll, shifts', 'staff', 2),
('employee', 'Employee', 'Restaurant crew — clock in/out and apply for leave', 'staff', 3);

INSERT IGNORE INTO permissions (permission_key, permission_name, module) VALUES
('settings.branches.manage', 'Manage branches', 'settings'),
('settings.departments.manage', 'Manage departments', 'settings'),
('users.manage', 'Manage users', 'users'),
('users.approve', 'Approve crew registrations', 'users'),
('employees.view', 'View employees', 'employees'),
('employees.manage', 'Manage employees', 'employees'),
('attendance.view', 'View attendance', 'attendance'),
('attendance.manage', 'Manage attendance', 'attendance'),
('attendance.self', 'Self clock-in/out', 'attendance'),
('leave.view', 'View leave', 'leave'),
('leave.manage', 'Manage leave types', 'leave'),
('leave.apply', 'Apply for leave', 'leave'),
('leave.approve', 'Approve leave requests', 'leave'),
('payroll.view', 'View payroll', 'payroll'),
('payroll.manage', 'Manage payroll runs', 'payroll'),
('shifts.manage', 'Manage schedules', 'shifts'),
('reports.view', 'View reports', 'reports'),
('compliance.view', 'View compliance logs', 'compliance'),
('shifts.view.self', 'View own shift schedule', 'shifts'),
('payroll.view.self', 'View own payslips', 'payroll'),
('profile.edit.self', 'Edit own profile contact info', 'employees'),
('documents.view.self', 'View own HR documents', 'employees'),
('announcements.view', 'View branch announcements', 'employees'),
('overtime.apply', 'Request overtime', 'attendance'),
('loans.self', 'View and apply for loans', 'payroll'),
('loans.manage', 'Approve and manage employee loans', 'payroll');

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r
CROSS JOIN permissions p
WHERE r.role_slug = 'admin'
  AND p.permission_key != 'attendance.self';

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r
JOIN permissions p ON p.permission_key IN (
  'users.approve', 'employees.view', 'employees.manage', 'announcements.view',
  'attendance.view', 'attendance.manage',
  'leave.view', 'leave.manage', 'leave.apply', 'leave.approve',
  'payroll.view', 'payroll.manage', 'shifts.manage', 'reports.view',
  'loans.manage'
)
WHERE r.role_slug = 'hr';

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r
JOIN permissions p ON p.permission_key IN (
  'attendance.self', 'leave.apply', 'leave.view',
  'shifts.view.self', 'payroll.view.self', 'profile.edit.self',
  'documents.view.self', 'announcements.view', 'overtime.apply', 'loans.self'
)
WHERE r.role_slug = 'employee';

-- -----------------------------------------------------------------------------
-- 2. Branch, departments, positions
-- -----------------------------------------------------------------------------

INSERT INTO branches (id, name, address, phone, timezone, is_active)
SELECT UUID(), 'Highway Grill', 'Highway Grill Restaurant', NULL, 'Asia/Manila', 1
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM branches WHERE name = 'Highway Grill' LIMIT 1);

SET @branch_id = (SELECT id FROM branches WHERE name = 'Highway Grill' LIMIT 1);

INSERT INTO departments (id, branch_id, name)
SELECT UUID(), @branch_id, 'Management' FROM DUAL
WHERE @branch_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM departments WHERE branch_id = @branch_id AND name = 'Management');

INSERT INTO departments (id, branch_id, name)
SELECT UUID(), @branch_id, 'Kitchen' FROM DUAL
WHERE @branch_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM departments WHERE branch_id = @branch_id AND name = 'Kitchen');

INSERT INTO departments (id, branch_id, name)
SELECT UUID(), @branch_id, 'Front of House' FROM DUAL
WHERE @branch_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM departments WHERE branch_id = @branch_id AND name = 'Front of House');

INSERT INTO departments (id, branch_id, name)
SELECT UUID(), @branch_id, 'Bar' FROM DUAL
WHERE @branch_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM departments WHERE branch_id = @branch_id AND name = 'Bar');

INSERT INTO departments (id, branch_id, name)
SELECT UUID(), @branch_id, 'Cafe' FROM DUAL
WHERE @branch_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM departments WHERE branch_id = @branch_id AND name = 'Cafe');

INSERT INTO departments (id, branch_id, name)
SELECT UUID(), @branch_id, 'Delivery' FROM DUAL
WHERE @branch_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM departments WHERE branch_id = @branch_id AND name = 'Delivery');

SET @dept_mgmt = (SELECT id FROM departments WHERE branch_id = @branch_id AND name = 'Management' LIMIT 1);
SET @dept_kitchen = (SELECT id FROM departments WHERE branch_id = @branch_id AND name = 'Kitchen' LIMIT 1);
SET @dept_foh = (SELECT id FROM departments WHERE branch_id = @branch_id AND name = 'Front of House' LIMIT 1);
SET @dept_bar = (SELECT id FROM departments WHERE branch_id = @branch_id AND name = 'Bar' LIMIT 1);
SET @dept_cafe = (SELECT id FROM departments WHERE branch_id = @branch_id AND name = 'Cafe' LIMIT 1);
SET @dept_delivery = (SELECT id FROM departments WHERE branch_id = @branch_id AND name = 'Delivery' LIMIT 1);

INSERT INTO positions (id, department_id, title, pay_grade, min_hourly, max_hourly, is_tipped)
SELECT UUID(), @dept_mgmt, 'Restaurant Manager', 5, 120.00, 180.00, 0 FROM DUAL
WHERE @dept_mgmt IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM positions WHERE department_id = @dept_mgmt AND title = 'Restaurant Manager');

INSERT INTO positions (id, department_id, title, pay_grade, min_hourly, max_hourly, is_tipped)
SELECT UUID(), @dept_mgmt, 'HR Officer', 4, 100.00, 140.00, 0 FROM DUAL
WHERE @dept_mgmt IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM positions WHERE department_id = @dept_mgmt AND title = 'HR Officer');

INSERT INTO positions (id, department_id, title, pay_grade, min_hourly, max_hourly, is_tipped)
SELECT UUID(), @dept_kitchen, 'Head Cook', 4, 95.00, 130.00, 0 FROM DUAL
WHERE @dept_kitchen IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM positions WHERE department_id = @dept_kitchen AND title = 'Head Cook');

INSERT INTO positions (id, department_id, title, pay_grade, min_hourly, max_hourly, is_tipped)
SELECT UUID(), @dept_kitchen, 'Line Cook', 3, 80.00, 120.00, 0 FROM DUAL
WHERE @dept_kitchen IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM positions WHERE department_id = @dept_kitchen AND title = 'Line Cook');

INSERT INTO positions (id, department_id, title, pay_grade, min_hourly, max_hourly, is_tipped)
SELECT UUID(), @dept_foh, 'Server', 2, 70.00, 100.00, 1 FROM DUAL
WHERE @dept_foh IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM positions WHERE department_id = @dept_foh AND title = 'Server');

INSERT INTO positions (id, department_id, title, pay_grade, min_hourly, max_hourly, is_tipped)
SELECT UUID(), @dept_foh, 'Cashier', 2, 72.00, 95.00, 0 FROM DUAL
WHERE @dept_foh IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM positions WHERE department_id = @dept_foh AND title = 'Cashier');

INSERT INTO positions (id, department_id, title, pay_grade, min_hourly, max_hourly, is_tipped)
SELECT UUID(), @dept_bar, 'Bartender', 3, 75.00, 110.00, 1 FROM DUAL
WHERE @dept_bar IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM positions WHERE department_id = @dept_bar AND title = 'Bartender');

INSERT INTO positions (id, department_id, title, pay_grade, min_hourly, max_hourly, is_tipped)
SELECT UUID(), @dept_delivery, 'Delivery Rider', 2, 70.00, 95.00, 0 FROM DUAL
WHERE @dept_delivery IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM positions WHERE department_id = @dept_delivery AND title = 'Delivery Rider');

INSERT INTO positions (id, department_id, title, pay_grade, min_hourly, max_hourly, is_tipped)
SELECT UUID(), @dept_kitchen, 'Dishwasher', 1, 65.00, 85.00, 0 FROM DUAL
WHERE @dept_kitchen IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM positions WHERE department_id = @dept_kitchen AND title = 'Dishwasher');

INSERT INTO positions (id, department_id, title, pay_grade, min_hourly, max_hourly, is_tipped)
SELECT UUID(), @dept_kitchen, 'Prep Cook', 2, 72.00, 100.00, 0 FROM DUAL
WHERE @dept_kitchen IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM positions WHERE department_id = @dept_kitchen AND title = 'Prep Cook');

INSERT INTO positions (id, department_id, title, pay_grade, min_hourly, max_hourly, is_tipped)
SELECT UUID(), @dept_kitchen, 'Grill Cook', 3, 80.00, 115.00, 0 FROM DUAL
WHERE @dept_kitchen IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM positions WHERE department_id = @dept_kitchen AND title = 'Grill Cook');

INSERT INTO positions (id, department_id, title, pay_grade, min_hourly, max_hourly, is_tipped)
SELECT UUID(), @dept_kitchen, 'Kitchen Helper', 1, 65.00, 88.00, 0 FROM DUAL
WHERE @dept_kitchen IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM positions WHERE department_id = @dept_kitchen AND title = 'Kitchen Helper');

INSERT INTO positions (id, department_id, title, pay_grade, min_hourly, max_hourly, is_tipped)
SELECT UUID(), @dept_kitchen, 'Sous Chef', 4, 90.00, 125.00, 0 FROM DUAL
WHERE @dept_kitchen IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM positions WHERE department_id = @dept_kitchen AND title = 'Sous Chef');

INSERT INTO positions (id, department_id, title, pay_grade, min_hourly, max_hourly, is_tipped)
SELECT UUID(), @dept_kitchen, 'Pastry Chef', 3, 82.00, 118.00, 0 FROM DUAL
WHERE @dept_kitchen IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM positions WHERE department_id = @dept_kitchen AND title = 'Pastry Chef');

INSERT INTO positions (id, department_id, title, pay_grade, min_hourly, max_hourly, is_tipped)
SELECT UUID(), @dept_foh, 'Host', 2, 68.00, 92.00, 0 FROM DUAL
WHERE @dept_foh IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM positions WHERE department_id = @dept_foh AND title = 'Host');

INSERT INTO positions (id, department_id, title, pay_grade, min_hourly, max_hourly, is_tipped)
SELECT UUID(), @dept_foh, 'Busser', 1, 62.00, 82.00, 0 FROM DUAL
WHERE @dept_foh IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM positions WHERE department_id = @dept_foh AND title = 'Busser');

INSERT INTO positions (id, department_id, title, pay_grade, min_hourly, max_hourly, is_tipped)
SELECT UUID(), @dept_foh, 'Food Runner', 1, 65.00, 85.00, 0 FROM DUAL
WHERE @dept_foh IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM positions WHERE department_id = @dept_foh AND title = 'Food Runner');

INSERT INTO positions (id, department_id, title, pay_grade, min_hourly, max_hourly, is_tipped)
SELECT UUID(), @dept_cafe, 'Barista', 2, 70.00, 98.00, 0 FROM DUAL
WHERE @dept_cafe IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM positions WHERE department_id = @dept_cafe AND title = 'Barista');

INSERT INTO positions (id, department_id, title, pay_grade, min_hourly, max_hourly, is_tipped)
SELECT UUID(), @dept_cafe, 'Cafe Server', 2, 68.00, 95.00, 1 FROM DUAL
WHERE @dept_cafe IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM positions WHERE department_id = @dept_cafe AND title = 'Cafe Server');

INSERT INTO positions (id, department_id, title, pay_grade, min_hourly, max_hourly, is_tipped)
SELECT UUID(), @dept_cafe, 'Cafe Cashier', 2, 70.00, 92.00, 0 FROM DUAL
WHERE @dept_cafe IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM positions WHERE department_id = @dept_cafe AND title = 'Cafe Cashier');

SET @pos_manager = (SELECT id FROM positions WHERE department_id = @dept_mgmt AND title = 'Restaurant Manager' LIMIT 1);
SET @pos_hr = (SELECT id FROM positions WHERE department_id = @dept_mgmt AND title = 'HR Officer' LIMIT 1);
SET @pos_line_cook = (SELECT id FROM positions WHERE department_id = @dept_kitchen AND title = 'Line Cook' LIMIT 1);
SET @pos_dishwasher = (SELECT id FROM positions WHERE department_id = @dept_kitchen AND title = 'Dishwasher' LIMIT 1);
SET @pos_server = (SELECT id FROM positions WHERE department_id = @dept_foh AND title = 'Server' LIMIT 1);
SET @pos_bartender = (SELECT id FROM positions WHERE department_id = @dept_bar AND title = 'Bartender' LIMIT 1);
-- -----------------------------------------------------------------------------
-- 3. Leave types & shift templates
-- -----------------------------------------------------------------------------

INSERT INTO leave_types (id, name, paid, days_per_year, carry_forward, requires_approval, color_hex)
SELECT UUID(), 'Vacation Leave', 1, 15, 1, 1, '#378ADD' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM leave_types WHERE name = 'Vacation Leave');

INSERT INTO leave_types (id, name, paid, days_per_year, carry_forward, requires_approval, color_hex)
SELECT UUID(), 'Sick Leave', 1, 10, 0, 1, '#1D9E75' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM leave_types WHERE name = 'Sick Leave');

INSERT INTO leave_types (id, name, paid, days_per_year, carry_forward, requires_approval, color_hex)
SELECT UUID(), 'Emergency Leave', 1, 5, 0, 1, '#D4537E' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM leave_types WHERE name = 'Emergency Leave');

INSERT INTO shift_templates (id, branch_id, name, start_time, end_time, break_mins, color_hex)
SELECT UUID(), @branch_id, 'Morning', '06:00:00', '14:00:00', 60, '#378ADD' FROM DUAL
WHERE @branch_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM shift_templates WHERE branch_id = @branch_id AND name = 'Morning');

INSERT INTO shift_templates (id, branch_id, name, start_time, end_time, break_mins, color_hex)
SELECT UUID(), @branch_id, 'Afternoon', '14:00:00', '22:00:00', 60, '#1D9E75' FROM DUAL
WHERE @branch_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM shift_templates WHERE branch_id = @branch_id AND name = 'Afternoon');

INSERT INTO shift_templates (id, branch_id, name, start_time, end_time, break_mins, color_hex)
SELECT UUID(), @branch_id, 'Dinner', '17:00:00', '23:00:00', 30, '#BA7517' FROM DUAL
WHERE @branch_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM shift_templates WHERE branch_id = @branch_id AND name = 'Dinner');

-- -----------------------------------------------------------------------------
-- 4. Employees (staff with login accounts only — new hires self-register)
-- -----------------------------------------------------------------------------

INSERT IGNORE INTO employees (
  id, branch_id, department_id, position_id,
  emp_number, first_name, last_name, email, phone,
  hire_date, employment_type, status
) VALUES
(UUID(), @branch_id, @dept_mgmt, @pos_manager, 'HG-ADM', 'Alex', 'Admin', 'admin@highwaygrill.local', '09170000001', CURDATE(), 'full_time', 'active'),
(UUID(), @branch_id, @dept_mgmt, @pos_hr, 'HG-HR', 'Hannah', 'Reyes', 'hr@highwaygrill.local', '09170000002', CURDATE(), 'full_time', 'active'),
(UUID(), @branch_id, @dept_kitchen, @pos_line_cook, 'HG-EMP', 'Elena', 'Cruz', 'employee@highwaygrill.local', '09170000003', CURDATE(), 'full_time', 'active');

INSERT IGNORE INTO employees (
  id, branch_id, department_id, position_id,
  emp_number, first_name, last_name, email, phone,
  hire_date, employment_type, status
)
SELECT UUID(), @branch_id, @dept_kitchen, @pos_dishwasher, 'HG-200', 'Darryl john', 'reyes', NULL, NULL,
  CURDATE(), 'full_time', 'active'
FROM DUAL
WHERE @pos_dishwasher IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM employees WHERE emp_number = 'HG-200');

UPDATE branches SET manager_id = (SELECT id FROM employees WHERE emp_number = 'HG-ADM' LIMIT 1)
WHERE id = @branch_id;

-- -----------------------------------------------------------------------------
-- 5. Users (linked to employees)
-- -----------------------------------------------------------------------------

INSERT INTO users (id, email, password_hash, role_id, employee_id, is_active, account_status, activated_at)
SELECT UUID(), 'admin@highwaygrill.local', 'dsadsadsa', r.role_id, e.id, 1, 'active', NOW()
FROM roles r
JOIN employees e ON e.emp_number = 'HG-ADM'
WHERE r.role_slug = 'admin'
  AND NOT EXISTS (SELECT 1 FROM users WHERE email = 'admin@highwaygrill.local');

INSERT INTO users (id, email, password_hash, role_id, employee_id, is_active, account_status, activated_at)
SELECT UUID(), 'hr@highwaygrill.local', 'dsadsadsa', r.role_id, e.id, 1, 'active', NOW()
FROM roles r
JOIN employees e ON e.emp_number = 'HG-HR'
WHERE r.role_slug = 'hr'
  AND NOT EXISTS (SELECT 1 FROM users WHERE email = 'hr@highwaygrill.local');

INSERT INTO users (id, email, password_hash, role_id, employee_id, is_active, account_status, activated_at)
SELECT UUID(), 'employee@highwaygrill.local', 'dsadsadsa', r.role_id, e.id, 1, 'active', NOW()
FROM roles r
JOIN employees e ON e.emp_number = 'HG-EMP'
WHERE r.role_slug = 'employee'
  AND NOT EXISTS (SELECT 1 FROM users WHERE email = 'employee@highwaygrill.local');

UPDATE users SET password_hash = 'dsadsadsa'
WHERE email IN (
  'admin@highwaygrill.local',
  'hr@highwaygrill.local',
  'employee@highwaygrill.local'
);

-- -----------------------------------------------------------------------------
-- 6. Leave balances (all active employees)
-- -----------------------------------------------------------------------------

INSERT IGNORE INTO leave_balances (id, employee_id, leave_type_id, year, accrued, used, pending, carried_forward)
SELECT UUID(), e.id, lt.id, YEAR(CURDATE()), lt.days_per_year, 0, 0, 0
FROM employees e
CROSS JOIN leave_types lt
WHERE e.branch_id = @branch_id AND e.status = 'active';

-- -----------------------------------------------------------------------------
-- 7. Employee compensation + semi-monthly attendance (for payroll demos)
-- -----------------------------------------------------------------------------

UPDATE employees e
LEFT JOIN positions p ON p.id = e.position_id
SET
  e.pay_rate = COALESCE(e.pay_rate, p.min_hourly, 80.00),
  e.pay_basis = COALESCE(e.pay_basis, 'hourly')
WHERE e.branch_id = @branch_id AND e.status = 'active';

-- Demo crew: daily rates (semi-monthly payroll demos)
UPDATE employees SET pay_basis = 'daily', pay_rate = 395.00
WHERE emp_number = 'HG-EMP' AND branch_id = @branch_id;

UPDATE employees SET pay_basis = 'daily', pay_rate = 455.00
WHERE emp_number = 'HG-200' AND branch_id = @branch_id;

SET @period_start = CASE
  WHEN DAY(CURDATE()) <= 15 THEN DATE_FORMAT(CURDATE(), '%Y-%m-01')
  ELSE DATE_FORMAT(CURDATE(), '%Y-%m-16')
END;
SET @period_end = CASE
  WHEN DAY(CURDATE()) <= 15 THEN DATE_FORMAT(CURDATE(), '%Y-%m-15')
  ELSE LAST_DAY(CURDATE())
END;

-- Current semi-monthly cut-off: evening shift 3 PM – 12 AM (9h) with random variations
INSERT INTO attendance (id, employee_id, clock_in, clock_out, actual_hours, regular_hours, overtime_hours, method)
SELECT
  UUID(),
  s.employee_id,
  s.clock_in,
  s.clock_out,
  ROUND(TIMESTAMPDIFF(MINUTE, s.clock_in, s.clock_out) / 60, 2),
  ROUND(LEAST(TIMESTAMPDIFF(MINUTE, s.clock_in, s.clock_out) / 60, 9), 2),
  ROUND(GREATEST(TIMESTAMPDIFF(MINUTE, s.clock_in, s.clock_out) / 60 - 9, 0), 2),
  'app'
FROM (
  SELECT
    e.id AS employee_id,
    d.work_date,
    CASE MOD(CRC32(CONCAT(e.id, d.work_date)), 15)
      WHEN 0 THEN NULL
      WHEN 1 THEN NULL
      WHEN 2 THEN TIMESTAMP(d.work_date, '15:00:00')
      WHEN 3 THEN TIMESTAMP(d.work_date, '14:30:00')
      WHEN 4 THEN TIMESTAMP(d.work_date, '14:45:00')
      WHEN 5 THEN TIMESTAMP(d.work_date, '15:20:00')
      WHEN 6 THEN TIMESTAMP(d.work_date, '15:00:00')
      WHEN 7 THEN TIMESTAMP(d.work_date, '15:00:00')
      WHEN 8 THEN TIMESTAMP(d.work_date, '15:00:00')
      WHEN 9 THEN TIMESTAMP(d.work_date, '15:00:00')
      WHEN 10 THEN TIMESTAMP(d.work_date, '15:00:00')
      WHEN 11 THEN TIMESTAMP(d.work_date, '14:30:00')
      WHEN 12 THEN TIMESTAMP(d.work_date, '15:30:00')
      WHEN 13 THEN TIMESTAMP(d.work_date, '15:05:00')
      WHEN 14 THEN TIMESTAMP(d.work_date, '15:00:00')
    END AS clock_in,
    CASE MOD(CRC32(CONCAT(e.id, d.work_date)), 15)
      WHEN 0 THEN NULL
      WHEN 1 THEN NULL
      WHEN 2 THEN TIMESTAMP(DATE_ADD(d.work_date, INTERVAL 1 DAY), '00:00:00')
      WHEN 3 THEN TIMESTAMP(d.work_date, '23:30:00')
      WHEN 4 THEN TIMESTAMP(d.work_date, '23:45:00')
      WHEN 5 THEN TIMESTAMP(DATE_ADD(d.work_date, INTERVAL 1 DAY), '00:20:00')
      WHEN 6 THEN TIMESTAMP(DATE_ADD(d.work_date, INTERVAL 1 DAY), '00:00:00')
      WHEN 7 THEN TIMESTAMP(d.work_date, '22:00:00')
      WHEN 8 THEN TIMESTAMP(d.work_date, '21:30:00')
      WHEN 9 THEN TIMESTAMP(DATE_ADD(d.work_date, INTERVAL 1 DAY), '00:00:00')
      WHEN 10 THEN TIMESTAMP(DATE_ADD(d.work_date, INTERVAL 1 DAY), '01:00:00')
      WHEN 11 THEN TIMESTAMP(DATE_ADD(d.work_date, INTERVAL 1 DAY), '00:30:00')
      WHEN 12 THEN TIMESTAMP(DATE_ADD(d.work_date, INTERVAL 1 DAY), '00:30:00')
      WHEN 13 THEN TIMESTAMP(DATE_ADD(d.work_date, INTERVAL 1 DAY), '00:05:00')
      WHEN 14 THEN TIMESTAMP(d.work_date, '23:00:00')
    END AS clock_out
  FROM employees e
  CROSS JOIN (
    WITH RECURSIVE period_days AS (
      SELECT @period_start AS work_date
      UNION ALL
      SELECT DATE_ADD(work_date, INTERVAL 1 DAY)
      FROM period_days
      WHERE work_date < @period_end
    )
    SELECT work_date FROM period_days
  ) d
  WHERE e.branch_id = @branch_id
    AND e.status = 'active'
    AND e.emp_number NOT IN ('HG-ADM')
) s
WHERE s.clock_in IS NOT NULL
  AND s.clock_out IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM attendance a
    WHERE a.employee_id = s.employee_id AND DATE(a.clock_in) = s.work_date
  );

-- -----------------------------------------------------------------------------
-- 8. Compliance checklists
-- -----------------------------------------------------------------------------

INSERT INTO compliance_checklists (id, name, checklist_type, frequency, due_day)
SELECT UUID(), 'Daily kitchen hygiene', 'food_safety', 'daily', NULL FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM compliance_checklists WHERE name = 'Daily kitchen hygiene');

INSERT INTO compliance_checklists (id, name, checklist_type, frequency, due_day)
SELECT UUID(), 'Weekly labor posting', 'labor', 'weekly', 1 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM compliance_checklists WHERE name = 'Weekly labor posting');

INSERT INTO compliance_checklists (id, name, checklist_type, frequency, due_day)
SELECT UUID(), 'Fire extinguisher check', 'fire_safety', 'monthly', 1 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM compliance_checklists WHERE name = 'Fire extinguisher check');

-- -----------------------------------------------------------------------------
-- 9. Employee portal sample data (announcements, documents, shift for HG-EMP)
-- -----------------------------------------------------------------------------

INSERT INTO announcements (id, branch_id, title, body, priority, publish_at)
SELECT UUID(), @branch_id, 'Welcome to HRMS',
  'Use Attendance to clock in/out. Apply for leave under Leave. Check My Shifts for your roster.',
  'normal', NOW()
FROM DUAL
WHERE @branch_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM announcements WHERE title = 'Welcome to HRMS');

INSERT INTO documents (id, employee_id, category, title, file_url, is_confidential)
SELECT UUID(), e.id, 'memo', 'Employee handbook acknowledgment', NULL, 0
FROM employees e
WHERE e.emp_number = 'HG-EMP'
  AND NOT EXISTS (
    SELECT 1 FROM documents d WHERE d.employee_id = e.id AND d.title = 'Employee handbook acknowledgment'
  );

-- Week starts Sunday (matches roster grid)
SET @week_start = DATE_SUB(CURDATE(), INTERVAL (DAYOFWEEK(CURDATE()) - 1) DAY);

INSERT INTO schedules (id, branch_id, week_start, status, published_at)
SELECT UUID(), @branch_id, @week_start, 'published', NOW()
FROM DUAL
WHERE @branch_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM schedules s
    WHERE s.branch_id = @branch_id AND s.week_start = @week_start
  );

SET @schedule_id = (
  SELECT id FROM schedules
  WHERE branch_id = @branch_id AND week_start = @week_start
  LIMIT 1
);

-- Mon–Sat morning shift for demo employee; Sunday rest day
INSERT INTO shift_assignments (id, schedule_id, employee_id, shift_template_id, shift_date, start_time, end_time, break_mins, notes)
SELECT UUID(), @schedule_id, e.id, st.id,
       DATE_ADD(@week_start, INTERVAL offs.n DAY),
       st.start_time, st.end_time, st.break_mins, NULL
FROM employees e
JOIN shift_templates st ON st.branch_id = @branch_id AND st.name = 'Morning'
JOIN (
  SELECT 1 AS n UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6
) offs
WHERE e.emp_number = 'HG-EMP'
  AND @schedule_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM shift_assignments sa
    WHERE sa.schedule_id = @schedule_id AND sa.employee_id = e.id
      AND sa.shift_date = DATE_ADD(@week_start, INTERVAL offs.n DAY)
  );

INSERT INTO shift_assignments (id, schedule_id, employee_id, shift_template_id, shift_date, start_time, end_time, break_mins, notes)
SELECT UUID(), @schedule_id, e.id, NULL, @week_start, '00:00:00', '00:00:00', 0, 'REST_DAY'
FROM employees e
WHERE e.emp_number = 'HG-EMP'
  AND @schedule_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM shift_assignments sa
    WHERE sa.schedule_id = @schedule_id AND sa.employee_id = e.id AND sa.shift_date = @week_start
  );

-- -----------------------------------------------------------------------------
-- 10. Payroll (holidays, benefits, mock paid runs + payslips for HG-EMP)
-- -----------------------------------------------------------------------------

INSERT IGNORE INTO holidays (id, branch_id, holiday_date, name, holiday_type, pay_multiplier) VALUES
(UUID(), NULL, '2026-01-01', 'New Year\'s Day', 'national', 2.00),
(UUID(), NULL, '2026-04-09', 'Araw ng Kagitingan', 'national', 2.00),
(UUID(), NULL, '2026-05-01', 'Labor Day', 'national', 2.00),
(UUID(), NULL, '2026-06-12', 'Independence Day', 'national', 2.00),
(UUID(), NULL, '2026-12-25', 'Christmas Day', 'national', 2.00),
(UUID(), NULL, '2026-12-30', 'Rizal Day', 'national', 2.00);

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

-- 1st cutoff last month (paid) — Elena Cruz, Line Cook @ ₱80/hr
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
    WHERE pr.branch_id = @branch_id
      AND pr.period_start = @prev_month_start
      AND pr.period_end = @prev_month_mid
      AND pr.run_type = 'regular'
  );

SET @pay_run_1 = (
  SELECT id FROM payroll_runs
  WHERE branch_id = @branch_id
    AND period_start = @prev_month_start
    AND period_end = @prev_month_mid
    AND run_type = 'regular'
  LIMIT 1
);

INSERT INTO payslips (
  id, payroll_run_id, employee_id,
  regular_hours, overtime_hours, holiday_hours,
  basic_pay, overtime_pay, holiday_pay, tips_amount, service_charge,
  gross_pay, sss_amount, philhealth_amount, pagibig_amount, tax_amount, other_deductions, net_pay,
  generated_at
)
SELECT UUID(), @pay_run_1, e.id,
  88.00, 4.00, 0.00,
  7040.00, 400.00, 0.00, 350.00, 750.00,
  8540.00, 382.50, 213.50, 100.00, 0.00, 0.00, 7844.00,
  NOW()
FROM employees e
INNER JOIN users u ON u.employee_id = e.id
INNER JOIN roles r ON r.role_id = u.role_id AND r.role_slug = 'employee'
WHERE @pay_run_1 IS NOT NULL
  AND e.branch_id = @branch_id
  AND e.status = 'active'
  AND NOT EXISTS (
    SELECT 1 FROM payslips ps
    WHERE ps.payroll_run_id = @pay_run_1 AND ps.employee_id = e.id
  );

-- 2nd cutoff last month (paid)
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
    WHERE pr.branch_id = @branch_id
      AND pr.period_start = @prev_month_16
      AND pr.period_end = @prev_month_end
      AND pr.run_type = 'regular'
  );

SET @pay_run_2 = (
  SELECT id FROM payroll_runs
  WHERE branch_id = @branch_id
    AND period_start = @prev_month_16
    AND period_end = @prev_month_end
    AND run_type = 'regular'
  LIMIT 1
);

INSERT INTO payslips (
  id, payroll_run_id, employee_id,
  regular_hours, overtime_hours, holiday_hours,
  basic_pay, overtime_pay, holiday_pay, tips_amount, service_charge,
  gross_pay, sss_amount, philhealth_amount, pagibig_amount, tax_amount, other_deductions, net_pay,
  generated_at
)
SELECT UUID(), @pay_run_2, e.id,
  96.00, 2.00, 0.00,
  7680.00, 200.00, 0.00, 280.00, 750.00,
  8910.00, 382.50, 222.75, 100.00, 0.00, 28.25, 8176.50,
  NOW()
FROM employees e
INNER JOIN users u ON u.employee_id = e.id
INNER JOIN roles r ON r.role_id = u.role_id AND r.role_slug = 'employee'
WHERE @pay_run_2 IS NOT NULL
  AND e.branch_id = @branch_id
  AND e.status = 'active'
  AND NOT EXISTS (
    SELECT 1 FROM payslips ps
    WHERE ps.payroll_run_id = @pay_run_2 AND ps.employee_id = e.id
  );

-- Current month 1st cutoff (paid) when today is past the 15th
INSERT INTO payroll_runs (
  id, branch_id, period_start, period_end, pay_date, run_type, pay_frequency,
  status, total_gross, total_net, processed_by, processed_at
)
SELECT UUID(), @branch_id,
  DATE_FORMAT(CURDATE(), '%Y-%m-01'),
  DATE_FORMAT(CURDATE(), '%Y-%m-15'),
  DATE_FORMAT(CURDATE(), '%Y-%m-15'),
  'regular', 'semi_monthly', 'paid', 8220.00, 7532.00, @hr_user_id, NOW()
FROM DUAL
WHERE @branch_id IS NOT NULL
  AND DAY(CURDATE()) > 15
  AND NOT EXISTS (
    SELECT 1 FROM payroll_runs pr
    WHERE pr.branch_id = @branch_id
      AND pr.period_start = DATE_FORMAT(CURDATE(), '%Y-%m-01')
      AND pr.period_end = DATE_FORMAT(CURDATE(), '%Y-%m-15')
      AND pr.run_type = 'regular'
  );

SET @pay_run_cur = (
  SELECT id FROM payroll_runs
  WHERE branch_id = @branch_id
    AND period_start = DATE_FORMAT(CURDATE(), '%Y-%m-01')
    AND period_end = DATE_FORMAT(CURDATE(), '%Y-%m-15')
    AND run_type = 'regular'
  LIMIT 1
);

INSERT INTO payslips (
  id, payroll_run_id, employee_id,
  regular_hours, overtime_hours, holiday_hours,
  basic_pay, overtime_pay, holiday_pay, tips_amount, service_charge,
  gross_pay, sss_amount, philhealth_amount, pagibig_amount, tax_amount, other_deductions, net_pay,
  generated_at
)
SELECT UUID(), @pay_run_cur, e.id,
  80.00, 3.00, 0.00,
  6400.00, 300.00, 0.00, 320.00, 750.00,
  8220.00, 382.50, 205.50, 100.00, 0.00, 0.00, 7532.00,
  NOW()
FROM employees e
INNER JOIN users u ON u.employee_id = e.id
INNER JOIN roles r ON r.role_id = u.role_id AND r.role_slug = 'employee'
WHERE @pay_run_cur IS NOT NULL
  AND e.branch_id = @branch_id
  AND e.status = 'active'
  AND DAY(CURDATE()) > 15
  AND NOT EXISTS (
    SELECT 1 FROM payslips ps
    WHERE ps.payroll_run_id = @pay_run_cur AND ps.employee_id = e.id
  );

-- Sync run totals if payslip was added without matching totals
UPDATE payroll_runs pr
SET
  total_gross = (SELECT COALESCE(SUM(gross_pay), 0) FROM payslips ps WHERE ps.payroll_run_id = pr.id),
  total_net = (SELECT COALESCE(SUM(net_pay), 0) FROM payslips ps WHERE ps.payroll_run_id = pr.id)
WHERE pr.branch_id = @branch_id
  AND pr.id IN (@pay_run_1, @pay_run_2, @pay_run_cur);

-- -----------------------------------------------------------------------------
-- Field work sites (GIS / Leaflet map)
-- -----------------------------------------------------------------------------

-- Branch clock-in zone only (kitchen, FOH, bar, cafe staff)
INSERT INTO field_work_sites (id, branch_id, name, address, latitude, longitude, radius_m, is_active, clock_in_eligible)
SELECT UUID(), @branch_id, 'Highway Grill — Main', 'Restaurant branch', 14.554700, 121.024400, 200, 1, 1
FROM DUAL
WHERE @branch_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM field_work_sites WHERE name = 'Highway Grill — Main');
