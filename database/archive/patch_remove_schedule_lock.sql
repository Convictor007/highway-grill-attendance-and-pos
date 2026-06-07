-- Remove locked schedule status (treat as published)
UPDATE schedules SET status = 'published' WHERE status = 'locked';
