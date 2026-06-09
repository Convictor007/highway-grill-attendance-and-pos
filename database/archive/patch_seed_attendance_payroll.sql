-- Evening crew attendance for current semi-monthly cut-off
-- Target shift: 3:00 PM – 12:00 AM (9 hours), with random variations:
--   day off, early in, late in, early out, overtime
-- Covers HG-200, HG-EMP, HG-HR and any other active Highway Grill staff (not HG-ADM).
-- Safe to re-run — replaces flat 8–5 rows in the cut-off, then inserts missing days.

USE highway_grill_hrms;

SET @branch_id = (SELECT id FROM branches WHERE name = 'Highway Grill' LIMIT 1);

SET @period_start = CASE
  WHEN DAY(CURDATE()) <= 15 THEN DATE_FORMAT(CURDATE(), '%Y-%m-01')
  ELSE DATE_FORMAT(CURDATE(), '%Y-%m-16')
END;
SET @period_end = CASE
  WHEN DAY(CURDATE()) <= 15 THEN DATE_FORMAT(CURDATE(), '%Y-%m-15')
  ELSE LAST_DAY(CURDATE())
END;

UPDATE employees e
LEFT JOIN positions p ON p.id = e.position_id
SET e.pay_rate = COALESCE(NULLIF(e.pay_rate, 0), p.min_hourly, 80.00)
WHERE e.branch_id = @branch_id AND e.status = 'active';

UPDATE employees SET pay_basis = 'daily', pay_rate = 395.00
WHERE emp_number = 'HG-EMP' AND branch_id = @branch_id;

UPDATE employees SET pay_basis = 'daily', pay_rate = 455.00
WHERE emp_number = 'HG-200' AND branch_id = @branch_id;

DELETE a FROM attendance a
INNER JOIN employees e ON e.id = a.employee_id
WHERE e.branch_id = @branch_id
  AND e.status = 'active'
  AND e.emp_number NOT IN ('HG-ADM')
  AND DATE(a.clock_in) BETWEEN @period_start AND @period_end;

INSERT INTO attendance (id, employee_id, clock_in, clock_out, actual_hours, regular_hours, overtime_hours, method)
SELECT
  UUID(),
  s.employee_id,
  s.clock_in,
  s.clock_out,
  ROUND(TIMESTAMPDIFF(MINUTE, s.clock_in, s.clock_out) / 60, 2),
  ROUND(LEAST(TIMESTAMPDIFF(MINUTE, s.clock_in, s.clock_out) / 60, 9), 2),
  ROUND(GREATEST(TIMESTAMPDIFF(MINUTE, s.clock_in, s.clock_out) / 60 - 9, 0), 2),
  'app'
FROM (
  SELECT
    e.id AS employee_id,
    d.work_date,
    MOD(CRC32(CONCAT(e.id, d.work_date)), 15) AS pattern,
    CASE MOD(CRC32(CONCAT(e.id, d.work_date)), 15)
      WHEN 0 THEN NULL
      WHEN 1 THEN NULL
      WHEN 2 THEN TIMESTAMP(d.work_date, '15:00:00')
      WHEN 3 THEN TIMESTAMP(d.work_date, '14:30:00')
      WHEN 4 THEN TIMESTAMP(d.work_date, '14:45:00')
      WHEN 5 THEN TIMESTAMP(d.work_date, '15:20:00')
      WHEN 6 THEN TIMESTAMP(d.work_date, '15:00:00')
      WHEN 7 THEN TIMESTAMP(d.work_date, '15:00:00')
      WHEN 8 THEN TIMESTAMP(d.work_date, '15:00:00')
      WHEN 9 THEN TIMESTAMP(d.work_date, '15:00:00')
      WHEN 10 THEN TIMESTAMP(d.work_date, '15:00:00')
      WHEN 11 THEN TIMESTAMP(d.work_date, '14:30:00')
      WHEN 12 THEN TIMESTAMP(d.work_date, '15:30:00')
      WHEN 13 THEN TIMESTAMP(d.work_date, '15:05:00')
      WHEN 14 THEN TIMESTAMP(d.work_date, '15:00:00')
    END AS clock_in,
    CASE MOD(CRC32(CONCAT(e.id, d.work_date)), 15)
      WHEN 0 THEN NULL
      WHEN 1 THEN NULL
      WHEN 2 THEN TIMESTAMP(DATE_ADD(d.work_date, INTERVAL 1 DAY), '00:00:00')
      WHEN 3 THEN TIMESTAMP(d.work_date, '23:30:00')
      WHEN 4 THEN TIMESTAMP(d.work_date, '23:45:00')
      WHEN 5 THEN TIMESTAMP(DATE_ADD(d.work_date, INTERVAL 1 DAY), '00:20:00')
      WHEN 6 THEN TIMESTAMP(DATE_ADD(d.work_date, INTERVAL 1 DAY), '00:00:00')
      WHEN 7 THEN TIMESTAMP(d.work_date, '22:00:00')
      WHEN 8 THEN TIMESTAMP(d.work_date, '21:30:00')
      WHEN 9 THEN TIMESTAMP(DATE_ADD(d.work_date, INTERVAL 1 DAY), '00:00:00')
      WHEN 10 THEN TIMESTAMP(DATE_ADD(d.work_date, INTERVAL 1 DAY), '01:00:00')
      WHEN 11 THEN TIMESTAMP(DATE_ADD(d.work_date, INTERVAL 1 DAY), '00:30:00')
      WHEN 12 THEN TIMESTAMP(DATE_ADD(d.work_date, INTERVAL 1 DAY), '00:30:00')
      WHEN 13 THEN TIMESTAMP(DATE_ADD(d.work_date, INTERVAL 1 DAY), '00:05:00')
      WHEN 14 THEN TIMESTAMP(d.work_date, '23:00:00')
    END AS clock_out
  FROM employees e
  CROSS JOIN (
    WITH RECURSIVE period_days AS (
      SELECT @period_start AS work_date
      UNION ALL
      SELECT DATE_ADD(work_date, INTERVAL 1 DAY)
      FROM period_days
      WHERE work_date < @period_end
    )
    SELECT work_date FROM period_days
  ) d
  WHERE e.branch_id = @branch_id
    AND e.status = 'active'
    AND e.emp_number NOT IN ('HG-ADM')
) s
WHERE s.clock_in IS NOT NULL
  AND s.clock_out IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM attendance a
    WHERE a.employee_id = s.employee_id AND DATE(a.clock_in) = s.work_date
  );
