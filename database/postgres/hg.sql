-- =============================================================================
-- hg.sql — Highway Grill HRMS (PostgreSQL / Neon)
-- Integer primary keys: SERIAL (= auto-increment 1, 2, 3… on INSERT).
-- Derived from tables/columns used in server/lib + server/app/api only.
-- =============================================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------------------------------
-- Organization
-- -----------------------------------------------------------------------------

CREATE TABLE branches (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(120) NOT NULL,
    address         TEXT,
    phone           VARCHAR(40),
    timezone        VARCHAR(64) NOT NULL DEFAULT 'Asia/Manila',
    is_active       BOOLEAN NOT NULL DEFAULT true,
    manager_id      INTEGER,
    default_latitude  NUMERIC(10, 7),
    default_longitude NUMERIC(10, 7),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE departments (
    id           SERIAL PRIMARY KEY,
    branch_id    INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    name         VARCHAR(120) NOT NULL,
    cost_center  VARCHAR(40),
    head_id      INTEGER
);

CREATE TABLE positions (
    id            SERIAL PRIMARY KEY,
    department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    title         VARCHAR(120) NOT NULL,
    pay_grade     VARCHAR(20),
    min_hourly    NUMERIC(10, 2),
    max_hourly    NUMERIC(10, 2),
    is_tipped     BOOLEAN NOT NULL DEFAULT false
);

-- -----------------------------------------------------------------------------
-- Auth & RBAC
-- -----------------------------------------------------------------------------

CREATE TABLE roles (
    role_id       SERIAL PRIMARY KEY,
    role_slug     VARCHAR(40) NOT NULL UNIQUE,
    role_name     VARCHAR(80) NOT NULL,
    description   TEXT,
    role_type     VARCHAR(20) NOT NULL DEFAULT 'staff'
        CHECK (role_type IN ('staff', 'customer', 'system')),
    is_system     BOOLEAN NOT NULL DEFAULT false,
    display_order INT NOT NULL DEFAULT 0
);

CREATE TABLE permissions (
    permission_id   SERIAL PRIMARY KEY,
    permission_key  VARCHAR(80) NOT NULL UNIQUE,
    permission_name VARCHAR(120) NOT NULL,
    module          VARCHAR(40) NOT NULL,
    description     TEXT
);

CREATE TABLE role_permissions (
    role_id       INT NOT NULL REFERENCES roles(role_id) ON DELETE CASCADE,
    permission_id INT NOT NULL REFERENCES permissions(permission_id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE users (
    id              SERIAL PRIMARY KEY,
    email           VARCHAR(255) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    role_id         INT NOT NULL REFERENCES roles(role_id),
    employee_id     INTEGER,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    account_status  VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (account_status IN ('awaiting_hr', 'pending', 'active', 'rejected')),
    activated_at    TIMESTAMPTZ,
    activated_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
    approved_at     TIMESTAMPTZ,
    approved_by     INTEGER REFERENCES users(id) ON DELETE SET NULL,
    last_login_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE user_permissions (
    user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    permission_id INT NOT NULL REFERENCES permissions(permission_id) ON DELETE CASCADE,
    grant_type    VARCHAR(10) NOT NULL DEFAULT 'grant'
        CHECK (grant_type IN ('grant', 'deny')),
    PRIMARY KEY (user_id, permission_id)
);

CREATE TABLE user_sessions (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  VARCHAR(64) NOT NULL,
    expires_at  TIMESTAMPTZ NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_sessions_token ON user_sessions(token_hash);
CREATE INDEX idx_user_sessions_user ON user_sessions(user_id);

-- -----------------------------------------------------------------------------
-- Employees
-- -----------------------------------------------------------------------------

CREATE TABLE employees (
    id                SERIAL PRIMARY KEY,
    branch_id         INTEGER NOT NULL REFERENCES branches(id),
    department_id     INTEGER REFERENCES departments(id) ON DELETE SET NULL,
    position_id       INTEGER REFERENCES positions(id) ON DELETE SET NULL,
    emp_number        VARCHAR(20) NOT NULL UNIQUE,
    first_name        VARCHAR(80) NOT NULL,
    last_name         VARCHAR(80) NOT NULL,
    email             VARCHAR(255),
    phone             VARCHAR(40),
    hire_date         DATE NOT NULL DEFAULT CURRENT_DATE,
    employment_type   VARCHAR(20) NOT NULL DEFAULT 'full_time'
        CHECK (employment_type IN ('full_time', 'part_time', 'casual', 'seasonal')),
    worker_class      VARCHAR(20) NOT NULL DEFAULT 'regular'
        CHECK (worker_class IN ('regular', 'on_call')),
    pay_basis         VARCHAR(10) NOT NULL DEFAULT 'hourly'
        CHECK (pay_basis IN ('hourly', 'daily')),
    pay_rate          NUMERIC(10, 2),
    is_stay_in        BOOLEAN NOT NULL DEFAULT false,
    housing_deduction NUMERIC(10, 2) NOT NULL DEFAULT 0,
    status            VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'pending', 'terminated', 'on_leave')),
    date_of_birth     DATE,
    gender            VARCHAR(20) CHECK (gender IN ('male', 'female', 'other', 'prefer_not')),
    nationality       VARCHAR(80),
    national_id       VARCHAR(40),
    address           TEXT,
    emergency_name    VARCHAR(120),
    emergency_phone   VARCHAR(40),
    photo_url         TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE branches
    ADD CONSTRAINT fk_branches_manager
    FOREIGN KEY (manager_id) REFERENCES employees(id) ON DELETE SET NULL;

ALTER TABLE departments
    ADD CONSTRAINT fk_departments_head
    FOREIGN KEY (head_id) REFERENCES employees(id) ON DELETE SET NULL;

ALTER TABLE users
    ADD CONSTRAINT fk_users_employee
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL;

CREATE INDEX idx_employees_branch ON employees(branch_id);
CREATE INDEX idx_employees_status ON employees(status);

CREATE TABLE employee_government_profiles (
    employee_id           INTEGER PRIMARY KEY REFERENCES employees(id) ON DELETE CASCADE,
    sss_number            VARCHAR(20),
    philhealth_number     VARCHAR(20),
    pagibig_number        VARCHAR(20),
    tin                   VARCHAR(20),
    sss_enrolled          BOOLEAN NOT NULL DEFAULT false,
    philhealth_enrolled   BOOLEAN NOT NULL DEFAULT false,
    pagibig_enrolled      BOOLEAN NOT NULL DEFAULT false,
    sss_deduction_mode    VARCHAR(10) NOT NULL DEFAULT 'manual',
    sss_monthly_amount    NUMERIC(12, 2),
    philhealth_deduction_mode VARCHAR(10) NOT NULL DEFAULT 'manual',
    philhealth_monthly_amount NUMERIC(12, 2),
    pagibig_deduction_mode VARCHAR(10) NOT NULL DEFAULT 'manual',
    pagibig_monthly_amount NUMERIC(12, 2),
    tax_deduction_mode    VARCHAR(10) NOT NULL DEFAULT 'manual',
    tax_monthly_amount    NUMERIC(12, 2),
    tax_enrolled          BOOLEAN NOT NULL DEFAULT false,
    notes                 TEXT,
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER employee_government_profiles_updated_at
    BEFORE UPDATE ON employee_government_profiles
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE employee_contracts (
    id             SERIAL PRIMARY KEY,
    employee_id    INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    contract_type  VARCHAR(40) NOT NULL DEFAULT 'permanent',
    start_date     DATE NOT NULL,
    end_date       DATE,
    hourly_rate    NUMERIC(10, 2),
    weekly_hours   NUMERIC(5, 2),
    document_id    INTEGER
);

CREATE TABLE employee_bank_accounts (
    id           SERIAL PRIMARY KEY,
    employee_id  INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    bank_name    VARCHAR(120) NOT NULL,
    account_name VARCHAR(120) NOT NULL,
    account_no   VARCHAR(40) NOT NULL,
    routing_no   VARCHAR(40),
    is_primary   BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE documents (
    id               SERIAL PRIMARY KEY,
    employee_id      INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    category         VARCHAR(30) NOT NULL DEFAULT 'other'
        CHECK (category IN ('contract', 'id', 'certificate', 'payslip', 'memo', 'other')),
    title            VARCHAR(200) NOT NULL,
    file_url         TEXT NOT NULL,
    file_type        VARCHAR(80),
    file_size_kb     INT,
    is_confidential  BOOLEAN NOT NULL DEFAULT false,
    expires_at       DATE,
    uploaded_by      INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE employee_contracts
    ADD CONSTRAINT fk_contracts_document
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE SET NULL;

-- -----------------------------------------------------------------------------
-- Leave
-- -----------------------------------------------------------------------------

CREATE TABLE leave_types (
    id                 SERIAL PRIMARY KEY,
    name               VARCHAR(80) NOT NULL,
    paid               BOOLEAN NOT NULL DEFAULT true,
    days_per_year      NUMERIC(5, 1) NOT NULL DEFAULT 0,
    carry_forward      BOOLEAN NOT NULL DEFAULT false,
    requires_approval  BOOLEAN NOT NULL DEFAULT true,
    color_hex          VARCHAR(7) DEFAULT '#378ADD'
);

CREATE TABLE leave_balances (
    id               SERIAL PRIMARY KEY,
    employee_id      INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    leave_type_id    INTEGER NOT NULL REFERENCES leave_types(id) ON DELETE CASCADE,
    year             INT NOT NULL,
    accrued          NUMERIC(5, 1) NOT NULL DEFAULT 0,
    used             NUMERIC(5, 1) NOT NULL DEFAULT 0,
    pending          NUMERIC(5, 1) NOT NULL DEFAULT 0,
    carried_forward  NUMERIC(5, 1) NOT NULL DEFAULT 0,
    UNIQUE (employee_id, leave_type_id, year)
);

CREATE TABLE leave_requests (
    id             SERIAL PRIMARY KEY,
    employee_id    INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    leave_type_id  INTEGER NOT NULL REFERENCES leave_types(id),
    start_date     DATE NOT NULL,
    end_date       DATE NOT NULL,
    days_count     NUMERIC(5, 1) NOT NULL,
    reason         TEXT,
    status         VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
    reviewed_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at    TIMESTAMPTZ,
    notes          TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- Attendance & overtime
-- -----------------------------------------------------------------------------

CREATE TABLE attendance (
    id                   SERIAL PRIMARY KEY,
    employee_id          INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    clock_in             TIMESTAMPTZ NOT NULL,
    clock_out            TIMESTAMPTZ,
    method               VARCHAR(20) NOT NULL DEFAULT 'app'
        CHECK (method IN ('app', 'manual')),
    latitude             NUMERIC(10, 7),
    longitude            NUMERIC(10, 7),
    clock_in_address     TEXT,
    clock_out_address    TEXT,
    break_start          TIMESTAMPTZ,
    break_end            TIMESTAMPTZ,
    actual_hours         NUMERIC(6, 2),
    regular_hours        NUMERIC(6, 2),
    overtime_hours       NUMERIC(6, 2),
    early_in_minutes     SMALLINT,
    late_in_minutes      SMALLINT,
    early_out_minutes    SMALLINT,
    late_out_minutes     SMALLINT,
    shift_assignment_id  INTEGER,
    approved_by          INTEGER REFERENCES users(id) ON DELETE SET NULL,
    approved_at          TIMESTAMPTZ,
    clock_out_type       VARCHAR(30)
        CHECK (clock_out_type IN ('manual', 'auto_midnight_cascade', 'auto_outside', 'auto_stale_sweep')),
    outside_since        TIMESTAMPTZ,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_attendance_employee_clock ON attendance(employee_id, clock_in);

CREATE TABLE overtime_requests (
    id            SERIAL PRIMARY KEY,
    employee_id   INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    request_date  DATE NOT NULL,
    extra_hours   NUMERIC(5, 2) NOT NULL,
    reason        TEXT,
    status        VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved')),
    source        VARCHAR(20) DEFAULT 'manual'
        CHECK (source IN ('manual', 'auto')),
    attendance_id INTEGER REFERENCES attendance(id) ON DELETE SET NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE holidays (
    id              SERIAL PRIMARY KEY,
    branch_id       INTEGER REFERENCES branches(id) ON DELETE CASCADE,
    holiday_date    DATE NOT NULL,
    name            VARCHAR(120) NOT NULL,
    holiday_type    VARCHAR(30) NOT NULL DEFAULT 'national',
    pay_multiplier  NUMERIC(4, 2) NOT NULL DEFAULT 2.0
);

-- -----------------------------------------------------------------------------
-- Shifts & roster
-- -----------------------------------------------------------------------------

CREATE TABLE shift_templates (
    id          SERIAL PRIMARY KEY,
    branch_id   INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    name        VARCHAR(80) NOT NULL,
    start_time  TIME NOT NULL,
    end_time    TIME NOT NULL,
    break_mins  INT NOT NULL DEFAULT 0,
    color_hex   VARCHAR(7) DEFAULT '#378ADD'
);

CREATE TABLE schedules (
    id            SERIAL PRIMARY KEY,
    branch_id     INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    week_start    DATE NOT NULL,
    status        VARCHAR(20) NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'published', 'locked')),
    published_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
    published_at  TIMESTAMPTZ,
    day_footnotes JSONB,
    UNIQUE (branch_id, week_start)
);

CREATE TABLE shift_assignments (
    id                SERIAL PRIMARY KEY,
    schedule_id       INTEGER NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
    employee_id       INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    shift_template_id INTEGER REFERENCES shift_templates(id) ON DELETE SET NULL,
    shift_date        DATE NOT NULL,
    start_time        TIME NOT NULL,
    end_time          TIME NOT NULL,
    break_mins        INT NOT NULL DEFAULT 0,
    notes             TEXT,
    UNIQUE (schedule_id, employee_id, shift_date)
);

ALTER TABLE attendance
    ADD CONSTRAINT fk_attendance_shift
    FOREIGN KEY (shift_assignment_id) REFERENCES shift_assignments(id) ON DELETE SET NULL;

CREATE INDEX idx_shift_assignments_date ON shift_assignments(shift_date);

CREATE TABLE shift_swap_requests (
    id                      SERIAL PRIMARY KEY,
    requester_assignment_id INTEGER NOT NULL REFERENCES shift_assignments(id) ON DELETE CASCADE,
    requester_employee_id   INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    target_employee_id      INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    target_assignment_id    INTEGER REFERENCES shift_assignments(id) ON DELETE SET NULL,
    message                 TEXT,
    created_by_user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status                  VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled')),
    responded_at            TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- Payroll & benefits
-- -----------------------------------------------------------------------------

CREATE TABLE payroll_runs (
    id             SERIAL PRIMARY KEY,
    branch_id      INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    period_start   DATE NOT NULL,
    period_end     DATE NOT NULL,
    pay_date       DATE NOT NULL,
    run_type       VARCHAR(20) NOT NULL DEFAULT 'regular'
        CHECK (run_type IN ('regular', '13th_month')),
    pay_frequency  VARCHAR(20) NOT NULL DEFAULT 'semi_monthly'
        CHECK (pay_frequency IN ('semi_monthly', 'monthly')),
    status         VARCHAR(20) NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'processing', 'partially_paid', 'approved', 'paid', 'cancelled')),
    processed_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
    total_gross    NUMERIC(14, 2),
    total_net      NUMERIC(14, 2),
    processed_at   TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE payslips (
    id                 SERIAL PRIMARY KEY,
    payroll_run_id     INTEGER NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
    employee_id        INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    regular_hours      NUMERIC(8, 2) NOT NULL DEFAULT 0,
    overtime_hours     NUMERIC(8, 2) NOT NULL DEFAULT 0,
    holiday_hours      NUMERIC(8, 2) NOT NULL DEFAULT 0,
    basic_pay          NUMERIC(12, 2) NOT NULL DEFAULT 0,
    overtime_pay       NUMERIC(12, 2) NOT NULL DEFAULT 0,
    holiday_pay        NUMERIC(12, 2) NOT NULL DEFAULT 0,
    tips_amount        NUMERIC(12, 2) NOT NULL DEFAULT 0,
    service_charge     NUMERIC(12, 2) NOT NULL DEFAULT 0,
    gross_pay          NUMERIC(12, 2) NOT NULL DEFAULT 0,
    sss_amount         NUMERIC(12, 2) NOT NULL DEFAULT 0,
    philhealth_amount  NUMERIC(12, 2) NOT NULL DEFAULT 0,
    pagibig_amount     NUMERIC(12, 2) NOT NULL DEFAULT 0,
    tax_amount         NUMERIC(12, 2) NOT NULL DEFAULT 0,
    other_deductions   NUMERIC(12, 2) NOT NULL DEFAULT 0,
    net_pay            NUMERIC(12, 2) NOT NULL DEFAULT 0,
    generated_at       TIMESTAMPTZ,
    payment_status     VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (payment_status IN ('pending', 'ready', 'paid', 'deferred')),
    paid_at            TIMESTAMPTZ,
    UNIQUE (payroll_run_id, employee_id)
);

CREATE TABLE payroll_adjustments (
    id             SERIAL PRIMARY KEY,
    employee_id    INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    payroll_run_id INTEGER REFERENCES payroll_runs(id) ON DELETE SET NULL,
    adj_type       VARCHAR(30) NOT NULL
        CHECK (adj_type IN ('bonus', 'advance', 'loan_repay', 'penalty', 'allowance', 'meal', 'transport')),
    amount         NUMERIC(12, 2) NOT NULL,
    description    TEXT,
    approved_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE payroll_run_deferrals (
    id             SERIAL PRIMARY KEY,
    payroll_run_id INTEGER NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
    employee_id    INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    note           TEXT,
    deferred_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
    deferred_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (payroll_run_id, employee_id)
);

CREATE TABLE employee_benefit_enrollments (
    id           SERIAL PRIMARY KEY,
    employee_id  INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    benefit_code VARCHAR(40) NOT NULL,
    benefit_name VARCHAR(120) NOT NULL,
    amount       NUMERIC(12, 2) NOT NULL DEFAULT 0,
    frequency    VARCHAR(20) NOT NULL DEFAULT 'monthly'
        CHECK (frequency IN ('monthly', 'per_payroll')),
    is_active    BOOLEAN NOT NULL DEFAULT true,
    notes        TEXT
);

CREATE INDEX idx_benefit_enrollments_employee ON employee_benefit_enrollments(employee_id);

-- -----------------------------------------------------------------------------
-- Loans
-- -----------------------------------------------------------------------------

CREATE TABLE employee_loans (
    id                 SERIAL PRIMARY KEY,
    employee_id        INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    loan_type          VARCHAR(20) NOT NULL DEFAULT 'salary'
        CHECK (loan_type IN ('salary', 'cash_advance')),
    principal          NUMERIC(12, 2) NOT NULL,
    balance            NUMERIC(12, 2) NOT NULL,
    term_months        INT,
    repayment_schedule VARCHAR(20) DEFAULT 'semi_monthly'
        CHECK (repayment_schedule IN ('semi_monthly', 'one_month')),
    term_duration      INT,
    monthly_deduction  NUMERIC(12, 2),
    purpose            TEXT,
    status             VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'active', 'approved', 'rejected', 'paid')),
    approved_by        INTEGER REFERENCES users(id) ON DELETE SET NULL,
    approved_at        TIMESTAMPTZ,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE loan_payments (
    id       SERIAL PRIMARY KEY,
    loan_id  INTEGER NOT NULL REFERENCES employee_loans(id) ON DELETE CASCADE,
    amount   NUMERIC(12, 2) NOT NULL,
    paid_on  DATE NOT NULL DEFAULT CURRENT_DATE,
    notes    TEXT
);

-- -----------------------------------------------------------------------------
-- Tips
-- -----------------------------------------------------------------------------

CREATE TABLE tips_pool (
    id          SERIAL PRIMARY KEY,
    branch_id   INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    pool_date   DATE NOT NULL,
    total_tips  NUMERIC(12, 2) NOT NULL DEFAULT 0,
    shift_type  VARCHAR(30) NOT NULL DEFAULT 'all_day',
    status      VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'distributed'))
);

CREATE TABLE tips_distribution (
    id           SERIAL PRIMARY KEY,
    tips_pool_id INTEGER NOT NULL REFERENCES tips_pool(id) ON DELETE CASCADE,
    employee_id  INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    percentage   NUMERIC(6, 2) NOT NULL DEFAULT 0,
    amount       NUMERIC(12, 2) NOT NULL DEFAULT 0
);

-- -----------------------------------------------------------------------------
-- Field work
-- -----------------------------------------------------------------------------

CREATE TABLE field_work_sites (
    id                SERIAL PRIMARY KEY,
    branch_id         INTEGER REFERENCES branches(id) ON DELETE CASCADE,
    name              VARCHAR(120) NOT NULL,
    address           TEXT,
    latitude          NUMERIC(10, 7) NOT NULL,
    longitude         NUMERIC(10, 7) NOT NULL,
    radius_m          INT NOT NULL DEFAULT 100,
    is_active         BOOLEAN NOT NULL DEFAULT true,
    clock_in_eligible BOOLEAN NOT NULL DEFAULT true,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE field_work_checkins (
    id            SERIAL PRIMARY KEY,
    employee_id   INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    site_id       INTEGER REFERENCES field_work_sites(id) ON DELETE SET NULL,
    latitude      NUMERIC(10, 7),
    longitude     NUMERIC(10, 7),
    address       TEXT,
    attendance_id INTEGER REFERENCES attendance(id) ON DELETE SET NULL,
    notes         TEXT,
    checked_in_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- HR content, notifications, compliance
-- -----------------------------------------------------------------------------

CREATE TABLE announcements (
    id          SERIAL PRIMARY KEY,
    branch_id   INTEGER REFERENCES branches(id) ON DELETE CASCADE,
    title       VARCHAR(200) NOT NULL,
    body        TEXT NOT NULL,
    priority    VARCHAR(20) NOT NULL DEFAULT 'normal'
        CHECK (priority IN ('low', 'normal', 'urgent')),
    posted_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
    publish_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at  TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE notifications (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type        VARCHAR(60) NOT NULL,
    title       VARCHAR(200) NOT NULL,
    body        TEXT,
    link        TEXT,
    related_id  INTEGER,
    is_read     BOOLEAN NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);

CREATE TABLE compliance_checklists (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(120) NOT NULL,
    checklist_type  VARCHAR(40) NOT NULL
        CHECK (checklist_type IN ('food_safety', 'labor', 'fire_safety', 'health_permit')),
    frequency       VARCHAR(20) NOT NULL
        CHECK (frequency IN ('daily', 'weekly', 'monthly', 'annual')),
    due_day         INT
);

CREATE TABLE compliance_logs (
    id            SERIAL PRIMARY KEY,
    checklist_id  INTEGER NOT NULL REFERENCES compliance_checklists(id) ON DELETE CASCADE,
    branch_id     INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    completed_by  INTEGER REFERENCES employees(id) ON DELETE SET NULL,
    completed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status        VARCHAR(30) NOT NULL,
    notes         TEXT
);

CREATE TABLE audit_logs (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action      VARCHAR(60) NOT NULL,
    table_name  VARCHAR(80),
    record_id   INTEGER,
    old_data    JSONB,
    new_data    JSONB,
    ip_address  VARCHAR(45),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);
