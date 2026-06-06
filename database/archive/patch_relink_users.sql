-- Link users to employees by matching email (fixes clock-in "No employee linked")
USE highway_grill_hrms;

UPDATE users u
INNER JOIN employees e ON LOWER(e.email) = LOWER(u.email)
SET u.employee_id = e.id
WHERE u.employee_id IS NULL;

-- Ensure demo accounts point at the right emp_number rows
UPDATE users u
INNER JOIN employees e ON e.emp_number = 'HG-EMP'
SET u.employee_id = e.id
WHERE u.email = 'employee@highwaygrill.local';

UPDATE users u
INNER JOIN employees e ON e.emp_number = 'HG-HR'
SET u.employee_id = e.id
WHERE u.email = 'hr@highwaygrill.local';

UPDATE users u
INNER JOIN employees e ON e.emp_number = 'HG-ADM'
SET u.employee_id = e.id
WHERE u.email = 'admin@highwaygrill.local';
