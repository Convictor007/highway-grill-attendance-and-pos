-- =============================================================================
-- patch_restaurant_positions.sql — Kitchen, FOH, Bar, Cafe roles
-- Safe to re-run on live Neon / Postgres.
-- =============================================================================

BEGIN;

-- NOTE: "Front of House" is intentionally NOT created here. The dining-room /
-- customer-facing team lives under the "Service" department (see merge patch
-- patch_merge_foh_into_service.sql). Re-adding FOH would re-split the team.
INSERT INTO departments (branch_id, name, cost_center)
SELECT 1, v.name, v.cc
FROM (VALUES
  ('Bar',  'BAR'),
  ('Cafe', 'CAFE')
) AS v(name, cc)
WHERE NOT EXISTS (
  SELECT 1 FROM departments d WHERE d.branch_id = 1 AND d.name = v.name
);

-- Kitchen (incl. back kitchen / BOH)
INSERT INTO positions (department_id, title, pay_grade, min_hourly, max_hourly, is_tipped)
SELECT d.id, v.title, v.pg, v.min_h, v.max_h, v.tipped
FROM departments d
CROSS JOIN (VALUES
  ('Head Cook',      'K4', 95.00::numeric, 130.00::numeric, false),
  ('Back Kitchen',   'K2', 72.00::numeric, 100.00::numeric, false),
  ('Grill Cook',     'K3', 80.00::numeric, 115.00::numeric, false),
  ('Prep Cook',      'K2', 72.00::numeric, 100.00::numeric, false),
  ('Dishwasher',     'K1', 65.00::numeric,  85.00::numeric, false),
  ('Kitchen Helper', 'K1', 65.00::numeric,  88.00::numeric, false),
  ('Sous Chef',      'K4', 90.00::numeric, 125.00::numeric, false),
  ('Pastry Chef',    'K3', 82.00::numeric, 118.00::numeric, false)
) AS v(title, pg, min_h, max_h, tipped)
WHERE d.branch_id = 1 AND d.name = 'Kitchen'
  AND NOT EXISTS (
    SELECT 1 FROM positions p WHERE p.department_id = d.id AND p.title = v.title
  );

-- Service department (legacy — crew registration may still use this)
INSERT INTO positions (department_id, title, pay_grade, min_hourly, max_hourly, is_tipped)
SELECT d.id, v.title, v.pg, v.min_h, v.max_h, v.tipped
FROM departments d
CROSS JOIN (VALUES
  ('Server',      'S2', 70.00::numeric, 100.00::numeric, true),
  ('Cashier',     'S2', 72.00::numeric,  95.00::numeric, false),
  ('Host',        'S2', 68.00::numeric,  92.00::numeric, false),
  ('Busser',      'S1', 62.00::numeric,  82.00::numeric, false),
  ('Food Runner', 'S1', 65.00::numeric,  85.00::numeric, false)
) AS v(title, pg, min_h, max_h, tipped)
WHERE d.branch_id = 1 AND d.name = 'Service'
  AND NOT EXISTS (
    SELECT 1 FROM positions p WHERE p.department_id = d.id AND p.title = v.title
  );

-- Bar
INSERT INTO positions (department_id, title, pay_grade, min_hourly, max_hourly, is_tipped)
SELECT d.id, v.title, v.pg, v.min_h, v.max_h, v.tipped
FROM departments d
CROSS JOIN (VALUES
  ('Bartender', 'B3', 75.00::numeric, 110.00::numeric, true)
) AS v(title, pg, min_h, max_h, tipped)
WHERE d.branch_id = 1 AND d.name = 'Bar'
  AND NOT EXISTS (
    SELECT 1 FROM positions p WHERE p.department_id = d.id AND p.title = v.title
  );

-- Cafe
INSERT INTO positions (department_id, title, pay_grade, min_hourly, max_hourly, is_tipped)
SELECT d.id, v.title, v.pg, v.min_h, v.max_h, v.tipped
FROM departments d
CROSS JOIN (VALUES
  ('Barista',      'C2', 70.00::numeric, 98.00::numeric, false),
  ('Cafe Server',  'C2', 68.00::numeric, 95.00::numeric, true),
  ('Cafe Cashier', 'C2', 70.00::numeric, 92.00::numeric, false)
) AS v(title, pg, min_h, max_h, tipped)
WHERE d.branch_id = 1 AND d.name = 'Cafe'
  AND NOT EXISTS (
    SELECT 1 FROM positions p WHERE p.department_id = d.id AND p.title = v.title
  );

-- Management
INSERT INTO positions (department_id, title, pay_grade, min_hourly, max_hourly, is_tipped)
SELECT d.id, v.title, v.pg, v.min_h, v.max_h, v.tipped
FROM departments d
CROSS JOIN (VALUES
  ('Restaurant Manager', 'M2', 120.00::numeric, 180.00::numeric, false)
) AS v(title, pg, min_h, max_h, tipped)
WHERE d.branch_id = 1 AND d.name = 'Management'
  AND NOT EXISTS (
    SELECT 1 FROM positions p WHERE p.department_id = d.id AND p.title = v.title
  );

-- Remove delivery (Food Panda handles delivery — no in-house riders)
DELETE FROM positions p
USING departments d
WHERE p.department_id = d.id
  AND d.branch_id = 1
  AND d.name = 'Delivery'
  AND NOT EXISTS (SELECT 1 FROM employees e WHERE e.position_id = p.id);

DELETE FROM departments d
WHERE d.branch_id = 1
  AND d.name = 'Delivery'
  AND NOT EXISTS (SELECT 1 FROM employees e WHERE e.department_id = d.id)
  AND NOT EXISTS (SELECT 1 FROM positions p WHERE p.department_id = d.id);

COMMIT;

SELECT d.name AS department, p.title, p.min_hourly, p.is_tipped
FROM positions p
INNER JOIN departments d ON d.id = p.department_id
WHERE d.branch_id = 1
ORDER BY d.name, p.title;
