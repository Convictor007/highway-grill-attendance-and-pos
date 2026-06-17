-- =============================================================================
-- patch_production_auth.sql — migrate live Neon DB to bcrypt + new admin/HR emails
-- Run once on production after deploying AUTH_HASH_PASSWORDS=true on Vercel.
--
-- After run:
--   admin@highwaygrill.com / hg2015
--   hr@highwaygrill.com    / HrTemp2025!  (change from Admin → Users)
-- =============================================================================

BEGIN;

-- Remove demo employee (id 3) and related rows
DELETE FROM user_sessions WHERE user_id IN (SELECT id FROM users WHERE employee_id = 3 OR email ILIKE '%employee@highwaygrill%');
DELETE FROM notifications WHERE user_id IN (SELECT id FROM users WHERE employee_id = 3 OR email ILIKE '%employee@highwaygrill%');
DELETE FROM shift_assignments WHERE employee_id = 3;
DELETE FROM leave_balances WHERE employee_id = 3;
DELETE FROM employee_benefit_enrollments WHERE employee_id = 3;
DELETE FROM employee_government_profiles WHERE employee_id = 3;
DELETE FROM attendance WHERE employee_id = 3;
DELETE FROM users WHERE employee_id = 3 OR email ILIKE 'employee@highwaygrill%';
DELETE FROM employees WHERE id = 3;

-- Admin + HR: new emails and bcrypt passwords
UPDATE employees SET email = 'admin@highwaygrill.com' WHERE id = 1;
UPDATE employees SET email = 'hr@highwaygrill.com' WHERE id = 2;

UPDATE users SET
  email = 'admin@highwaygrill.com',
  password_hash = '$2b$10$bqNP7HI5iOCKpoyRn0czkObfX2bEL9.NWqpSg3PNYrFEtImQ/wEVe'
WHERE id = 1 OR email ILIKE 'admin@highwaygrill%';

UPDATE users SET
  email = 'hr@highwaygrill.com',
  password_hash = '$2b$10$kkczef//Ci.vFrSrlhRlgu56k43nKjYTHNuSRBMR36TYS9nu9TKZC'
WHERE id = 2 OR email ILIKE 'hr@highwaygrill%';

-- Invalidate old sessions so everyone re-authenticates
DELETE FROM user_sessions;

COMMIT;

SELECT email, role_id, left(password_hash, 7) AS hash_prefix FROM users ORDER BY id;
