-- Split Admin vs HR: compliance admin-only (remove from HR role)
USE highway_grill_hrms;

DELETE rp FROM role_permissions rp
INNER JOIN roles r ON r.role_id = rp.role_id
INNER JOIN permissions p ON p.permission_id = rp.permission_id
WHERE r.role_slug = 'hr'
  AND p.permission_key = 'compliance.view';
