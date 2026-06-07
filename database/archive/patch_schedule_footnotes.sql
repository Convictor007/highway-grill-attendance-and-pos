-- Editable day footnotes (e.g. GENERAL CLEANING) per weekly schedule
ALTER TABLE schedules
  ADD COLUMN day_footnotes JSON NULL COMMENT 'Day index 0=Sun..6=Sat -> note text';
