-- =============================================================================
-- patch_attendance_corrections.sql
-- Employee-submitted attendance correction requests (forgot time in/out,
-- wrong auto clock-out, no internet at punch time). HR reviews and, on
-- approval, the attendance record is created or updated and hours recomputed.
--
-- Idempotent: safe to run multiple times.
-- =============================================================================

CREATE TABLE IF NOT EXISTS attendance_correction_requests (
    id                   SERIAL PRIMARY KEY,
    employee_id          INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    -- NULL when the punch was never recorded (e.g. forgot to time in entirely).
    attendance_id        INTEGER REFERENCES attendance(id) ON DELETE SET NULL,
    request_type         VARCHAR(20) NOT NULL
        CHECK (request_type IN ('missing_in', 'missing_out', 'wrong_time', 'missing_both')),
    requested_clock_in   TIMESTAMPTZ,
    requested_clock_out  TIMESTAMPTZ,
    reason               TEXT NOT NULL,
    status               VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
    reviewed_by          INTEGER REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at          TIMESTAMPTZ,
    review_note          TEXT,
    -- The attendance row created/updated when the request was approved.
    resolved_attendance_id INTEGER REFERENCES attendance(id) ON DELETE SET NULL,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attendance_corrections_status
    ON attendance_correction_requests (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_corrections_employee
    ON attendance_correction_requests (employee_id, created_at DESC);

-- New permission: approve attendance correction requests.
INSERT INTO permissions (permission_id, permission_key, permission_name, module, description) VALUES
(27, 'attendance.correct.approve', 'Approve attendance corrections', 'attendance', 'Review crew time-in/out correction requests')
ON CONFLICT (permission_key) DO NOTHING;

-- Grant to System Admin (role 1) and HR Manager (role 2).
INSERT INTO role_permissions (role_id, permission_id)
SELECT 1, permission_id FROM permissions WHERE permission_key = 'attendance.correct.approve'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT 2, permission_id FROM permissions WHERE permission_key = 'attendance.correct.approve'
ON CONFLICT DO NOTHING;
