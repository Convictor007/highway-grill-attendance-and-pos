-- Attendance correction audit indexes (Neon / Postgres)
-- Improves filtering of attendance + correction audit trail.

CREATE INDEX IF NOT EXISTS idx_audit_logs_table_action
  ON audit_logs (table_name, action, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_record
  ON audit_logs (table_name, record_id);

-- Ensure action column can hold longer correction action names
ALTER TABLE audit_logs
  ALTER COLUMN action TYPE VARCHAR(80);
