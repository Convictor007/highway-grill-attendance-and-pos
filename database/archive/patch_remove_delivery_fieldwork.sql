-- All crew (including delivery) clock in at the registered branch only.
-- Disables off-site field zones; does NOT exempt delivery from branch geofence.
USE highway_grill_hrms;

UPDATE field_work_sites
SET is_active = 0, clock_in_eligible = 0
WHERE name IN ('Supplier pickup', 'Catering / event')
   OR name LIKE '%Supplier%'
   OR name LIKE '%Catering%';

UPDATE field_work_sites
SET is_active = 1, clock_in_eligible = 1
WHERE name LIKE '%Main%' OR name LIKE '%Restaurant%' OR name LIKE '%Branch%';
