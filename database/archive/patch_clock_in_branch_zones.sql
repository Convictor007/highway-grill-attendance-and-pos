-- Branch GIS work zones count for employee clock-in/out geofence.
USE highway_grill_hrms;

UPDATE field_work_sites
SET clock_in_eligible = 1
WHERE is_active = 1
  AND branch_id IS NOT NULL;

