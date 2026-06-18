-- =============================================================================
-- hgseed.sql — Highway Grill HRMS seed (integer SERIAL ids)
-- Run AFTER hg.sql. Requires AUTH_HASH_PASSWORDS=true on the API.
--
-- Logins:
--   admin@highwaygrill.com  / hg2015   (login-only — not in Staff logins)
--   hr@highwaygrill.com     / HrTemp2025!
-- No demo employee — crew register via the login page.
-- =============================================================================

-- bcrypt hashes generated with cost 10
-- hg2015:       $2b$10$bqNP7HI5iOCKpoyRn0czkObfX2bEL9.NWqpSg3PNYrFEtImQ/wEVe
-- HrTemp2025!:  $2b$10$kkczef//Ci.vFrSrlhRlgu56k43nKjYTHNuSRBMR36TYS9nu9TKZC

INSERT INTO roles (role_id, role_slug, role_name, description, role_type, is_system, display_order) VALUES
(1, 'admin',    'System Admin', 'Full system access',        'system', true, 1),
(2, 'hr',       'HR Manager',   'HR operations and payroll', 'staff',  true, 2),
(3, 'employee', 'Employee',     'Self-service portal',       'staff',  true, 3)
ON CONFLICT (role_slug) DO NOTHING;

INSERT INTO permissions (permission_id, permission_key, permission_name, module, description) VALUES
( 1, 'attendance.self',             'Clock in/out (self)',        'attendance',  'Employee DTR'),
( 2, 'attendance.view',             'View attendance',            'attendance',  'HR attendance register'),
( 3, 'attendance.manage',           'Manage attendance',          'attendance',  'Manual entries, overtime approval'),
( 4, 'leave.view',                  'View leave',                 'leave',       'See balances and requests'),
( 5, 'leave.apply',                 'Apply for leave',            'leave',       'Submit leave requests'),
( 6, 'leave.approve',               'Approve leave',              'leave',       'Review crew leave'),
( 7, 'leave.manage',                'Manage leave types',         'leave',       'Configure leave types'),
( 8, 'shifts.view.self',            'View own schedule',          'shifts',      'Employee roster'),
( 9, 'shifts.manage',               'Manage shifts',              'shifts',      'Templates and roster'),
(10, 'documents.view.self',         'View own documents',         'documents',   'Service records'),
(11, 'announcements.view',          'View announcements',         'content',     'Memos and notices'),
(12, 'loans.self',                  'Loans (self)',               'loans',       'Apply and view own loans'),
(13, 'loans.manage',                'Manage loans',               'loans',       'HR loan review'),
(14, 'payroll.view.self',           'View own payslips',          'payroll',     'Employee payroll'),
(15, 'payroll.view',                'View payroll',               'payroll',     'HR payroll runs'),
(16, 'payroll.manage',              'Manage payroll',             'payroll',     'Generate and pay runs'),
(17, 'employees.view',              'View employees',             'employees',   'Employee directory'),
(18, 'employees.manage',            'Manage employees',           'employees',   'HR employee records'),
(19, 'reports.view',                'HR dashboard & reports',     'reports',     'Dashboard stats'),
(20, 'users.approve',               'Approve registrations',      'users',       'Crew onboarding'),
(21, 'users.manage',                'Manage users & roles',       'users',       'System user admin'),
(22, 'profile.edit.self',           'Edit own profile',           'profile',     'Employee profile'),
(23, 'settings.branches.manage',      'Manage branches',            'settings',    'Branch settings'),
(24, 'settings.departments.manage', 'Manage departments',         'settings',    'Departments & positions'),
(25, 'compliance.view',             'View compliance',            'compliance',  'Checklists and audit'),
(26, 'overtime.apply',              'Apply for overtime',         'attendance',  'Employee OT requests')
ON CONFLICT (permission_key) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT 1, permission_id FROM permissions ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT 2, permission_id FROM permissions WHERE permission_key <> 'users.manage' ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT 3, p.permission_id FROM permissions p
WHERE p.permission_key IN (
  'attendance.self', 'leave.view', 'leave.apply', 'shifts.view.self',
  'documents.view.self', 'announcements.view', 'loans.self',
  'payroll.view.self', 'profile.edit.self', 'overtime.apply'
) ON CONFLICT DO NOTHING;

