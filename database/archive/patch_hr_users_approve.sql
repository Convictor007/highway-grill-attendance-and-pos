-- HR: crew approvals only (users.approve). Admin keeps users.manage via cross-join.
USE highway_grill_hrms;

INSERT IGNORE INTO permissions (permission_key, permission_name, module) VALUES
('users.approve', 'Approve crew registrations', 'users');

DELETE rp FROM role_permissions rp
INNER JOIN roles r ON r.role_id = rp.role_id
INNER JOIN permissions p ON p.permission_id = rp.permission_id
WHERE r.role_slug = 'hr'
  AND p.permission_key = 'users.manage';

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r
JOIN permissions p ON p.permission_key = 'users.approve'
WHERE r.role_slug = 'hr';
