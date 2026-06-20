-- Drop unused HRMS template modules (training, performance, recruitment, skills).
-- Safe on databases created from older schema.sql. No app code references these tables.
-- MySQL / MariaDB (XAMPP local)

USE highway_grill_hrms;

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS training_enrollments;
DROP TABLE IF EXISTS training_sessions;
DROP TABLE IF EXISTS training_programs;
DROP TABLE IF EXISTS appraisal_criteria;
DROP TABLE IF EXISTS appraisals;
DROP TABLE IF EXISTS appraisal_cycles;
DROP TABLE IF EXISTS disciplinary_records;
DROP TABLE IF EXISTS interviews;
DROP TABLE IF EXISTS applicants;
DROP TABLE IF EXISTS job_postings;
DROP TABLE IF EXISTS employee_skills;

SET FOREIGN_KEY_CHECKS = 1;
