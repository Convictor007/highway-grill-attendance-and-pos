-- Run on existing DB after pull: adds employee self-service permissions
USE highway_grill_hrms;

INSERT IGNORE INTO permissions (permission_key, permission_name, module) VALUES
('shifts.view.self', 'View own shift schedule', 'shifts'),
('payroll.view.self', 'View own payslips', 'payroll'),
('profile.edit.self', 'Edit own profile contact info', 'employees'),
('documents.view.self', 'View own HR documents', 'employees'),
('announcements.view', 'View branch announcements', 'employees'),
('overtime.apply', 'Request overtime', 'attendance');

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r
JOIN permissions p ON p.permission_key IN (
  'shifts.view.self', 'payroll.view.self', 'profile.edit.self',
  'documents.view.self', 'announcements.view', 'overtime.apply'
)
WHERE r.role_slug = 'employee';
