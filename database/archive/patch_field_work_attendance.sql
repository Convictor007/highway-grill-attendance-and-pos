-- Link field work check-ins to attendance sessions
USE highway_grill_hrms;

SET @has_col := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'field_work_checkins'
      AND COLUMN_NAME = 'attendance_id'
);

SET @sql := IF(
    @has_col = 0,
    'ALTER TABLE field_work_checkins
        ADD COLUMN attendance_id CHAR(36) NULL AFTER site_id,
        ADD CONSTRAINT fk_field_checkin_attendance
            FOREIGN KEY (attendance_id) REFERENCES attendance(id) ON DELETE SET NULL',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
