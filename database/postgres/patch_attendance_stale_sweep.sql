-- Allow the nightly stale-session sweep to tag its auto clock-outs.
-- Without this, closeSession() fails the clock_out_type CHECK constraint.

ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_clock_out_type_check;
ALTER TABLE attendance
  ADD CONSTRAINT attendance_clock_out_type_check
  CHECK (clock_out_type IN ('manual', 'auto_midnight_cascade', 'auto_outside', 'auto_stale_sweep'));
