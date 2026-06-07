USE highway_grill_hrms;



-- Admin and HR manage staff attendance but do not clock in themselves (off-site / management).

DELETE rp FROM role_permissions rp

INNER JOIN roles r ON r.role_id = rp.role_id

INNER JOIN permissions p ON p.permission_id = rp.permission_id

WHERE r.role_slug IN ('admin', 'hr')

  AND p.permission_key = 'attendance.self';


