-- Remove schedule rows with invalid zero dates (caused "week of 0000-00-00" in UI)
DELETE FROM schedules WHERE week_start IS NULL OR week_start < '2000-01-01';
