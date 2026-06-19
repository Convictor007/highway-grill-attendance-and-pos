-- DTR timing: early/late clock-in and clock-out vs scheduled shift
USE highway_grill_hrms;

SET @cols := 'early_in_minutes,late_in_minutes,early_out_minutes,late_out_minutes';
SET @i := 1;
SET @n := 4;

WHILE @i <= @n DO
    SET @col := SUBSTRING_INDEX(SUBSTRING_INDEX(@cols, ',', @i), ',', -1);
    SET @has_col := (
        SELECT COUNT(*) FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'attendance' AND COLUMN_NAME = @col
    );
    SET @sql := IF(@has_col = 0,
        CONCAT('ALTER TABLE attendance ADD COLUMN ', @col, ' SMALLINT UNSIGNED NULL AFTER overtime_hours'),
        'SELECT 1');
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
    SET @i := @i + 1;
END WHILE;
