USE highway_grill_hrms;

ALTER TABLE employee_loans
    ADD COLUMN repayment_schedule ENUM('semi_monthly', 'one_month') NOT NULL DEFAULT 'semi_monthly' AFTER term_months,
    ADD COLUMN term_duration SMALLINT NOT NULL DEFAULT 2 AFTER repayment_schedule;
