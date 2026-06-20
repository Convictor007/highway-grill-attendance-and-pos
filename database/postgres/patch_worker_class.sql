-- worker_class: regular (paid leave + 13th month) vs on_call (neither)

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS worker_class VARCHAR(20) NOT NULL DEFAULT 'regular';

ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_worker_class_check;
ALTER TABLE employees
  ADD CONSTRAINT employees_worker_class_check
  CHECK (worker_class IN ('regular', 'on_call'));

UPDATE employees SET worker_class = 'regular' WHERE worker_class IS NULL OR worker_class = '';

INSERT INTO leave_types (name, paid, days_per_year, carry_forward, requires_approval, color_hex)
SELECT 'Unpaid absence', false, 0, false, true, '#888888'
WHERE NOT EXISTS (
  SELECT 1 FROM leave_types WHERE name = 'Unpaid absence' AND paid = false
);
