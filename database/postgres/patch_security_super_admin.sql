-- Security Super Admin role + auth event logging.
-- Safe to run multiple times.

-- Restore System Admin (platform config) — distinct from security super_admin.
UPDATE roles
SET
  role_name = 'System Admin',
  description = 'Platform settings, compliance, and staff access'
WHERE role_slug = 'admin';

SELECT setval(
  'permissions_permission_id_seq',
  GREATEST((SELECT COALESCE(MAX(permission_id), 1) FROM permissions), 1)
);

INSERT INTO permissions (permission_key, permission_name, module, description) VALUES
  ('security.view',   'View security dashboard', 'security', 'Login logs, threats, and employee map'),
  ('security.manage', 'Manage security settings', 'security', 'Resolve threats and security configuration')
ON CONFLICT (permission_key) DO NOTHING;

INSERT INTO roles (role_slug, role_name, description, role_type, is_system, display_order)
SELECT
  'super_admin',
  'Super Admin',
  'Security monitoring — logs, threats, and employee locations',
  'system',
  true,
  0
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE role_slug = 'super_admin');

-- Security role gets security permissions only (not full platform admin).
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r
INNER JOIN permissions p ON p.permission_key IN ('security.view', 'security.manage')
WHERE r.role_slug = 'super_admin'
ON CONFLICT DO NOTHING;

-- Remove mistaken full-permission grant from prior patch_super_admin.sql.
DELETE FROM role_permissions rp
USING roles r, permissions p
WHERE rp.role_id = r.role_id
  AND rp.permission_id = p.permission_id
  AND r.role_slug = 'super_admin'
  AND p.permission_key NOT IN ('security.view', 'security.manage');

CREATE TABLE IF NOT EXISTS auth_events (
    id           SERIAL PRIMARY KEY,
    event_type   VARCHAR(40) NOT NULL,
    user_id      INTEGER REFERENCES users(id) ON DELETE SET NULL,
    email        VARCHAR(255),
    ip_address   VARCHAR(45),
    user_agent   TEXT,
    meta         JSONB,
    threat_level VARCHAR(20) NOT NULL DEFAULT 'none'
        CHECK (threat_level IN ('none', 'low', 'medium', 'high')),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_events_type ON auth_events(event_type);
CREATE INDEX IF NOT EXISTS idx_auth_events_ip ON auth_events(ip_address);
CREATE INDEX IF NOT EXISTS idx_auth_events_created ON auth_events(created_at DESC);

ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS ip_address VARCHAR(45);
ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS user_agent TEXT;