INSERT INTO branches (id, name, address, phone, timezone, is_active, default_latitude, default_longitude) VALUES
(1, 'Highway Grill', 'MacArthur Highway, Pampanga', '+63-45-000-0000', 'Asia/Manila', true, 15.1458, 120.5906)
ON CONFLICT (id) DO NOTHING;

INSERT INTO departments (id, branch_id, name, cost_center) VALUES
(1, 1, 'Management',     'MGMT'),
(2, 1, 'Kitchen',        'KIT'),
(3, 1, 'Service',        'SVC'),
(4, 1, 'Front of House', 'FOH'),
(5, 1, 'Bar',            'BAR'),
(6, 1, 'Cafe',           'CAFE')
ON CONFLICT (id) DO NOTHING;

INSERT INTO positions (id, department_id, title, pay_grade, min_hourly, max_hourly, is_tipped) VALUES
( 1, 1, 'HR Manager',         'M1',  80.00, 120.00, false),
( 2, 2, 'Line Cook',          'K3',  80.00, 120.00, false),
( 3, 3, 'Service Crew',       'S1',  65.00,  85.00, true),
( 4, 1, 'Restaurant Manager', 'M2', 120.00, 180.00, false),
( 5, 2, 'Head Cook',          'K4',  95.00, 130.00, false),
( 6, 2, 'Back Kitchen',       'K2',  72.00, 100.00, false),
( 7, 2, 'Grill Cook',         'K3',  80.00, 115.00, false),
( 8, 2, 'Prep Cook',          'K2',  72.00, 100.00, false),
( 9, 2, 'Dishwasher',         'K1',  65.00,  85.00, false),
(10, 2, 'Kitchen Helper',     'K1',  65.00,  88.00, false),
(11, 2, 'Sous Chef',          'K4',  90.00, 125.00, false),
(12, 2, 'Pastry Chef',        'K3',  82.00, 118.00, false),
(13, 4, 'Server',             'S2',  70.00, 100.00, true),
(14, 4, 'Cashier',            'S2',  72.00,  95.00, false),
(15, 4, 'Host',               'S2',  68.00,  92.00, false),
(16, 4, 'Busser',             'S1',  62.00,  82.00, false),
(17, 4, 'Food Runner',        'S1',  65.00,  85.00, false),
(18, 5, 'Bartender',          'B3',  75.00, 110.00, true),
(19, 6, 'Barista',            'C2',  70.00,  98.00, false),
(20, 6, 'Cafe Server',        'C2',  68.00,  95.00, true),
(21, 6, 'Cafe Cashier',       'C2',  70.00,  92.00, false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO employees (
  id, branch_id, department_id, position_id, emp_number, first_name, last_name,
  email, phone, hire_date, employment_type, pay_basis, pay_rate, is_stay_in, housing_deduction, status
) VALUES
(1, 1, 1, 1, 'HG-HR', 'HR', 'Manager', 'hr@highwaygrill.com', '+63-900-000-0001', '2024-01-15', 'full_time', 'hourly', 95.00, false, 0, 'active')
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, email, password_hash, role_id, employee_id, is_active, account_status, activated_at) VALUES
(1, 'admin@highwaygrill.com', '$2b$10$bqNP7HI5iOCKpoyRn0czkObfX2bEL9.NWqpSg3PNYrFEtImQ/wEVe', 1, NULL, true, 'active', NOW()),
(2, 'hr@highwaygrill.com',    '$2b$10$kkczef//Ci.vFrSrlhRlgu56k43nKjYTHNuSRBMR36TYS9nu9TKZC', 2, 1, true, 'active', NOW())
ON CONFLICT (email) DO NOTHING;

