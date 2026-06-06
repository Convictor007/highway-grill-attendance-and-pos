USE highway_grill_hrms;

ALTER TABLE attendance
  ADD COLUMN clock_in_address VARCHAR(255) NULL AFTER longitude,
  ADD COLUMN clock_out_address VARCHAR(255) NULL AFTER clock_in_address;

ALTER TABLE field_work_checkins
  ADD COLUMN address VARCHAR(255) NULL AFTER longitude;
