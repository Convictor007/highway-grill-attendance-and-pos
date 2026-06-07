-- Restaurant & cafe positions (safe to re-run)
USE highway_grill_hrms;

SET @branch_id = (SELECT id FROM branches WHERE name = 'Highway Grill' LIMIT 1);

INSERT INTO departments (id, branch_id, name)
SELECT UUID(), @branch_id, 'Cafe' FROM DUAL
WHERE @branch_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM departments WHERE branch_id = @branch_id AND name = 'Cafe');

SET @dept_kitchen = (SELECT id FROM departments WHERE branch_id = @branch_id AND name = 'Kitchen' LIMIT 1);
SET @dept_foh = (SELECT id FROM departments WHERE branch_id = @branch_id AND name = 'Front of House' LIMIT 1);
SET @dept_cafe = (SELECT id FROM departments WHERE branch_id = @branch_id AND name = 'Cafe' LIMIT 1);

INSERT INTO positions (id, department_id, title, pay_grade, min_hourly, max_hourly, is_tipped)
SELECT UUID(), @dept_kitchen, 'Dishwasher', 1, 65.00, 85.00, 0 FROM DUAL
WHERE @dept_kitchen IS NOT NULL AND NOT EXISTS (SELECT 1 FROM positions WHERE department_id = @dept_kitchen AND title = 'Dishwasher');

INSERT INTO positions (id, department_id, title, pay_grade, min_hourly, max_hourly, is_tipped)
SELECT UUID(), @dept_kitchen, 'Prep Cook', 2, 72.00, 100.00, 0 FROM DUAL
WHERE @dept_kitchen IS NOT NULL AND NOT EXISTS (SELECT 1 FROM positions WHERE department_id = @dept_kitchen AND title = 'Prep Cook');

INSERT INTO positions (id, department_id, title, pay_grade, min_hourly, max_hourly, is_tipped)
SELECT UUID(), @dept_kitchen, 'Grill Cook', 3, 80.00, 115.00, 0 FROM DUAL
WHERE @dept_kitchen IS NOT NULL AND NOT EXISTS (SELECT 1 FROM positions WHERE department_id = @dept_kitchen AND title = 'Grill Cook');

INSERT INTO positions (id, department_id, title, pay_grade, min_hourly, max_hourly, is_tipped)
SELECT UUID(), @dept_kitchen, 'Kitchen Helper', 1, 65.00, 88.00, 0 FROM DUAL
WHERE @dept_kitchen IS NOT NULL AND NOT EXISTS (SELECT 1 FROM positions WHERE department_id = @dept_kitchen AND title = 'Kitchen Helper');

INSERT INTO positions (id, department_id, title, pay_grade, min_hourly, max_hourly, is_tipped)
SELECT UUID(), @dept_kitchen, 'Sous Chef', 4, 90.00, 125.00, 0 FROM DUAL
WHERE @dept_kitchen IS NOT NULL AND NOT EXISTS (SELECT 1 FROM positions WHERE department_id = @dept_kitchen AND title = 'Sous Chef');

INSERT INTO positions (id, department_id, title, pay_grade, min_hourly, max_hourly, is_tipped)
SELECT UUID(), @dept_kitchen, 'Pastry Chef', 3, 82.00, 118.00, 0 FROM DUAL
WHERE @dept_kitchen IS NOT NULL AND NOT EXISTS (SELECT 1 FROM positions WHERE department_id = @dept_kitchen AND title = 'Pastry Chef');

INSERT INTO positions (id, department_id, title, pay_grade, min_hourly, max_hourly, is_tipped)
SELECT UUID(), @dept_foh, 'Host', 2, 68.00, 92.00, 0 FROM DUAL
WHERE @dept_foh IS NOT NULL AND NOT EXISTS (SELECT 1 FROM positions WHERE department_id = @dept_foh AND title = 'Host');

INSERT INTO positions (id, department_id, title, pay_grade, min_hourly, max_hourly, is_tipped)
SELECT UUID(), @dept_foh, 'Busser', 1, 62.00, 82.00, 0 FROM DUAL
WHERE @dept_foh IS NOT NULL AND NOT EXISTS (SELECT 1 FROM positions WHERE department_id = @dept_foh AND title = 'Busser');

INSERT INTO positions (id, department_id, title, pay_grade, min_hourly, max_hourly, is_tipped)
SELECT UUID(), @dept_foh, 'Food Runner', 1, 65.00, 85.00, 0 FROM DUAL
WHERE @dept_foh IS NOT NULL AND NOT EXISTS (SELECT 1 FROM positions WHERE department_id = @dept_foh AND title = 'Food Runner');

INSERT INTO positions (id, department_id, title, pay_grade, min_hourly, max_hourly, is_tipped)
SELECT UUID(), @dept_cafe, 'Barista', 2, 70.00, 98.00, 0 FROM DUAL
WHERE @dept_cafe IS NOT NULL AND NOT EXISTS (SELECT 1 FROM positions WHERE department_id = @dept_cafe AND title = 'Barista');

INSERT INTO positions (id, department_id, title, pay_grade, min_hourly, max_hourly, is_tipped)
SELECT UUID(), @dept_cafe, 'Cafe Server', 2, 68.00, 95.00, 1 FROM DUAL
WHERE @dept_cafe IS NOT NULL AND NOT EXISTS (SELECT 1 FROM positions WHERE department_id = @dept_cafe AND title = 'Cafe Server');

INSERT INTO positions (id, department_id, title, pay_grade, min_hourly, max_hourly, is_tipped)
SELECT UUID(), @dept_cafe, 'Cafe Cashier', 2, 70.00, 92.00, 0 FROM DUAL
WHERE @dept_cafe IS NOT NULL AND NOT EXISTS (SELECT 1 FROM positions WHERE department_id = @dept_cafe AND title = 'Cafe Cashier');
