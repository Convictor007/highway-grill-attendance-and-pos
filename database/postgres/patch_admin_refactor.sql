
BEGIN;
UPDATE users u
SET employee_id = NULL
FROM roles r
WHERE u.role_id = r.role_id
  AND r.role_slug = 'admin';

DELETE FROM employees e
WHERE e.emp_number = 'HG-ADM'
  AND NOT EXISTS (
    SELECT 1 FROM users u
    WHERE u.employee_id = e.id
      AND u.role_id <> (SELECT role_id FROM roles WHERE role_slug = 'admin' LIMIT 1)
  );

DELETE FROM positions p
WHERE p.title = 'System Admin'
  AND NOT EXISTS (SELECT 1 FROM employees e WHERE e.position_id = p.id);

COMMIT;

SELECT 'admin refactor complete' AS status,
  (SELECT employee_id IS NULL FROM users u INNER JOIN roles r ON r.role_id = u.role_id WHERE r.role_slug = 'admin' LIMIT 1) AS admin_unlinked;
