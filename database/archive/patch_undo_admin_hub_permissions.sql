-- Undo admin hub permission split — restore HR users.manage + compliance.view
USE highway_grill_hrms;

DELETE rp FROM role_permissions rp
INNER JOIN roles r ON r.role_id = rp.role_id
INNER JOIN permissions p ON p.permission_id = rp.permission_id
WHERE r.role_slug = 'hr'
  AND p.permission_key = 'users.approve';

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r
JOIN permissions p ON p.permission_key IN ('users.manage', 'compliance.view')
WHERE r.role_slug = 'hr';
