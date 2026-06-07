-- Widen active branch clock-in zones for real-world GPS drift (phones often ±30–50m).
USE highway_grill_hrms;

UPDATE field_work_sites
SET radius_m = GREATEST(radius_m, 100)
WHERE is_active = 1
  AND clock_in_eligible = 1
  AND branch_id IS NOT NULL
  AND radius_m < 100;

