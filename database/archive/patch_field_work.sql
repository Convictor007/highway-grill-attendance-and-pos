-- Field work GIS tables (run on existing highway_grill_hrms DB)
USE highway_grill_hrms;

CREATE TABLE IF NOT EXISTS field_work_sites (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    branch_id CHAR(36) NULL,
    name VARCHAR(150) NOT NULL,
    address TEXT,
    latitude DECIMAL(9,6) NOT NULL,
    longitude DECIMAL(9,6) NOT NULL,
    radius_m INT NOT NULL DEFAULT 150,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS field_work_checkins (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    employee_id CHAR(36) NOT NULL,
    site_id CHAR(36) NULL,
    latitude DECIMAL(9,6) NOT NULL,
    longitude DECIMAL(9,6) NOT NULL,
    notes VARCHAR(255),
    checked_in_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (site_id) REFERENCES field_work_sites(id) ON DELETE SET NULL
) ENGINE=InnoDB;

SET @branch_id = (SELECT id FROM branches WHERE name = 'Highway Grill' LIMIT 1);

INSERT INTO field_work_sites (id, branch_id, name, address, latitude, longitude, radius_m, is_active)
SELECT UUID(), @branch_id, 'Highway Grill — Main', 'Restaurant branch', 14.554700, 121.024400, 200, 1
FROM DUAL
WHERE @branch_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM field_work_sites WHERE name = 'Highway Grill — Main');