INSERT INTO leave_types (id, name, paid, days_per_year, carry_forward, requires_approval, color_hex) VALUES
(1, 'Vacation',        true, 15, true,  true,  '#378ADD'),
(2, 'Sick',            true, 10, false, true,  '#1D9E75'),
(3, 'Emergency leave', true,  5, false, true,  '#BA7517')
ON CONFLICT (id) DO NOTHING;

INSERT INTO holidays (id, branch_id, holiday_date, name, holiday_type, pay_multiplier) VALUES
(1, NULL, '2026-06-12', 'Independence Day', 'national', 2.0)
ON CONFLICT (id) DO NOTHING;

INSERT INTO shift_templates (id, branch_id, name, start_time, end_time, break_mins, color_hex) VALUES
(1, 1, 'Morning',   '06:00', '14:00', 60, '#378ADD'),
(2, 1, 'Afternoon', '14:00', '22:00', 60, '#1D9E75'),
(3, 1, 'Dinner',    '17:00', '23:00', 30, '#BA7517')
ON CONFLICT (id) DO NOTHING;

INSERT INTO compliance_checklists (id, name, checklist_type, frequency, due_day) VALUES
(1, 'Daily food safety walkthrough', 'food_safety', 'daily',   NULL),
(2, 'Fire extinguisher inspection',  'fire_safety', 'monthly', 1),
(3, 'Labor law poster review',       'labor',       'annual',  15)
ON CONFLICT (id) DO NOTHING;

INSERT INTO announcements (id, branch_id, title, body, priority, posted_by, publish_at) VALUES
(1, 1, 'Welcome to Highway Grill HR Portal',
 'Use DTR to clock in, check Scheduling for your roster, and contact HR for leave or loan requests.',
 'normal', 2, NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO field_work_sites (id, branch_id, name, address, latitude, longitude, radius_m, is_active, clock_in_eligible) VALUES
(1, 1, 'Main branch geofence', 'MacArthur Highway, Pampanga', 15.1458, 120.5906, 150, true, true)
ON CONFLICT (id) DO NOTHING;

SELECT setval(pg_get_serial_sequence('roles', 'role_id'), (SELECT COALESCE(MAX(role_id), 1) FROM roles));
SELECT setval(pg_get_serial_sequence('permissions', 'permission_id'), (SELECT COALESCE(MAX(permission_id), 1) FROM permissions));
SELECT setval(pg_get_serial_sequence('branches', 'id'), (SELECT COALESCE(MAX(id), 1) FROM branches));
SELECT setval(pg_get_serial_sequence('departments', 'id'), (SELECT COALESCE(MAX(id), 1) FROM departments));
SELECT setval(pg_get_serial_sequence('positions', 'id'), (SELECT COALESCE(MAX(id), 1) FROM positions));
SELECT setval(pg_get_serial_sequence('employees', 'id'), (SELECT COALESCE(MAX(id), 1) FROM employees));
SELECT setval(pg_get_serial_sequence('users', 'id'), (SELECT COALESCE(MAX(id), 1) FROM users));
SELECT setval(pg_get_serial_sequence('leave_types', 'id'), (SELECT COALESCE(MAX(id), 1) FROM leave_types));
SELECT setval(pg_get_serial_sequence('holidays', 'id'), (SELECT COALESCE(MAX(id), 1) FROM holidays));
SELECT setval(pg_get_serial_sequence('shift_templates', 'id'), (SELECT COALESCE(MAX(id), 1) FROM shift_templates));
SELECT setval(pg_get_serial_sequence('compliance_checklists', 'id'), (SELECT COALESCE(MAX(id), 1) FROM compliance_checklists));
SELECT setval(pg_get_serial_sequence('announcements', 'id'), (SELECT COALESCE(MAX(id), 1) FROM announcements));
SELECT setval(pg_get_serial_sequence('field_work_sites', 'id'), (SELECT COALESCE(MAX(id), 1) FROM field_work_sites));

SELECT 'seed complete' AS status,
  (SELECT COUNT(*)::int FROM employees) AS employees,
  (SELECT COUNT(*)::int FROM users) AS users;
