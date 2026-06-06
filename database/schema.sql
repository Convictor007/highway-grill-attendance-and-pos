-- Highway Grill HRMS — MySQL schema (fresh install)
-- Drops and recreates database highway_grill_hrms and all tables.
-- Roles & demo data: run database/seed.sql after this file.

DROP DATABASE IF EXISTS highway_grill_hrms;

CREATE DATABASE highway_grill_hrms
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE highway_grill_hrms;

SET FOREIGN_KEY_CHECKS = 0;

-- =============================================================================
-- RBAC — roles seeded in seed.sql (admin, hr, employee)
-- =============================================================================

CREATE TABLE roles (
    role_id INT AUTO_INCREMENT PRIMARY KEY,
    role_slug VARCHAR(50) NOT NULL UNIQUE,
    role_name VARCHAR(100) NOT NULL,
    description TEXT,
    role_type ENUM('staff', 'system') NOT NULL DEFAULT 'staff',
    is_system TINYINT(1) NOT NULL DEFAULT 1,
    display_order INT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE permissions (
    permission_id INT AUTO_INCREMENT PRIMARY KEY,
    permission_key VARCHAR(100) NOT NULL UNIQUE,
    permission_name VARCHAR(255) NOT NULL,
    module VARCHAR(50) NOT NULL,
    description TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE role_permissions (
    role_id INT NOT NULL,
    permission_id INT NOT NULL,
    PRIMARY KEY (role_id, permission_id),
    FOREIGN KEY (role_id) REFERENCES roles(role_id) ON DELETE CASCADE,
    FOREIGN KEY (permission_id) REFERENCES permissions(permission_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- =============================================================================
-- CORE / AUTH
-- =============================================================================

CREATE TABLE branches (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    name VARCHAR(100) NOT NULL,
    address TEXT,
    default_latitude DECIMAL(10,7) NULL,
    default_longitude DECIMAL(10,7) NULL,
    phone VARCHAR(20),
    manager_id CHAR(36) NULL,
    timezone VARCHAR(50) DEFAULT 'Asia/Manila',
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE departments (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    branch_id CHAR(36) NOT NULL,
    name VARCHAR(100) NOT NULL,
    head_id CHAR(36) NULL,
    cost_center VARCHAR(50),
    FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE positions (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    department_id CHAR(36) NOT NULL,
    title VARCHAR(100) NOT NULL,
    pay_grade SMALLINT,
    min_hourly DECIMAL(8,2),
    max_hourly DECIMAL(8,2),
    is_tipped TINYINT(1) NOT NULL DEFAULT 0,
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE employees (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    branch_id CHAR(36) NOT NULL,
    department_id CHAR(36) NULL,
    position_id CHAR(36) NULL,
    emp_number VARCHAR(20) NOT NULL UNIQUE,
    first_name VARCHAR(80) NOT NULL,
    last_name VARCHAR(80) NOT NULL,
    date_of_birth DATE,
    gender ENUM('male', 'female', 'other', 'prefer_not'),
    nationality VARCHAR(60),
    national_id VARCHAR(50) UNIQUE,
    phone VARCHAR(20),
    email VARCHAR(255),
    address TEXT,
    hire_date DATE NOT NULL,
    probation_end DATE,
    employment_type ENUM('full_time', 'part_time', 'casual', 'seasonal') NOT NULL DEFAULT 'full_time',
    status ENUM('active', 'on_leave', 'resigned', 'terminated') NOT NULL DEFAULT 'active',
    photo_url TEXT,
    emergency_name VARCHAR(100),
    emergency_phone VARCHAR(20),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (branch_id) REFERENCES branches(id),
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
    FOREIGN KEY (position_id) REFERENCES positions(id) ON DELETE SET NULL
) ENGINE=InnoDB;

ALTER TABLE branches
    ADD CONSTRAINT fk_branches_manager FOREIGN KEY (manager_id) REFERENCES employees(id) ON DELETE SET NULL;

ALTER TABLE departments
    ADD CONSTRAINT fk_departments_head FOREIGN KEY (head_id) REFERENCES employees(id) ON DELETE SET NULL;

CREATE TABLE users (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role_id INT NOT NULL,
    employee_id CHAR(36) NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    last_login_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (role_id) REFERENCES roles(role_id),
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE user_sessions (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    user_id CHAR(36) NOT NULL,
    token_hash CHAR(64) NOT NULL UNIQUE,
    expires_at DATETIME NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE user_permissions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id CHAR(36) NOT NULL,
    permission_id INT NOT NULL,
    branch_id CHAR(36) NULL,
    grant_type ENUM('allow', 'deny') NOT NULL DEFAULT 'allow',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_user_perm (user_id, permission_id, branch_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (permission_id) REFERENCES permissions(permission_id) ON DELETE CASCADE,
    FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- =============================================================================
-- EMPLOYEES (extended)
-- =============================================================================

CREATE TABLE documents (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    employee_id CHAR(36) NULL,
    category ENUM('contract', 'id', 'certificate', 'payslip', 'memo', 'other') NOT NULL,
    title VARCHAR(200) NOT NULL,
    file_url TEXT,
    file_type VARCHAR(20),
    file_size_kb INT,
    is_confidential TINYINT(1) NOT NULL DEFAULT 0,
    expires_at DATE,
    uploaded_by CHAR(36) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE employee_contracts (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    employee_id CHAR(36) NOT NULL,
    contract_type ENUM('permanent', 'fixed_term', 'probation') NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    hourly_rate DECIMAL(8,2),
    weekly_hours DECIMAL(5,2),
    signed_at DATETIME,
    document_id CHAR(36) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE employee_bank_accounts (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    employee_id CHAR(36) NOT NULL,
    bank_name VARCHAR(100) NOT NULL,
    account_name VARCHAR(100) NOT NULL,
    account_no VARCHAR(40) NOT NULL,
    routing_no VARCHAR(20),
    is_primary TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE employee_skills (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    employee_id CHAR(36) NOT NULL,
    skill VARCHAR(100) NOT NULL,
    level ENUM('beginner', 'intermediate', 'expert') NOT NULL DEFAULT 'beginner',
    certified_at DATE,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- =============================================================================
-- SHIFTS & ATTENDANCE
-- =============================================================================

CREATE TABLE shift_templates (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    branch_id CHAR(36) NOT NULL,
    name VARCHAR(80) NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    break_mins SMALLINT NOT NULL DEFAULT 0,
    color_hex CHAR(7),
    FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE schedules (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    branch_id CHAR(36) NOT NULL,
    week_start DATE NOT NULL,
    status ENUM('draft', 'published', 'locked') NOT NULL DEFAULT 'draft',
    published_by CHAR(36) NULL,
    published_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE,
    FOREIGN KEY (published_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE shift_assignments (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    schedule_id CHAR(36) NOT NULL,
    employee_id CHAR(36) NOT NULL,
    shift_template_id CHAR(36) NULL,
    shift_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    break_mins SMALLINT NOT NULL DEFAULT 0,
    notes TEXT,
    FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE CASCADE,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (shift_template_id) REFERENCES shift_templates(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE shift_swap_requests (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    requester_assignment_id CHAR(36) NOT NULL,
    requester_employee_id CHAR(36) NOT NULL,
    target_employee_id CHAR(36) NOT NULL,
    target_assignment_id CHAR(36) NULL,
    status ENUM('pending', 'accepted', 'rejected', 'cancelled') NOT NULL DEFAULT 'pending',
    message TEXT NULL,
    created_by_user_id CHAR(36) NOT NULL,
    responded_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (requester_assignment_id) REFERENCES shift_assignments(id) ON DELETE CASCADE,
    FOREIGN KEY (requester_employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (target_employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (target_assignment_id) REFERENCES shift_assignments(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE notifications (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    user_id CHAR(36) NOT NULL,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(200) NOT NULL,
    body TEXT,
    link VARCHAR(255) NULL,
    related_id CHAR(36) NULL,
    is_read TINYINT(1) NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE attendance (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    employee_id CHAR(36) NOT NULL,
    shift_assignment_id CHAR(36) NULL,
    clock_in DATETIME NOT NULL,
    clock_out DATETIME NULL,
    break_start DATETIME NULL,
    break_end DATETIME NULL,
    actual_hours DECIMAL(5,2) NULL,
    regular_hours DECIMAL(5,2) NULL,
    overtime_hours DECIMAL(5,2) NULL,
    method ENUM('biometric', 'pin', 'manual', 'app') NOT NULL DEFAULT 'app',
    ip_address VARCHAR(45),
    latitude DECIMAL(9,6),
    longitude DECIMAL(9,6),
    clock_in_address VARCHAR(255) NULL,
    clock_out_address VARCHAR(255) NULL,
    clock_out_type VARCHAR(32) NOT NULL DEFAULT 'manual',
    outside_since DATETIME NULL,
    approved_by CHAR(36) NULL,
    approved_at DATETIME NULL,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (shift_assignment_id) REFERENCES shift_assignments(id) ON DELETE SET NULL,
    FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE overtime_requests (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    employee_id CHAR(36) NOT NULL,
    request_date DATE NOT NULL,
    extra_hours DECIMAL(4,2) NOT NULL,
    reason TEXT,
    status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
    source VARCHAR(16) NOT NULL DEFAULT 'manual',
    attendance_id CHAR(36) NULL,
    approved_by CHAR(36) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- =============================================================================
-- PAYROLL
-- =============================================================================

CREATE TABLE payroll_runs (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    branch_id CHAR(36) NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    pay_date DATE NOT NULL,
    status ENUM('draft', 'processing', 'approved', 'paid', 'cancelled') NOT NULL DEFAULT 'draft',
    total_gross DECIMAL(12,2) DEFAULT 0,
    total_net DECIMAL(12,2) DEFAULT 0,
    processed_by CHAR(36) NULL,
    processed_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (branch_id) REFERENCES branches(id),
    FOREIGN KEY (processed_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE payslips (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    payroll_run_id CHAR(36) NOT NULL,
    employee_id CHAR(36) NOT NULL,
    regular_hours DECIMAL(6,2) DEFAULT 0,
    overtime_hours DECIMAL(6,2) DEFAULT 0,
    holiday_hours DECIMAL(6,2) DEFAULT 0,
    basic_pay DECIMAL(10,2) DEFAULT 0,
    overtime_pay DECIMAL(10,2) DEFAULT 0,
    tips_amount DECIMAL(10,2) DEFAULT 0,
    service_charge DECIMAL(10,2) DEFAULT 0,
    gross_pay DECIMAL(10,2) DEFAULT 0,
    tax_amount DECIMAL(10,2) DEFAULT 0,
    sss_amount DECIMAL(10,2) DEFAULT 0,
    philhealth_amount DECIMAL(10,2) DEFAULT 0,
    pagibig_amount DECIMAL(10,2) DEFAULT 0,
    other_deductions DECIMAL(10,2) DEFAULT 0,
    net_pay DECIMAL(10,2) DEFAULT 0,
    generated_at DATETIME,
    document_id CHAR(36) NULL,
    FOREIGN KEY (payroll_run_id) REFERENCES payroll_runs(id) ON DELETE CASCADE,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE payroll_adjustments (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    employee_id CHAR(36) NOT NULL,
    payroll_run_id CHAR(36) NULL,
    adj_type ENUM('bonus', 'advance', 'loan_repay', 'penalty', 'allowance', 'meal', 'transport') NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    description TEXT,
    approved_by CHAR(36) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (payroll_run_id) REFERENCES payroll_runs(id) ON DELETE SET NULL,
    FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE tips_pool (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    branch_id CHAR(36) NOT NULL,
    pool_date DATE NOT NULL,
    total_tips DECIMAL(10,2) NOT NULL,
    shift_type ENUM('breakfast', 'lunch', 'dinner', 'all_day') NOT NULL DEFAULT 'all_day',
    status ENUM('pending', 'distributed') NOT NULL DEFAULT 'pending',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE tips_distribution (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    tips_pool_id CHAR(36) NOT NULL,
    employee_id CHAR(36) NOT NULL,
    percentage DECIMAL(5,2) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    FOREIGN KEY (tips_pool_id) REFERENCES tips_pool(id) ON DELETE CASCADE,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- =============================================================================
-- LEAVE
-- =============================================================================

CREATE TABLE leave_types (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    name VARCHAR(80) NOT NULL,
    paid TINYINT(1) NOT NULL DEFAULT 1,
    days_per_year DECIMAL(5,2) NOT NULL DEFAULT 0,
    carry_forward TINYINT(1) NOT NULL DEFAULT 0,
    max_carry_days DECIMAL(5,2) DEFAULT 0,
    requires_approval TINYINT(1) NOT NULL DEFAULT 1,
    color_hex CHAR(7)
) ENGINE=InnoDB;

CREATE TABLE leave_balances (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    employee_id CHAR(36) NOT NULL,
    leave_type_id CHAR(36) NOT NULL,
    year SMALLINT NOT NULL,
    accrued DECIMAL(6,2) NOT NULL DEFAULT 0,
    used DECIMAL(6,2) NOT NULL DEFAULT 0,
    pending DECIMAL(6,2) NOT NULL DEFAULT 0,
    carried_forward DECIMAL(6,2) NOT NULL DEFAULT 0,
    UNIQUE KEY uq_leave_balance (employee_id, leave_type_id, year),
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (leave_type_id) REFERENCES leave_types(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE leave_requests (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    employee_id CHAR(36) NOT NULL,
    leave_type_id CHAR(36) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    days_count DECIMAL(5,2) NOT NULL,
    reason TEXT,
    status ENUM('pending', 'approved', 'rejected', 'cancelled') NOT NULL DEFAULT 'pending',
    reviewed_by CHAR(36) NULL,
    reviewed_at DATETIME NULL,
    notes TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (leave_type_id) REFERENCES leave_types(id),
    FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE holidays (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    branch_id CHAR(36) NULL,
    holiday_date DATE NOT NULL,
    name VARCHAR(100) NOT NULL,
    holiday_type ENUM('national', 'special_non_working', 'local', 'company') NOT NULL,
    pay_multiplier DECIMAL(4,2) NOT NULL DEFAULT 1.30,
    FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- =============================================================================
-- TRAINING
-- =============================================================================

CREATE TABLE training_programs (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    title VARCHAR(150) NOT NULL,
    description TEXT,
    program_type ENUM('onboarding', 'food_safety', 'service', 'compliance', 'upselling') NOT NULL,
    duration_hrs DECIMAL(5,2),
    passing_score SMALLINT,
    is_mandatory TINYINT(1) NOT NULL DEFAULT 0,
    valid_months SMALLINT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE training_sessions (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    program_id CHAR(36) NOT NULL,
    branch_id CHAR(36) NOT NULL,
    trainer_id CHAR(36) NULL,
    scheduled_at DATETIME NOT NULL,
    location VARCHAR(150),
    max_seats SMALLINT,
    status ENUM('scheduled', 'ongoing', 'completed', 'cancelled') NOT NULL DEFAULT 'scheduled',
    FOREIGN KEY (program_id) REFERENCES training_programs(id) ON DELETE CASCADE,
    FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE,
    FOREIGN KEY (trainer_id) REFERENCES employees(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE training_enrollments (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    session_id CHAR(36) NOT NULL,
    employee_id CHAR(36) NOT NULL,
    status ENUM('enrolled', 'attended', 'passed', 'failed', 'no_show') NOT NULL DEFAULT 'enrolled',
    score SMALLINT,
    completed_at DATETIME,
    expiry_date DATE,
    certificate_id CHAR(36) NULL,
    FOREIGN KEY (session_id) REFERENCES training_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (certificate_id) REFERENCES documents(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- =============================================================================
-- PERFORMANCE
-- =============================================================================

CREATE TABLE appraisal_cycles (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    name VARCHAR(100) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status ENUM('upcoming', 'active', 'closed') NOT NULL DEFAULT 'upcoming'
) ENGINE=InnoDB;

CREATE TABLE appraisals (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    cycle_id CHAR(36) NOT NULL,
    employee_id CHAR(36) NOT NULL,
    reviewer_id CHAR(36) NULL,
    overall_score DECIMAL(4,2),
    status ENUM('pending', 'self_review', 'manager_review', 'completed') NOT NULL DEFAULT 'pending',
    comments TEXT,
    submitted_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cycle_id) REFERENCES appraisal_cycles(id) ON DELETE CASCADE,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (reviewer_id) REFERENCES employees(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE appraisal_criteria (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    appraisal_id CHAR(36) NOT NULL,
    criterion VARCHAR(150) NOT NULL,
    weight DECIMAL(5,2) NOT NULL DEFAULT 1,
    self_score DECIMAL(4,2),
    manager_score DECIMAL(4,2),
    notes TEXT,
    FOREIGN KEY (appraisal_id) REFERENCES appraisals(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE disciplinary_records (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    employee_id CHAR(36) NOT NULL,
    record_type ENUM('verbal_warning', 'written_warning', 'suspension', 'pip', 'termination') NOT NULL,
    incident_date DATE NOT NULL,
    description TEXT,
    issued_by CHAR(36) NULL,
    document_id CHAR(36) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (issued_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- =============================================================================
-- RECRUITMENT
-- =============================================================================

CREATE TABLE job_postings (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    branch_id CHAR(36) NOT NULL,
    position_id CHAR(36) NULL,
    title VARCHAR(150) NOT NULL,
    description TEXT,
    vacancies SMALLINT NOT NULL DEFAULT 1,
    status ENUM('draft', 'open', 'closed', 'filled') NOT NULL DEFAULT 'draft',
    posted_at DATETIME,
    closes_at DATETIME,
    FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE,
    FOREIGN KEY (position_id) REFERENCES positions(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE applicants (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    posting_id CHAR(36) NOT NULL,
    first_name VARCHAR(80) NOT NULL,
    last_name VARCHAR(80) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(20),
    resume_url TEXT,
    source ENUM('website', 'referral', 'walk_in', 'agency', 'linkedin') NOT NULL DEFAULT 'walk_in',
    status ENUM('applied', 'screening', 'interview', 'offer', 'hired', 'rejected') NOT NULL DEFAULT 'applied',
    applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (posting_id) REFERENCES job_postings(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE interviews (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    applicant_id CHAR(36) NOT NULL,
    interviewer_id CHAR(36) NULL,
    scheduled_at DATETIME NOT NULL,
    interview_type ENUM('phone', 'in_person', 'panel', 'practical') NOT NULL DEFAULT 'in_person',
    score SMALLINT,
    recommendation ENUM('hire', 'hold', 'reject'),
    notes TEXT,
    completed_at DATETIME,
    FOREIGN KEY (applicant_id) REFERENCES applicants(id) ON DELETE CASCADE,
    FOREIGN KEY (interviewer_id) REFERENCES employees(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- =============================================================================
-- DOCUMENTS & ANNOUNCEMENTS
-- =============================================================================

CREATE TABLE announcements (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    branch_id CHAR(36) NULL,
    title VARCHAR(200) NOT NULL,
    body TEXT NOT NULL,
    priority ENUM('low', 'normal', 'urgent') NOT NULL DEFAULT 'normal',
    posted_by CHAR(36) NULL,
    publish_at DATETIME,
    expires_at DATETIME,
    FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE,
    FOREIGN KEY (posted_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- =============================================================================
-- COMPLIANCE
-- =============================================================================

CREATE TABLE compliance_checklists (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    name VARCHAR(150) NOT NULL,
    checklist_type ENUM('food_safety', 'labor', 'fire_safety', 'health_permit') NOT NULL,
    frequency ENUM('daily', 'weekly', 'monthly', 'annual') NOT NULL,
    due_day SMALLINT
) ENGINE=InnoDB;

CREATE TABLE compliance_logs (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    checklist_id CHAR(36) NOT NULL,
    branch_id CHAR(36) NOT NULL,
    completed_by CHAR(36) NULL,
    completed_at DATETIME NOT NULL,
    status ENUM('compliant', 'non_compliant', 'needs_action') NOT NULL,
    notes TEXT,
    FOREIGN KEY (checklist_id) REFERENCES compliance_checklists(id) ON DELETE CASCADE,
    FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE,
    FOREIGN KEY (completed_by) REFERENCES employees(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- =============================================================================
-- EMPLOYEE LOANS
-- =============================================================================

CREATE TABLE employee_loans (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    employee_id CHAR(36) NOT NULL,
    loan_type ENUM('salary', 'cash_advance') NOT NULL DEFAULT 'salary',
    principal DECIMAL(10,2) NOT NULL,
    balance DECIMAL(10,2) NOT NULL,
    term_months SMALLINT NOT NULL DEFAULT 6,
    monthly_deduction DECIMAL(10,2) NOT NULL,
    purpose TEXT,
    status ENUM('pending', 'approved', 'active', 'paid', 'rejected', 'cancelled') NOT NULL DEFAULT 'pending',
    approved_by CHAR(36) NULL,
    approved_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE loan_payments (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    loan_id CHAR(36) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    paid_on DATE NOT NULL,
    notes VARCHAR(255),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (loan_id) REFERENCES employee_loans(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- =============================================================================
-- FIELD WORK (GIS check-ins)
-- =============================================================================

CREATE TABLE field_work_sites (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    branch_id CHAR(36) NULL,
    name VARCHAR(150) NOT NULL,
    address TEXT,
    latitude DECIMAL(9,6) NOT NULL,
    longitude DECIMAL(9,6) NOT NULL,
    radius_m INT NOT NULL DEFAULT 150,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE field_work_checkins (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    employee_id CHAR(36) NOT NULL,
    site_id CHAR(36) NULL,
    attendance_id CHAR(36) NULL,
    latitude DECIMAL(9,6) NOT NULL,
    longitude DECIMAL(9,6) NOT NULL,
    address VARCHAR(255) NULL,
    notes VARCHAR(255),
    checked_in_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (site_id) REFERENCES field_work_sites(id) ON DELETE SET NULL,
    FOREIGN KEY (attendance_id) REFERENCES attendance(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE audit_logs (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    user_id CHAR(36) NULL,
    action ENUM('create', 'update', 'delete', 'login', 'logout', 'export') NOT NULL,
    table_name VARCHAR(80),
    record_id CHAR(36),
    old_data JSON,
    new_data JSON,
    ip_address VARCHAR(45),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

SET FOREIGN_KEY_CHECKS = 1;
