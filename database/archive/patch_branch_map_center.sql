-- Persist last map center per branch for field-work zone registration
USE highway_grill_hrms;

SET @has_lat := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'branches'
      AND COLUMN_NAME = 'default_latitude'
);

SET @sql_lat := IF(
    @has_lat = 0,
    'ALTER TABLE branches ADD COLUMN default_latitude DECIMAL(10,7) NULL AFTER address, ADD COLUMN default_longitude DECIMAL(10,7) NULL AFTER default_latitude',
    'SELECT 1'
);
PREPARE stmt FROM @sql_lat;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Seed branch map center from the newest active field work site per branch
UPDATE branches b
INNER JOIN (
    SELECT s.branch_id, s.latitude, s.longitude
    FROM field_work_sites s
    INNER JOIN (
        SELECT branch_id, MAX(created_at) AS latest
        FROM field_work_sites
        WHERE branch_id IS NOT NULL AND is_active = 1
        GROUP BY branch_id
    ) t ON t.branch_id = s.branch_id AND t.latest = s.created_at
    WHERE s.is_active = 1
) z ON z.branch_id = b.id
SET b.default_latitude = z.latitude,
    b.default_longitude = z.longitude
WHERE b.default_latitude IS NULL;
