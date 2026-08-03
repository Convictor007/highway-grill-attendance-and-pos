-- Live employee location pings (background GPS from mobile app).
-- Safe to run multiple times.

CREATE TABLE IF NOT EXISTS employee_location_pings (
    id           SERIAL PRIMARY KEY,
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    employee_id  INTEGER REFERENCES employees(id) ON DELETE SET NULL,
    latitude     NUMERIC(10, 7) NOT NULL,
    longitude    NUMERIC(10, 7) NOT NULL,
    accuracy_m   NUMERIC(8, 2),
    altitude_m   NUMERIC(8, 2),
    speed_mps    NUMERIC(8, 2),
    heading_deg  NUMERIC(6, 2),
    source       VARCHAR(20) NOT NULL DEFAULT 'background'
        CHECK (source IN ('background', 'foreground', 'manual')),
    recorded_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_location_pings_user_time
    ON employee_location_pings(user_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_location_pings_employee_time
    ON employee_location_pings(employee_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_location_pings_recorded
    ON employee_location_pings(recorded_at DESC);
