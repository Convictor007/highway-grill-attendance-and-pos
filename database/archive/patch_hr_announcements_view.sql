-- HR: allow viewing branch announcements (memos) alongside employees.manage content tools.
INSERT IGNORE INTO permissions (permission_key, permission_name, module) VALUES
('announcements.view', 'View branch announcements', 'employees');

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r
JOIN permissions p ON p.permission_key = 'announcements.view'
WHERE r.role_slug = 'hr';
