-- =============================================================================
-- patch_merge_foh_into_service.sql
-- Consolidate the "Front of House" department into the legacy "Service"
-- department. Service is KEPT; Front of House is removed after its employees
-- and positions are moved over.
--
-- Matching is done by department NAME within the same branch, so it works
-- regardless of the auto-generated department/position ids on live Neon.
-- Safe to re-run (idempotent) on live Neon / Postgres.
-- =============================================================================

BEGIN;

-- 1. Repoint employees off any Front of House position that DUPLICATES a
--    Service position of the same title, so the FOH duplicate can be removed
--    without orphaning the employee (FK is ON DELETE SET NULL).
WITH dept_pairs AS (
  SELECT svc.id AS service_id, foh.id AS foh_id
  FROM departments svc
  JOIN departments foh
    ON foh.branch_id = svc.branch_id AND foh.name = 'Front of House'
  WHERE svc.name = 'Service'
),
pos_map AS (
  SELECT fp.id AS foh_pos_id, sp.id AS service_pos_id
  FROM dept_pairs dp
  JOIN positions fp ON fp.department_id = dp.foh_id
  JOIN positions sp ON sp.department_id = dp.service_id
                   AND lower(sp.title) = lower(fp.title)
)
UPDATE employees e
SET position_id = pm.service_pos_id
FROM pos_map pm
WHERE e.position_id = pm.foh_pos_id;

-- 2. Move the remaining (non-duplicate) Front of House positions into Service.
WITH dept_pairs AS (
  SELECT svc.id AS service_id, foh.id AS foh_id
  FROM departments svc
  JOIN departments foh
    ON foh.branch_id = svc.branch_id AND foh.name = 'Front of House'
  WHERE svc.name = 'Service'
)
UPDATE positions p
SET department_id = dp.service_id
FROM dept_pairs dp
WHERE p.department_id = dp.foh_id
  AND NOT EXISTS (
    SELECT 1 FROM positions sp
    WHERE sp.department_id = dp.service_id
      AND lower(sp.title) = lower(p.title)
  );

-- 3. Delete the leftover duplicate Front of House positions (their employees
--    were already repointed to the Service equivalent in step 1).
WITH dept_pairs AS (
  SELECT svc.id AS service_id, foh.id AS foh_id
  FROM departments svc
  JOIN departments foh
    ON foh.branch_id = svc.branch_id AND foh.name = 'Front of House'
  WHERE svc.name = 'Service'
)
DELETE FROM positions p
USING dept_pairs dp
WHERE p.department_id = dp.foh_id;

-- 4. Move any employees still assigned to the Front of House department
--    into Service.
WITH dept_pairs AS (
  SELECT svc.id AS service_id, foh.id AS foh_id
  FROM departments svc
  JOIN departments foh
    ON foh.branch_id = svc.branch_id AND foh.name = 'Front of House'
  WHERE svc.name = 'Service'
)
UPDATE employees e
SET department_id = dp.service_id
FROM dept_pairs dp
WHERE e.department_id = dp.foh_id;

-- 5. Remove the now-empty Front of House department(s).
DELETE FROM departments d
WHERE d.name = 'Front of House'
  AND NOT EXISTS (SELECT 1 FROM positions p WHERE p.department_id = d.id)
  AND NOT EXISTS (SELECT 1 FROM employees e WHERE e.department_id = d.id);

COMMIT;

-- Verification: Service should now hold all customer-facing roles.
SELECT d.name AS department, p.title, p.pay_grade, p.is_tipped
FROM positions p
INNER JOIN departments d ON d.id = p.department_id
WHERE d.branch_id = 1 AND d.name = 'Service'
ORDER BY p.title;
