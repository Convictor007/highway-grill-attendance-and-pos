-- Auto clock-out + auto overtime tracking
USE highway_grill_hrms;

-- attendance.regular_hours
SET @has_col := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'attendance' AND COLUMN_NAME = 'regular_hours'
);
SET @sql := IF(@has_col = 0,
    'ALTER TABLE attendance ADD COLUMN regular_hours DECIMAL(5,2) NULL AFTER actual_hours',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- attendance.overtime_hours
SET @has_col := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'attendance' AND COLUMN_NAME = 'overtime_hours'
);
SET @sql := IF(@has_col = 0,
    'ALTER TABLE attendance ADD COLUMN overtime_hours DECIMAL(5,2) NULL AFTER regular_hours',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- attendance.clock_out_type
SET @has_col := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'attendance' AND COLUMN_NAME = 'clock_out_type'
);
SET @sql := IF(@has_col = 0,
    'ALTER TABLE attendance ADD COLUMN clock_out_type VARCHAR(32) NOT NULL DEFAULT ''manual'' AFTER clock_out_address',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- attendance.outside_since
SET @has_col := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'attendance' AND COLUMN_NAME = 'outside_since'
);
SET @sql := IF(@has_col = 0,
    'ALTER TABLE attendance ADD COLUMN outside_since DATETIME NULL AFTER clock_out_type',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- overtime_requests.source
SET @has_col := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'overtime_requests' AND COLUMN_NAME = 'source'
);
SET @sql := IF(@has_col = 0,
    'ALTER TABLE overtime_requests ADD COLUMN source VARCHAR(16) NOT NULL DEFAULT ''manual'' AFTER status',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- overtime_requests.attendance_id
SET @has_col := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'overtime_requests' AND COLUMN_NAME = 'attendance_id'
);
SET @sql := IF(@has_col = 0,
    'ALTER TABLE overtime_requests ADD COLUMN attendance_id CHAR(36) NULL AFTER source',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
