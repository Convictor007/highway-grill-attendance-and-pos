-- DTR timing: early/late clock-in and clock-out vs scheduled shift
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS early_in_minutes  SMALLINT;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS late_in_minutes   SMALLINT;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS early_out_minutes SMALLINT;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS late_out_minutes  SMALLINT;
