-- Delivery riders are crew: they clock in at the registered branch only (same geofence as servers, kitchen, etc.).
-- Restores Delivery department/role if removed; keeps off-site field zones disabled.
USE highway_grill_hrms;

SET @branch_id = (SELECT id FROM branches WHERE name = 'Highway Grill' LIMIT 1);

INSERT INTO departments (id, branch_id, name)
SELECT UUID(), @branch_id, 'Delivery' FROM DUAL
WHERE @branch_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM departments WHERE branch_id = @branch_id AND name = 'Delivery');

SET @dept_delivery = (SELECT id FROM departments WHERE branch_id = @branch_id AND name = 'Delivery' LIMIT 1);

INSERT INTO positions (id, department_id, title, pay_grade, min_hourly, max_hourly, is_tipped)
SELECT UUID(), @dept_delivery, 'Delivery Rider', 2, 70.00, 95.00, 0 FROM DUAL
WHERE @dept_delivery IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM positions WHERE department_id = @dept_delivery AND title = 'Delivery Rider');

-- Off-site zones stay off; branch main zone is the only clock-in area for everyone
UPDATE field_work_sites
SET is_active = 0, clock_in_eligible = 0
WHERE name IN ('Supplier pickup', 'Catering / event');

UPDATE field_work_sites
SET is_active = 1, clock_in_eligible = 1
WHERE name LIKE '%Main%' OR name LIKE '%Restaurant%' OR name LIKE '%Branch%';
