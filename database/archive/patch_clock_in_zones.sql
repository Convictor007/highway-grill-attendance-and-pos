-- Clock-in geofence: only sites marked clock_in_eligible apply to branch time clock.
USE highway_grill_hrms;

SET @has_clock_in := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'field_work_sites'
      AND COLUMN_NAME = 'clock_in_eligible'
);

SET @sql_clock_in := IF(
    @has_clock_in = 0,
    'ALTER TABLE field_work_sites ADD COLUMN clock_in_eligible TINYINT(1) NOT NULL DEFAULT 0 AFTER is_active',
    'SELECT 1'
);
PREPARE stmt FROM @sql_clock_in;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE field_work_sites
SET clock_in_eligible = 1
WHERE name LIKE '%Main%' OR name LIKE '%Branch%' OR name LIKE '%Restaurant%';

UPDATE field_work_sites
SET is_active = 0, clock_in_eligible = 0
WHERE name IN ('Supplier pickup', 'Catering / event')
   OR name LIKE '%Supplier%'
   OR name LIKE '%Catering%';
