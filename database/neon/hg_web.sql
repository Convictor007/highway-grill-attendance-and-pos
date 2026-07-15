\restrict BxfTL2IWFkPPyUfKcOYoXv8gOs26ZOqknZE2qLWDqrUiz1OEFN1uE7d4niqe5Pb
SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;
CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;
SET default_tablespace = '';
SET default_table_access_method = heap;
CREATE TABLE public.announcements (
    id integer NOT NULL,
    branch_id integer,
    title character varying(200) NOT NULL,
    body text NOT NULL,
    priority character varying(20) DEFAULT 'normal'::character varying NOT NULL,
    posted_by integer,
    publish_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT announcements_priority_check CHECK (((priority)::text = ANY ((ARRAY['low'::character varying, 'normal'::character varying, 'urgent'::character varying])::text[])))
);
CREATE SEQUENCE public.announcements_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.announcements_id_seq OWNED BY public.announcements.id;
CREATE TABLE public.attendance (
    id integer NOT NULL,
    employee_id integer NOT NULL,
    clock_in timestamp with time zone NOT NULL,
    clock_out timestamp with time zone,
    method character varying(20) DEFAULT 'app'::character varying NOT NULL,
    latitude numeric(10,7),
    longitude numeric(10,7),
    clock_in_address text,
    clock_out_address text,
    break_start timestamp with time zone,
    break_end timestamp with time zone,
    actual_hours numeric(6,2),
    regular_hours numeric(6,2),
    overtime_hours numeric(6,2),
    shift_assignment_id integer,
    approved_by integer,
    approved_at timestamp with time zone,
    clock_out_type character varying(30),
    outside_since timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    late_in_minutes smallint,
    early_out_minutes smallint,
    late_out_minutes smallint,
    early_in_minutes smallint,
    CONSTRAINT attendance_clock_out_type_check CHECK (((clock_out_type)::text = ANY ((ARRAY['manual'::character varying, 'auto_midnight_cascade'::character varying, 'auto_outside'::character varying])::text[]))),
    CONSTRAINT attendance_method_check CHECK (((method)::text = ANY ((ARRAY['app'::character varying, 'manual'::character varying])::text[])))
);
CREATE TABLE public.attendance_correction_requests (
    id integer NOT NULL,
    employee_id integer NOT NULL,
    attendance_id integer,
    request_type character varying(20) NOT NULL,
    requested_clock_in timestamp with time zone,
    requested_clock_out timestamp with time zone,
    reason text NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    reviewed_by integer,
    reviewed_at timestamp with time zone,
    review_note text,
    resolved_attendance_id integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT attendance_correction_requests_request_type_check CHECK (((request_type)::text = ANY ((ARRAY['missing_in'::character varying, 'missing_out'::character varying, 'wrong_time'::character varying, 'missing_both'::character varying])::text[]))),
    CONSTRAINT attendance_correction_requests_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'approved'::character varying, 'rejected'::character varying, 'cancelled'::character varying])::text[])))
);
CREATE SEQUENCE public.attendance_correction_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.attendance_correction_requests_id_seq OWNED BY public.attendance_correction_requests.id;
CREATE SEQUENCE public.attendance_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.attendance_id_seq OWNED BY public.attendance.id;
CREATE TABLE public.audit_logs (
    id integer NOT NULL,
    user_id integer,
    action character varying(60) NOT NULL,
    table_name character varying(80),
    record_id integer,
    old_data jsonb,
    new_data jsonb,
    ip_address character varying(45),
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE SEQUENCE public.audit_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.audit_logs_id_seq OWNED BY public.audit_logs.id;
CREATE TABLE public.branches (
    id integer NOT NULL,
    name character varying(120) NOT NULL,
    address text,
    phone character varying(40),
    timezone character varying(64) DEFAULT 'Asia/Manila'::character varying NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    manager_id integer,
    default_latitude numeric(10,7),
    default_longitude numeric(10,7),
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE SEQUENCE public.branches_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.branches_id_seq OWNED BY public.branches.id;
CREATE TABLE public.compliance_checklists (
    id integer NOT NULL,
    name character varying(120) NOT NULL,
    checklist_type character varying(40) NOT NULL,
    frequency character varying(20) NOT NULL,
    due_day integer,
    CONSTRAINT compliance_checklists_checklist_type_check CHECK (((checklist_type)::text = ANY ((ARRAY['food_safety'::character varying, 'labor'::character varying, 'fire_safety'::character varying, 'health_permit'::character varying])::text[]))),
    CONSTRAINT compliance_checklists_frequency_check CHECK (((frequency)::text = ANY ((ARRAY['daily'::character varying, 'weekly'::character varying, 'monthly'::character varying, 'annual'::character varying])::text[])))
);
CREATE SEQUENCE public.compliance_checklists_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.compliance_checklists_id_seq OWNED BY public.compliance_checklists.id;
CREATE TABLE public.compliance_logs (
    id integer NOT NULL,
    checklist_id integer NOT NULL,
    branch_id integer NOT NULL,
    completed_by integer,
    completed_at timestamp with time zone DEFAULT now() NOT NULL,
    status character varying(30) NOT NULL,
    notes text
);
CREATE SEQUENCE public.compliance_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.compliance_logs_id_seq OWNED BY public.compliance_logs.id;
CREATE TABLE public.departments (
    id integer NOT NULL,
    branch_id integer NOT NULL,
    name character varying(120) NOT NULL,
    cost_center character varying(40),
    head_id integer
);
CREATE SEQUENCE public.departments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.departments_id_seq OWNED BY public.departments.id;
CREATE TABLE public.documents (
    id integer NOT NULL,
    employee_id integer NOT NULL,
    category character varying(30) DEFAULT 'other'::character varying NOT NULL,
    title character varying(200) NOT NULL,
    file_url text NOT NULL,
    file_type character varying(80),
    file_size_kb integer,
    is_confidential boolean DEFAULT false NOT NULL,
    expires_at date,
    uploaded_by integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT documents_category_check CHECK (((category)::text = ANY ((ARRAY['contract'::character varying, 'id'::character varying, 'certificate'::character varying, 'payslip'::character varying, 'memo'::character varying, 'other'::character varying])::text[])))
);
CREATE SEQUENCE public.documents_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.documents_id_seq OWNED BY public.documents.id;
CREATE TABLE public.employee_bank_accounts (
    id integer NOT NULL,
    employee_id integer NOT NULL,
    bank_name character varying(120) NOT NULL,
    account_name character varying(120) NOT NULL,
    account_no character varying(40) NOT NULL,
    routing_no character varying(40),
    is_primary boolean DEFAULT false NOT NULL
);
CREATE SEQUENCE public.employee_bank_accounts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.employee_bank_accounts_id_seq OWNED BY public.employee_bank_accounts.id;
CREATE TABLE public.employee_benefit_enrollments (
    id integer NOT NULL,
    employee_id integer NOT NULL,
    benefit_code character varying(40) NOT NULL,
    benefit_name character varying(120) NOT NULL,
    amount numeric(12,2) DEFAULT 0 NOT NULL,
    frequency character varying(20) DEFAULT 'monthly'::character varying NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    notes text,
    CONSTRAINT employee_benefit_enrollments_frequency_check CHECK (((frequency)::text = ANY ((ARRAY['monthly'::character varying, 'per_payroll'::character varying])::text[])))
);
CREATE SEQUENCE public.employee_benefit_enrollments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.employee_benefit_enrollments_id_seq OWNED BY public.employee_benefit_enrollments.id;
CREATE TABLE public.employee_contracts (
    id integer NOT NULL,
    employee_id integer NOT NULL,
    contract_type character varying(40) DEFAULT 'permanent'::character varying NOT NULL,
    start_date date NOT NULL,
    end_date date,
    hourly_rate numeric(10,2),
    weekly_hours numeric(5,2),
    document_id integer
);
CREATE SEQUENCE public.employee_contracts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.employee_contracts_id_seq OWNED BY public.employee_contracts.id;
CREATE TABLE public.employee_government_profiles (
    employee_id integer NOT NULL,
    sss_number character varying(20),
    philhealth_number character varying(20),
    pagibig_number character varying(20),
    tin character varying(20),
    sss_enrolled boolean DEFAULT false NOT NULL,
    philhealth_enrolled boolean DEFAULT false NOT NULL,
    pagibig_enrolled boolean DEFAULT false NOT NULL,
    notes text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    sss_deduction_mode character varying(10) DEFAULT 'manual'::character varying NOT NULL,
    sss_monthly_amount numeric(12,2),
    philhealth_deduction_mode character varying(10) DEFAULT 'manual'::character varying NOT NULL,
    philhealth_monthly_amount numeric(12,2),
    pagibig_deduction_mode character varying(10) DEFAULT 'manual'::character varying NOT NULL,
    pagibig_monthly_amount numeric(12,2),
    tax_deduction_mode character varying(10) DEFAULT 'manual'::character varying NOT NULL,
    tax_monthly_amount numeric(12,2),
    tax_enrolled boolean DEFAULT false NOT NULL
);
CREATE TABLE public.employee_loans (
    id integer NOT NULL,
    employee_id integer NOT NULL,
    loan_type character varying(20) DEFAULT 'salary'::character varying NOT NULL,
    principal numeric(12,2) NOT NULL,
    balance numeric(12,2) NOT NULL,
    term_months integer,
    repayment_schedule character varying(20) DEFAULT 'semi_monthly'::character varying,
    term_duration integer,
    monthly_deduction numeric(12,2),
    purpose text,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    approved_by integer,
    approved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT employee_loans_loan_type_check CHECK (((loan_type)::text = ANY ((ARRAY['salary'::character varying, 'cash_advance'::character varying])::text[]))),
    CONSTRAINT employee_loans_repayment_schedule_check CHECK (((repayment_schedule)::text = ANY ((ARRAY['semi_monthly'::character varying, 'one_month'::character varying])::text[]))),
    CONSTRAINT employee_loans_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'active'::character varying, 'approved'::character varying, 'rejected'::character varying, 'paid'::character varying])::text[])))
);
CREATE SEQUENCE public.employee_loans_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.employee_loans_id_seq OWNED BY public.employee_loans.id;
CREATE TABLE public.employees (
    id integer NOT NULL,
    branch_id integer NOT NULL,
    department_id integer,
    position_id integer,
    emp_number character varying(20) NOT NULL,
    first_name character varying(80) NOT NULL,
    last_name character varying(80) NOT NULL,
    email character varying(255),
    phone character varying(40),
    hire_date date DEFAULT CURRENT_DATE NOT NULL,
    employment_type character varying(20) DEFAULT 'full_time'::character varying NOT NULL,
    pay_basis character varying(10) DEFAULT 'hourly'::character varying NOT NULL,
    pay_rate numeric(10,2),
    is_stay_in boolean DEFAULT false NOT NULL,
    housing_deduction numeric(10,2) DEFAULT 0 NOT NULL,
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    date_of_birth date,
    gender character varying(20),
    nationality character varying(80),
    national_id character varying(40),
    address text,
    emergency_name character varying(120),
    emergency_phone character varying(40),
    photo_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    worker_class character varying(20) DEFAULT 'regular'::character varying NOT NULL,
    CONSTRAINT employees_employment_type_check CHECK (((employment_type)::text = ANY ((ARRAY['full_time'::character varying, 'part_time'::character varying, 'casual'::character varying, 'seasonal'::character varying])::text[]))),
    CONSTRAINT employees_gender_check CHECK (((gender)::text = ANY ((ARRAY['male'::character varying, 'female'::character varying, 'other'::character varying, 'prefer_not'::character varying])::text[]))),
    CONSTRAINT employees_pay_basis_check CHECK (((pay_basis)::text = ANY ((ARRAY['hourly'::character varying, 'daily'::character varying])::text[]))),
    CONSTRAINT employees_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'pending'::character varying, 'terminated'::character varying, 'on_leave'::character varying])::text[]))),
    CONSTRAINT employees_worker_class_check CHECK (((worker_class)::text = ANY ((ARRAY['regular'::character varying, 'on_call'::character varying])::text[])))
);
CREATE SEQUENCE public.employees_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.employees_id_seq OWNED BY public.employees.id;
CREATE TABLE public.field_work_checkins (
    id integer NOT NULL,
    employee_id integer NOT NULL,
    site_id integer,
    latitude numeric(10,7),
    longitude numeric(10,7),
    address text,
    attendance_id integer,
    notes text,
    checked_in_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE SEQUENCE public.field_work_checkins_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.field_work_checkins_id_seq OWNED BY public.field_work_checkins.id;
CREATE TABLE public.field_work_sites (
    id integer NOT NULL,
    branch_id integer,
    name character varying(120) NOT NULL,
    address text,
    latitude numeric(10,7) NOT NULL,
    longitude numeric(10,7) NOT NULL,
    radius_m integer DEFAULT 100 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    clock_in_eligible boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE SEQUENCE public.field_work_sites_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.field_work_sites_id_seq OWNED BY public.field_work_sites.id;
CREATE TABLE public.holidays (
    id integer NOT NULL,
    branch_id integer,
    holiday_date date NOT NULL,
    name character varying(120) NOT NULL,
    holiday_type character varying(30) DEFAULT 'national'::character varying NOT NULL,
    pay_multiplier numeric(4,2) DEFAULT 2.0 NOT NULL
);
CREATE SEQUENCE public.holidays_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.holidays_id_seq OWNED BY public.holidays.id;
CREATE TABLE public.leave_balances (
    id integer NOT NULL,
    employee_id integer NOT NULL,
    leave_type_id integer NOT NULL,
    year integer NOT NULL,
    accrued numeric(5,1) DEFAULT 0 NOT NULL,
    used numeric(5,1) DEFAULT 0 NOT NULL,
    pending numeric(5,1) DEFAULT 0 NOT NULL,
    carried_forward numeric(5,1) DEFAULT 0 NOT NULL
);
CREATE SEQUENCE public.leave_balances_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.leave_balances_id_seq OWNED BY public.leave_balances.id;
CREATE TABLE public.leave_requests (
    id integer NOT NULL,
    employee_id integer NOT NULL,
    leave_type_id integer NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    days_count numeric(5,1) NOT NULL,
    reason text,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    reviewed_by integer,
    reviewed_at timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT leave_requests_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'approved'::character varying, 'rejected'::character varying, 'cancelled'::character varying])::text[])))
);
CREATE SEQUENCE public.leave_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.leave_requests_id_seq OWNED BY public.leave_requests.id;
CREATE TABLE public.leave_types (
    id integer NOT NULL,
    name character varying(80) NOT NULL,
    paid boolean DEFAULT true NOT NULL,
    days_per_year numeric(5,1) DEFAULT 0 NOT NULL,
    carry_forward boolean DEFAULT false NOT NULL,
    requires_approval boolean DEFAULT true NOT NULL,
    color_hex character varying(7) DEFAULT '#378ADD'::character varying
);
CREATE SEQUENCE public.leave_types_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.leave_types_id_seq OWNED BY public.leave_types.id;
CREATE TABLE public.loan_payments (
    id integer NOT NULL,
    loan_id integer NOT NULL,
    amount numeric(12,2) NOT NULL,
    paid_on date DEFAULT CURRENT_DATE NOT NULL,
    notes text
);
CREATE SEQUENCE public.loan_payments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.loan_payments_id_seq OWNED BY public.loan_payments.id;
CREATE TABLE public.notifications (
    id integer NOT NULL,
    user_id integer NOT NULL,
    type character varying(60) NOT NULL,
    title character varying(200) NOT NULL,
    body text,
    link text,
    related_id integer,
    is_read boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE SEQUENCE public.notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.notifications_id_seq OWNED BY public.notifications.id;
CREATE TABLE public.overtime_requests (
    id integer NOT NULL,
    employee_id integer NOT NULL,
    request_date date NOT NULL,
    extra_hours numeric(5,2) NOT NULL,
    reason text,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    source character varying(20) DEFAULT 'manual'::character varying,
    attendance_id integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT overtime_requests_source_check CHECK (((source)::text = ANY ((ARRAY['manual'::character varying, 'auto'::character varying])::text[]))),
    CONSTRAINT overtime_requests_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'approved'::character varying])::text[])))
);
CREATE SEQUENCE public.overtime_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.overtime_requests_id_seq OWNED BY public.overtime_requests.id;
CREATE TABLE public.payroll_adjustments (
    id integer NOT NULL,
    employee_id integer NOT NULL,
    payroll_run_id integer,
    adj_type character varying(30) NOT NULL,
    amount numeric(12,2) NOT NULL,
    description text,
    approved_by integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT payroll_adjustments_adj_type_check CHECK (((adj_type)::text = ANY ((ARRAY['bonus'::character varying, 'advance'::character varying, 'loan_repay'::character varying, 'penalty'::character varying, 'allowance'::character varying, 'meal'::character varying, 'transport'::character varying])::text[])))
);
CREATE SEQUENCE public.payroll_adjustments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.payroll_adjustments_id_seq OWNED BY public.payroll_adjustments.id;
CREATE TABLE public.payroll_run_deferrals (
    id integer NOT NULL,
    payroll_run_id integer NOT NULL,
    employee_id integer NOT NULL,
    note text,
    deferred_by integer,
    deferred_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE SEQUENCE public.payroll_run_deferrals_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.payroll_run_deferrals_id_seq OWNED BY public.payroll_run_deferrals.id;
CREATE TABLE public.payroll_runs (
    id integer NOT NULL,
    branch_id integer NOT NULL,
    period_start date NOT NULL,
    period_end date NOT NULL,
    pay_date date NOT NULL,
    run_type character varying(20) DEFAULT 'regular'::character varying NOT NULL,
    pay_frequency character varying(20) DEFAULT 'semi_monthly'::character varying NOT NULL,
    status character varying(20) DEFAULT 'draft'::character varying NOT NULL,
    processed_by integer,
    total_gross numeric(14,2),
    total_net numeric(14,2),
    processed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT payroll_runs_pay_frequency_check CHECK (((pay_frequency)::text = ANY ((ARRAY['semi_monthly'::character varying, 'monthly'::character varying])::text[]))),
    CONSTRAINT payroll_runs_run_type_check CHECK (((run_type)::text = ANY ((ARRAY['regular'::character varying, '13th_month'::character varying])::text[]))),
    CONSTRAINT payroll_runs_status_check CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'processing'::character varying, 'partially_paid'::character varying, 'approved'::character varying, 'paid'::character varying, 'cancelled'::character varying])::text[])))
);
CREATE SEQUENCE public.payroll_runs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.payroll_runs_id_seq OWNED BY public.payroll_runs.id;
CREATE TABLE public.payslips (
    id integer NOT NULL,
    payroll_run_id integer NOT NULL,
    employee_id integer NOT NULL,
    regular_hours numeric(8,2) DEFAULT 0 NOT NULL,
    overtime_hours numeric(8,2) DEFAULT 0 NOT NULL,
    holiday_hours numeric(8,2) DEFAULT 0 NOT NULL,
    basic_pay numeric(12,2) DEFAULT 0 NOT NULL,
    overtime_pay numeric(12,2) DEFAULT 0 NOT NULL,
    holiday_pay numeric(12,2) DEFAULT 0 NOT NULL,
    tips_amount numeric(12,2) DEFAULT 0 NOT NULL,
    service_charge numeric(12,2) DEFAULT 0 NOT NULL,
    gross_pay numeric(12,2) DEFAULT 0 NOT NULL,
    sss_amount numeric(12,2) DEFAULT 0 NOT NULL,
    philhealth_amount numeric(12,2) DEFAULT 0 NOT NULL,
    pagibig_amount numeric(12,2) DEFAULT 0 NOT NULL,
    tax_amount numeric(12,2) DEFAULT 0 NOT NULL,
    other_deductions numeric(12,2) DEFAULT 0 NOT NULL,
    net_pay numeric(12,2) DEFAULT 0 NOT NULL,
    generated_at timestamp with time zone,
    payment_status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    paid_at timestamp with time zone,
    CONSTRAINT payslips_payment_status_check CHECK (((payment_status)::text = ANY ((ARRAY['pending'::character varying, 'ready'::character varying, 'emailed'::character varying, 'paid'::character varying, 'deferred'::character varying])::text[])))
);
CREATE SEQUENCE public.payslips_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.payslips_id_seq OWNED BY public.payslips.id;
CREATE TABLE public.permissions (
    permission_id integer NOT NULL,
    permission_key character varying(80) NOT NULL,
    permission_name character varying(120) NOT NULL,
    module character varying(40) NOT NULL,
    description text
);
CREATE SEQUENCE public.permissions_permission_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.permissions_permission_id_seq OWNED BY public.permissions.permission_id;
CREATE TABLE public.positions (
    id integer NOT NULL,
    department_id integer NOT NULL,
    title character varying(120) NOT NULL,
    pay_grade character varying(20),
    min_hourly numeric(10,2),
    max_hourly numeric(10,2),
    is_tipped boolean DEFAULT false NOT NULL
);
CREATE SEQUENCE public.positions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.positions_id_seq OWNED BY public.positions.id;
CREATE TABLE public.role_permissions (
    role_id integer NOT NULL,
    permission_id integer NOT NULL
);
CREATE TABLE public.roles (
    role_id integer NOT NULL,
    role_slug character varying(40) NOT NULL,
    role_name character varying(80) NOT NULL,
    description text,
    role_type character varying(20) DEFAULT 'staff'::character varying NOT NULL,
    is_system boolean DEFAULT false NOT NULL,
    display_order integer DEFAULT 0 NOT NULL,
    CONSTRAINT roles_role_type_check CHECK (((role_type)::text = ANY ((ARRAY['staff'::character varying, 'customer'::character varying, 'system'::character varying])::text[])))
);
CREATE SEQUENCE public.roles_role_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.roles_role_id_seq OWNED BY public.roles.role_id;
CREATE TABLE public.schedules (
    id integer NOT NULL,
    branch_id integer NOT NULL,
    week_start date NOT NULL,
    status character varying(20) DEFAULT 'draft'::character varying NOT NULL,
    published_by integer,
    published_at timestamp with time zone,
    day_footnotes jsonb,
    CONSTRAINT schedules_status_check CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'published'::character varying, 'locked'::character varying])::text[])))
);
CREATE SEQUENCE public.schedules_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.schedules_id_seq OWNED BY public.schedules.id;
CREATE TABLE public.shift_assignments (
    id integer NOT NULL,
    schedule_id integer NOT NULL,
    employee_id integer NOT NULL,
    shift_template_id integer,
    shift_date date NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    break_mins integer DEFAULT 0 NOT NULL,
    notes text
);
CREATE SEQUENCE public.shift_assignments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.shift_assignments_id_seq OWNED BY public.shift_assignments.id;
CREATE TABLE public.shift_swap_requests (
    id integer NOT NULL,
    requester_assignment_id integer NOT NULL,
    requester_employee_id integer NOT NULL,
    target_employee_id integer NOT NULL,
    target_assignment_id integer,
    message text,
    created_by_user_id integer NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    responded_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT shift_swap_requests_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'accepted'::character varying, 'rejected'::character varying, 'cancelled'::character varying])::text[])))
);
CREATE SEQUENCE public.shift_swap_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.shift_swap_requests_id_seq OWNED BY public.shift_swap_requests.id;
CREATE TABLE public.shift_templates (
    id integer NOT NULL,
    branch_id integer NOT NULL,
    name character varying(80) NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    break_mins integer DEFAULT 0 NOT NULL,
    color_hex character varying(7) DEFAULT '#378ADD'::character varying
);
CREATE SEQUENCE public.shift_templates_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.shift_templates_id_seq OWNED BY public.shift_templates.id;
CREATE TABLE public.tips_distribution (
    id integer NOT NULL,
    tips_pool_id integer NOT NULL,
    employee_id integer NOT NULL,
    percentage numeric(6,2) DEFAULT 0 NOT NULL,
    amount numeric(12,2) DEFAULT 0 NOT NULL
);
CREATE SEQUENCE public.tips_distribution_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.tips_distribution_id_seq OWNED BY public.tips_distribution.id;
CREATE TABLE public.tips_pool (
    id integer NOT NULL,
    branch_id integer NOT NULL,
    pool_date date NOT NULL,
    total_tips numeric(12,2) DEFAULT 0 NOT NULL,
    shift_type character varying(30) DEFAULT 'all_day'::character varying NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    CONSTRAINT tips_pool_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'distributed'::character varying])::text[])))
);
CREATE SEQUENCE public.tips_pool_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.tips_pool_id_seq OWNED BY public.tips_pool.id;
CREATE TABLE public.user_permissions (
    user_id integer NOT NULL,
    permission_id integer NOT NULL,
    grant_type character varying(10) DEFAULT 'grant'::character varying NOT NULL,
    CONSTRAINT user_permissions_grant_type_check CHECK (((grant_type)::text = ANY ((ARRAY['grant'::character varying, 'deny'::character varying])::text[])))
);
CREATE TABLE public.user_sessions (
    id integer NOT NULL,
    user_id integer NOT NULL,
    token_hash character varying(64) NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE SEQUENCE public.user_sessions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.user_sessions_id_seq OWNED BY public.user_sessions.id;
CREATE TABLE public.users (
    id integer NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    role_id integer NOT NULL,
    employee_id integer,
    is_active boolean DEFAULT true NOT NULL,
    account_status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    activated_at timestamp with time zone,
    activated_by integer,
    approved_at timestamp with time zone,
    approved_by integer,
    last_login_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT users_account_status_check CHECK (((account_status)::text = ANY ((ARRAY['awaiting_hr'::character varying, 'pending'::character varying, 'active'::character varying, 'rejected'::character varying])::text[])))
);
CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;
ALTER TABLE ONLY public.announcements ALTER COLUMN id SET DEFAULT nextval('public.announcements_id_seq'::regclass);
ALTER TABLE ONLY public.attendance ALTER COLUMN id SET DEFAULT nextval('public.attendance_id_seq'::regclass);
ALTER TABLE ONLY public.attendance_correction_requests ALTER COLUMN id SET DEFAULT nextval('public.attendance_correction_requests_id_seq'::regclass);
ALTER TABLE ONLY public.audit_logs ALTER COLUMN id SET DEFAULT nextval('public.audit_logs_id_seq'::regclass);
ALTER TABLE ONLY public.branches ALTER COLUMN id SET DEFAULT nextval('public.branches_id_seq'::regclass);
ALTER TABLE ONLY public.compliance_checklists ALTER COLUMN id SET DEFAULT nextval('public.compliance_checklists_id_seq'::regclass);
ALTER TABLE ONLY public.compliance_logs ALTER COLUMN id SET DEFAULT nextval('public.compliance_logs_id_seq'::regclass);
ALTER TABLE ONLY public.departments ALTER COLUMN id SET DEFAULT nextval('public.departments_id_seq'::regclass);
ALTER TABLE ONLY public.documents ALTER COLUMN id SET DEFAULT nextval('public.documents_id_seq'::regclass);
ALTER TABLE ONLY public.employee_bank_accounts ALTER COLUMN id SET DEFAULT nextval('public.employee_bank_accounts_id_seq'::regclass);
ALTER TABLE ONLY public.employee_benefit_enrollments ALTER COLUMN id SET DEFAULT nextval('public.employee_benefit_enrollments_id_seq'::regclass);
ALTER TABLE ONLY public.employee_contracts ALTER COLUMN id SET DEFAULT nextval('public.employee_contracts_id_seq'::regclass);
ALTER TABLE ONLY public.employee_loans ALTER COLUMN id SET DEFAULT nextval('public.employee_loans_id_seq'::regclass);
ALTER TABLE ONLY public.employees ALTER COLUMN id SET DEFAULT nextval('public.employees_id_seq'::regclass);
ALTER TABLE ONLY public.field_work_checkins ALTER COLUMN id SET DEFAULT nextval('public.field_work_checkins_id_seq'::regclass);
ALTER TABLE ONLY public.field_work_sites ALTER COLUMN id SET DEFAULT nextval('public.field_work_sites_id_seq'::regclass);
ALTER TABLE ONLY public.holidays ALTER COLUMN id SET DEFAULT nextval('public.holidays_id_seq'::regclass);
ALTER TABLE ONLY public.leave_balances ALTER COLUMN id SET DEFAULT nextval('public.leave_balances_id_seq'::regclass);
ALTER TABLE ONLY public.leave_requests ALTER COLUMN id SET DEFAULT nextval('public.leave_requests_id_seq'::regclass);
ALTER TABLE ONLY public.leave_types ALTER COLUMN id SET DEFAULT nextval('public.leave_types_id_seq'::regclass);
ALTER TABLE ONLY public.loan_payments ALTER COLUMN id SET DEFAULT nextval('public.loan_payments_id_seq'::regclass);
ALTER TABLE ONLY public.notifications ALTER COLUMN id SET DEFAULT nextval('public.notifications_id_seq'::regclass);
ALTER TABLE ONLY public.overtime_requests ALTER COLUMN id SET DEFAULT nextval('public.overtime_requests_id_seq'::regclass);
ALTER TABLE ONLY public.payroll_adjustments ALTER COLUMN id SET DEFAULT nextval('public.payroll_adjustments_id_seq'::regclass);
ALTER TABLE ONLY public.payroll_run_deferrals ALTER COLUMN id SET DEFAULT nextval('public.payroll_run_deferrals_id_seq'::regclass);
ALTER TABLE ONLY public.payroll_runs ALTER COLUMN id SET DEFAULT nextval('public.payroll_runs_id_seq'::regclass);
ALTER TABLE ONLY public.payslips ALTER COLUMN id SET DEFAULT nextval('public.payslips_id_seq'::regclass);
ALTER TABLE ONLY public.permissions ALTER COLUMN permission_id SET DEFAULT nextval('public.permissions_permission_id_seq'::regclass);
ALTER TABLE ONLY public.positions ALTER COLUMN id SET DEFAULT nextval('public.positions_id_seq'::regclass);
ALTER TABLE ONLY public.roles ALTER COLUMN role_id SET DEFAULT nextval('public.roles_role_id_seq'::regclass);
ALTER TABLE ONLY public.schedules ALTER COLUMN id SET DEFAULT nextval('public.schedules_id_seq'::regclass);
ALTER TABLE ONLY public.shift_assignments ALTER COLUMN id SET DEFAULT nextval('public.shift_assignments_id_seq'::regclass);
ALTER TABLE ONLY public.shift_swap_requests ALTER COLUMN id SET DEFAULT nextval('public.shift_swap_requests_id_seq'::regclass);
ALTER TABLE ONLY public.shift_templates ALTER COLUMN id SET DEFAULT nextval('public.shift_templates_id_seq'::regclass);
ALTER TABLE ONLY public.tips_distribution ALTER COLUMN id SET DEFAULT nextval('public.tips_distribution_id_seq'::regclass);
ALTER TABLE ONLY public.tips_pool ALTER COLUMN id SET DEFAULT nextval('public.tips_pool_id_seq'::regclass);
ALTER TABLE ONLY public.user_sessions ALTER COLUMN id SET DEFAULT nextval('public.user_sessions_id_seq'::regclass);
ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);
COPY public.announcements (id, branch_id, title, body, priority, posted_by, publish_at, expires_at, created_at) FROM stdin;
2	1	sadwdddd	dsadw	normal	2	2026-06-29 17:13:09.96+00	\N	2026-06-29 17:13:09.961878+00
\.
COPY public.attendance (id, employee_id, clock_in, clock_out, method, latitude, longitude, clock_in_address, clock_out_address, break_start, break_end, actual_hours, regular_hours, overtime_hours, shift_assignment_id, approved_by, approved_at, clock_out_type, outside_since, created_at, late_in_minutes, early_out_minutes, late_out_minutes, early_in_minutes) FROM stdin;
39	2	2026-06-01 23:58:00+00	2026-06-02 11:00:00+00	app	15.1458000	120.5906000	Highway Grill, MacArthur Highway, Pampanga	Highway Grill, MacArthur Highway, Pampanga	2026-06-02 04:00:00+00	2026-06-02 05:00:00+00	10.03	9.00	1.03	\N	\N	\N	manual	\N	2026-06-01 23:58:00+00	\N	\N	\N	\N
16	4	2026-06-02 00:17:00+00	2026-06-02 10:30:00+00	app	15.1458000	120.5906000	Highway Grill, MacArthur Highway, Pampanga	Highway Grill, MacArthur Highway, Pampanga	2026-06-02 04:00:00+00	2026-06-02 05:00:00+00	9.22	9.00	0.22	\N	\N	\N	manual	\N	2026-06-02 00:17:00+00	\N	\N	\N	\N
17	4	2026-06-03 00:24:00+00	2026-06-03 09:00:00+00	app	15.1458000	120.5906000	Highway Grill, MacArthur Highway, Pampanga	Highway Grill, MacArthur Highway, Pampanga	2026-06-03 04:00:00+00	2026-06-03 05:00:00+00	7.60	7.60	0.00	\N	\N	\N	manual	\N	2026-06-03 00:24:00+00	\N	\N	\N	\N
18	4	2026-06-04 00:09:00+00	2026-06-04 09:00:00+00	app	15.1458000	120.5906000	Highway Grill, MacArthur Highway, Pampanga	Highway Grill, MacArthur Highway, Pampanga	2026-06-04 04:00:00+00	2026-06-04 05:00:00+00	7.85	7.85	0.00	\N	\N	\N	manual	\N	2026-06-04 00:09:00+00	\N	\N	\N	\N
19	4	2026-06-05 00:23:00+00	2026-06-05 10:30:00+00	app	15.1458000	120.5906000	Highway Grill, MacArthur Highway, Pampanga	Highway Grill, MacArthur Highway, Pampanga	2026-06-05 04:00:00+00	2026-06-05 05:00:00+00	9.12	9.00	0.12	\N	\N	\N	manual	\N	2026-06-05 00:23:00+00	\N	\N	\N	\N
20	4	2026-06-06 00:01:00+00	2026-06-06 09:00:00+00	app	15.1458000	120.5906000	Highway Grill, MacArthur Highway, Pampanga	Highway Grill, MacArthur Highway, Pampanga	2026-06-06 04:00:00+00	2026-06-06 05:00:00+00	7.98	7.98	0.00	\N	\N	\N	manual	\N	2026-06-06 00:01:00+00	\N	\N	\N	\N
21	4	2026-06-08 00:03:00+00	2026-06-08 12:00:00+00	app	15.1458000	120.5906000	Highway Grill, MacArthur Highway, Pampanga	Highway Grill, MacArthur Highway, Pampanga	2026-06-08 04:00:00+00	2026-06-08 05:00:00+00	10.95	9.00	1.95	\N	\N	\N	manual	\N	2026-06-08 00:03:00+00	\N	\N	\N	\N
22	4	2026-06-09 00:20:00+00	2026-06-09 09:00:00+00	app	15.1458000	120.5906000	Highway Grill, MacArthur Highway, Pampanga	Highway Grill, MacArthur Highway, Pampanga	2026-06-09 04:00:00+00	2026-06-09 05:00:00+00	7.67	7.67	0.00	\N	\N	\N	manual	\N	2026-06-09 00:20:00+00	\N	\N	\N	\N
23	4	2026-06-09 23:57:00+00	2026-06-10 09:00:00+00	app	15.1458000	120.5906000	Highway Grill, MacArthur Highway, Pampanga	Highway Grill, MacArthur Highway, Pampanga	2026-06-10 04:00:00+00	2026-06-10 05:00:00+00	8.05	8.05	0.00	\N	\N	\N	manual	\N	2026-06-09 23:57:00+00	\N	\N	\N	\N
24	4	2026-06-10 23:57:00+00	2026-06-11 09:00:00+00	app	15.1458000	120.5906000	Highway Grill, MacArthur Highway, Pampanga	Highway Grill, MacArthur Highway, Pampanga	2026-06-11 04:00:00+00	2026-06-11 05:00:00+00	8.05	8.05	0.00	\N	\N	\N	manual	\N	2026-06-10 23:57:00+00	\N	\N	\N	\N
25	4	2026-06-12 00:14:00+00	2026-06-12 10:30:00+00	app	15.1458000	120.5906000	Highway Grill, MacArthur Highway, Pampanga	Highway Grill, MacArthur Highway, Pampanga	2026-06-12 04:00:00+00	2026-06-12 05:00:00+00	9.27	9.00	0.27	\N	\N	\N	manual	\N	2026-06-12 00:14:00+00	\N	\N	\N	\N
26	4	2026-06-13 00:05:00+00	2026-06-13 09:00:00+00	app	15.1458000	120.5906000	Highway Grill, MacArthur Highway, Pampanga	Highway Grill, MacArthur Highway, Pampanga	2026-06-13 04:00:00+00	2026-06-13 05:00:00+00	7.92	7.92	0.00	\N	\N	\N	manual	\N	2026-06-13 00:05:00+00	\N	\N	\N	\N
27	4	2026-06-14 23:56:00+00	2026-06-15 09:00:00+00	app	15.1458000	120.5906000	Highway Grill, MacArthur Highway, Pampanga	Highway Grill, MacArthur Highway, Pampanga	2026-06-15 04:00:00+00	2026-06-15 05:00:00+00	8.00	8.00	0.00	\N	\N	\N	manual	\N	2026-06-14 23:56:00+00	\N	420	\N	424
36	4	2026-06-25 23:59:00+00	2026-06-26 09:00:00+00	app	15.1458000	120.5906000	Highway Grill, MacArthur Highway, Pampanga	Highway Grill, MacArthur Highway, Pampanga	2026-06-26 04:00:00+00	2026-06-26 05:00:00+00	8.00	8.00	0.00	\N	\N	\N	manual	\N	2026-06-25 23:59:00+00	\N	420	\N	421
37	4	2026-06-27 00:05:00+00	2026-06-27 09:00:00+00	app	15.1458000	120.5906000	Highway Grill, MacArthur Highway, Pampanga	Highway Grill, MacArthur Highway, Pampanga	2026-06-27 04:00:00+00	2026-06-27 05:00:00+00	8.00	8.00	0.00	\N	\N	\N	manual	\N	2026-06-27 00:05:00+00	\N	420	\N	415
29	4	2026-06-17 00:22:00+00	2026-06-17 09:00:00+00	app	15.1458000	120.5906000	Highway Grill, MacArthur Highway, Pampanga	Highway Grill, MacArthur Highway, Pampanga	2026-06-17 04:00:00+00	2026-06-17 05:00:00+00	1.00	1.00	0.00	\N	\N	\N	manual	\N	2026-06-17 00:22:00+00	\N	420	\N	398
30	4	2026-06-17 23:55:00+00	2026-06-18 09:00:00+00	app	15.1458000	120.5906000	Highway Grill, MacArthur Highway, Pampanga	Highway Grill, MacArthur Highway, Pampanga	2026-06-18 04:00:00+00	2026-06-18 05:00:00+00	8.08	8.08	0.00	\N	\N	\N	manual	\N	2026-06-17 23:55:00+00	\N	\N	\N	\N
15	4	2026-05-31 23:56:00+00	2026-06-01 09:00:00+00	app	15.1458000	120.5906000	Highway Grill, MacArthur Highway, Pampanga	Highway Grill, MacArthur Highway, Pampanga	2026-06-01 04:00:00+00	2026-06-01 05:00:00+00	8.07	8.00	0.00	\N	\N	\N	manual	\N	2026-05-31 23:56:00+00	0	0	0	4
31	4	2026-06-19 00:07:00+00	2026-06-19 09:00:00+00	app	15.1458000	120.5906000	Highway Grill, MacArthur Highway, Pampanga	Highway Grill, MacArthur Highway, Pampanga	2026-06-19 04:00:00+00	2026-06-19 05:00:00+00	1.00	1.00	0.00	\N	\N	\N	manual	\N	2026-06-19 00:07:00+00	\N	420	\N	413
32	4	2026-06-19 23:59:00+00	2026-06-20 11:00:00+00	app	15.1458000	120.5906000	Highway Grill, MacArthur Highway, Pampanga	Highway Grill, MacArthur Highway, Pampanga	2026-06-20 04:00:00+00	2026-06-20 05:00:00+00	3.00	3.00	0.00	\N	\N	\N	manual	\N	2026-06-19 23:59:00+00	\N	300	\N	421
33	4	2026-06-22 23:55:00+00	2026-06-23 08:31:00+00	app	15.1458000	120.5906000	Highway Grill, MacArthur Highway, Pampanga	Highway Grill, MacArthur Highway, Pampanga	2026-06-23 04:00:00+00	2026-06-23 05:00:00+00	7.60	7.60	0.00	\N	\N	\N	manual	\N	2026-06-22 23:55:00+00	\N	\N	\N	\N
34	4	2026-06-24 00:05:00+00	2026-06-24 09:00:00+00	app	15.1458000	120.5906000	Highway Grill, MacArthur Highway, Pampanga	Highway Grill, MacArthur Highway, Pampanga	2026-06-24 04:00:00+00	2026-06-24 05:00:00+00	1.00	1.00	0.00	\N	\N	\N	manual	\N	2026-06-24 00:05:00+00	\N	420	\N	415
35	4	2026-06-24 23:58:00+00	2026-06-25 12:00:00+00	app	15.1458000	120.5906000	Highway Grill, MacArthur Highway, Pampanga	Highway Grill, MacArthur Highway, Pampanga	2026-06-25 04:00:00+00	2026-06-25 05:00:00+00	11.03	9.00	2.03	\N	\N	\N	manual	\N	2026-06-24 23:58:00+00	\N	\N	\N	\N
38	4	2026-06-30 07:09:00+00	2026-06-30 09:00:00+00	manual	15.1458000	120.5906000	Highway Grill, MacArthur Highway, Pampanga	Highway Grill, MacArthur Highway, Pampanga	2026-06-30 04:00:00+00	2026-06-30 05:00:00+00	7.85	7.85	0.00	\N	2	2026-06-29 17:25:56.685+00	manual	\N	2026-06-30 00:09:00+00	\N	\N	\N	\N
28	4	2026-06-15 23:56:00+00	2026-06-16 11:00:00+00	app	15.1458000	120.5906000	Highway Grill, MacArthur Highway, Pampanga	Highway Grill, MacArthur Highway, Pampanga	2026-06-16 04:00:00+00	2026-06-16 05:00:00+00	10.07	9.00	1.07	\N	\N	\N	manual	\N	2026-06-15 23:56:00+00	\N	\N	\N	\N
40	2	2026-06-03 00:21:00+00	2026-06-03 12:00:00+00	app	15.1458000	120.5906000	Highway Grill, MacArthur Highway, Pampanga	Highway Grill, MacArthur Highway, Pampanga	2026-06-03 04:00:00+00	2026-06-03 05:00:00+00	10.65	9.00	1.65	\N	\N	\N	manual	\N	2026-06-03 00:21:00+00	\N	\N	\N	\N
41	2	2026-06-03 23:55:00+00	2026-06-04 12:00:00+00	app	15.1458000	120.5906000	Highway Grill, MacArthur Highway, Pampanga	Highway Grill, MacArthur Highway, Pampanga	2026-06-04 04:00:00+00	2026-06-04 05:00:00+00	11.08	9.00	2.08	\N	\N	\N	manual	\N	2026-06-03 23:55:00+00	\N	\N	\N	\N
42	2	2026-06-04 23:55:00+00	2026-06-05 09:00:00+00	app	15.1458000	120.5906000	Highway Grill, MacArthur Highway, Pampanga	Highway Grill, MacArthur Highway, Pampanga	2026-06-05 04:00:00+00	2026-06-05 05:00:00+00	8.08	8.08	0.00	\N	\N	\N	manual	\N	2026-06-04 23:55:00+00	\N	\N	\N	\N
43	2	2026-06-05 23:56:00+00	2026-06-06 08:33:00+00	app	15.1458000	120.5906000	Highway Grill, MacArthur Highway, Pampanga	Highway Grill, MacArthur Highway, Pampanga	2026-06-06 04:00:00+00	2026-06-06 05:00:00+00	7.62	7.62	0.00	\N	\N	\N	manual	\N	2026-06-05 23:56:00+00	\N	\N	\N	\N
44	2	2026-06-07 00:02:00+00	2026-06-07 09:00:00+00	app	15.1458000	120.5906000	Highway Grill, MacArthur Highway, Pampanga	Highway Grill, MacArthur Highway, Pampanga	2026-06-07 04:00:00+00	2026-06-07 05:00:00+00	7.97	7.97	0.00	\N	\N	\N	manual	\N	2026-06-07 00:02:00+00	\N	\N	\N	\N
45	2	2026-06-09 00:13:00+00	2026-06-09 09:00:00+00	app	15.1458000	120.5906000	Highway Grill, MacArthur Highway, Pampanga	Highway Grill, MacArthur Highway, Pampanga	2026-06-09 04:00:00+00	2026-06-09 05:00:00+00	7.78	7.78	0.00	\N	\N	\N	manual	\N	2026-06-09 00:13:00+00	\N	\N	\N	\N
46	2	2026-06-09 23:54:00+00	2026-06-10 10:30:00+00	app	15.1458000	120.5906000	Highway Grill, MacArthur Highway, Pampanga	Highway Grill, MacArthur Highway, Pampanga	2026-06-10 04:00:00+00	2026-06-10 05:00:00+00	9.60	9.00	0.60	\N	\N	\N	manual	\N	2026-06-09 23:54:00+00	\N	\N	\N	\N
47	2	2026-06-11 00:22:00+00	2026-06-11 08:47:00+00	app	15.1458000	120.5906000	Highway Grill, MacArthur Highway, Pampanga	Highway Grill, MacArthur Highway, Pampanga	2026-06-11 04:00:00+00	2026-06-11 05:00:00+00	7.42	7.42	0.00	\N	\N	\N	manual	\N	2026-06-11 00:22:00+00	\N	\N	\N	\N
48	2	2026-06-11 23:56:00+00	2026-06-12 09:00:00+00	app	15.1458000	120.5906000	Highway Grill, MacArthur Highway, Pampanga	Highway Grill, MacArthur Highway, Pampanga	2026-06-12 04:00:00+00	2026-06-12 05:00:00+00	8.07	8.07	0.00	\N	\N	\N	manual	\N	2026-06-11 23:56:00+00	\N	\N	\N	\N
49	2	2026-06-13 00:01:00+00	2026-06-13 11:00:00+00	app	15.1458000	120.5906000	Highway Grill, MacArthur Highway, Pampanga	Highway Grill, MacArthur Highway, Pampanga	2026-06-13 04:00:00+00	2026-06-13 05:00:00+00	9.98	9.00	0.98	\N	\N	\N	manual	\N	2026-06-13 00:01:00+00	\N	\N	\N	\N
50	2	2026-06-14 00:00:00+00	2026-06-14 10:00:00+00	app	15.1458000	120.5906000	Highway Grill, MacArthur Highway, Pampanga	Highway Grill, MacArthur Highway, Pampanga	2026-06-14 04:00:00+00	2026-06-14 05:00:00+00	13.00	8.00	5.00	\N	\N	\N	manual	\N	2026-06-14 00:00:00+00	\N	120	\N	180
61	2	2026-06-27 00:22:00+00	2026-06-27 11:00:00+00	app	15.1458000	120.5906000	Highway Grill, MacArthur Highway, Pampanga	Highway Grill, MacArthur Highway, Pampanga	2026-06-27 04:00:00+00	2026-06-27 05:00:00+00	9.63	9.00	0.63	\N	\N	\N	manual	\N	2026-06-27 00:22:00+00	\N	\N	\N	\N
63	2	2026-06-30 06:58:00+00	2026-06-29 16:00:00+00	manual	15.1458000	120.5906000	Highway Grill, MacArthur Highway, Pampanga	Highway Grill, MacArthur Highway, Pampanga	2026-06-30 04:00:00+00	2026-06-30 05:00:00+00	8.03	8.03	0.00	\N	2	2026-06-29 17:26:17.109+00	manual	\N	2026-06-29 23:58:00+00	\N	\N	\N	\N
64	4	2026-06-29 14:58:00+00	2026-06-29 23:00:00+00	manual	13.4143502	123.3897680	Iriga-Nabua Road, San Jose, Nabua	\N	\N	\N	8.03	1.03	7.00	63	2	2026-06-29 07:05:08.132+00	\N	\N	2026-06-29 06:58:30.010514+00	478	\N	420	\N
52	2	2026-06-17 00:18:00+00	2026-06-17 09:00:00+00	app	15.1458000	120.5906000	Highway Grill, MacArthur Highway, Pampanga	Highway Grill, MacArthur Highway, Pampanga	2026-06-17 04:00:00+00	2026-06-17 05:00:00+00	7.70	7.70	0.00	\N	\N	\N	manual	\N	2026-06-17 00:18:00+00	\N	\N	\N	\N
53	2	2026-06-17 23:42:00+00	2026-06-18 09:00:00+00	app	15.1458000	120.5906000	Highway Grill, MacArthur Highway, Pampanga	Highway Grill, MacArthur Highway, Pampanga	2026-06-18 04:00:00+00	2026-06-18 05:00:00+00	8.30	8.30	0.00	\N	\N	\N	manual	\N	2026-06-17 23:42:00+00	\N	\N	\N	\N
54	2	2026-06-19 00:14:00+00	2026-06-19 09:00:00+00	app	15.1458000	120.5906000	Highway Grill, MacArthur Highway, Pampanga	Highway Grill, MacArthur Highway, Pampanga	2026-06-19 04:00:00+00	2026-06-19 05:00:00+00	7.77	7.77	0.00	\N	\N	\N	manual	\N	2026-06-19 00:14:00+00	\N	\N	\N	\N
55	2	2026-06-19 23:45:00+00	2026-06-20 12:00:00+00	app	15.1458000	120.5906000	Highway Grill, MacArthur Highway, Pampanga	Highway Grill, MacArthur Highway, Pampanga	2026-06-20 04:00:00+00	2026-06-20 05:00:00+00	11.25	9.00	2.25	\N	\N	\N	manual	\N	2026-06-19 23:45:00+00	\N	\N	\N	\N
56	2	2026-06-21 00:01:00+00	2026-06-21 11:00:00+00	app	15.1458000	120.5906000	Highway Grill, MacArthur Highway, Pampanga	Highway Grill, MacArthur Highway, Pampanga	2026-06-21 04:00:00+00	2026-06-21 05:00:00+00	7.00	7.00	0.00	\N	\N	\N	manual	\N	2026-06-21 00:01:00+00	\N	60	\N	179
57	2	2026-06-22 23:56:00+00	2026-06-23 09:00:00+00	app	15.1458000	120.5906000	Highway Grill, MacArthur Highway, Pampanga	Highway Grill, MacArthur Highway, Pampanga	2026-06-23 04:00:00+00	2026-06-23 05:00:00+00	8.07	8.07	0.00	\N	\N	\N	manual	\N	2026-06-22 23:56:00+00	\N	\N	\N	\N
58	2	2026-06-24 00:00:00+00	2026-06-24 09:00:00+00	app	15.1458000	120.5906000	Highway Grill, MacArthur Highway, Pampanga	Highway Grill, MacArthur Highway, Pampanga	2026-06-24 04:00:00+00	2026-06-24 05:00:00+00	8.00	8.00	0.00	\N	\N	\N	manual	\N	2026-06-24 00:00:00+00	\N	\N	\N	\N
51	2	2026-06-15 23:55:00+00	2026-06-16 09:00:00+00	app	15.1458000	120.5906000	Highway Grill, MacArthur Highway, Pampanga	Highway Grill, MacArthur Highway, Pampanga	2026-06-16 04:00:00+00	2026-06-16 05:00:00+00	8.08	8.08	0.00	\N	\N	\N	manual	\N	2026-06-15 23:55:00+00	\N	\N	\N	\N
59	2	2026-06-25 00:22:00+00	2026-06-25 08:40:00+00	app	15.1458000	120.5906000	Highway Grill, MacArthur Highway, Pampanga	Highway Grill, MacArthur Highway, Pampanga	2026-06-25 04:00:00+00	2026-06-25 05:00:00+00	7.30	7.30	0.00	\N	\N	\N	manual	\N	2026-06-25 00:22:00+00	\N	\N	\N	\N
60	2	2026-06-26 00:02:00+00	2026-06-26 09:00:00+00	app	15.1458000	120.5906000	Highway Grill, MacArthur Highway, Pampanga	Highway Grill, MacArthur Highway, Pampanga	2026-06-26 04:00:00+00	2026-06-26 05:00:00+00	7.97	7.97	0.00	\N	\N	\N	manual	\N	2026-06-26 00:02:00+00	\N	\N	\N	\N
62	2	2026-06-28 00:09:00+00	2026-06-28 09:00:00+00	app	15.1458000	120.5906000	Highway Grill, MacArthur Highway, Pampanga	Highway Grill, MacArthur Highway, Pampanga	2026-06-28 04:00:00+00	2026-06-28 05:00:00+00	12.00	8.00	4.00	\N	\N	\N	manual	\N	2026-06-28 00:09:00+00	\N	180	\N	171
65	4	2026-06-29 07:17:34.753737+00	2026-06-29 15:52:57+00	app	13.4145453	123.3896845	Iriga-Nabua Road, San Jose, Nabua	Iriga-Nabua Road, San Jose, Nabua	\N	\N	7.70	7.70	0.00	63	\N	\N	manual	\N	2026-06-29 07:17:34.753737+00	18	0	0	\N
\.
COPY public.attendance_correction_requests (id, employee_id, attendance_id, request_type, requested_clock_in, requested_clock_out, reason, status, reviewed_by, reviewed_at, review_note, resolved_attendance_id, created_at) FROM stdin;
\.
COPY public.audit_logs (id, user_id, action, table_name, record_id, old_data, new_data, ip_address, created_at) FROM stdin;
1	2	update	employee_government_profiles	2	{"tin": "000000062-000", "notes": "Seeded benefit profile (HG-HR)", "sss_number": "34-0000034-2", "updated_at": "2026-06-18T08:33:05.439Z", "employee_id": 2, "sss_enrolled": true, "tax_enrolled": true, "pagibig_number": "1212-0000-0058", "pagibig_enrolled": true, "philhealth_number": "12-000000046-2", "sss_deduction_mode": "manual", "sss_monthly_amount": "270.00", "tax_deduction_mode": "manual", "tax_monthly_amount": "0.00", "philhealth_enrolled": true, "pagibig_deduction_mode": "manual", "pagibig_monthly_amount": "100.00", "philhealth_deduction_mode": "manual", "philhealth_monthly_amount": "147.88"}	{"tin": "000-000-062-000", "notes": "Seeded benefit profile (HG-HR)", "sss_number": "34-0000034-2", "updated_at": "2026-06-18T08:35:21.485Z", "employee_id": 2, "sss_enrolled": true, "tax_enrolled": false, "pagibig_number": "1212-0000-0058", "pagibig_enrolled": true, "philhealth_number": "12-000000046-2", "sss_deduction_mode": "manual", "sss_monthly_amount": "270.00", "tax_deduction_mode": "manual", "tax_monthly_amount": "0.00", "philhealth_enrolled": true, "pagibig_deduction_mode": "manual", "pagibig_monthly_amount": "100.00", "philhealth_deduction_mode": "manual", "philhealth_monthly_amount": "147.88"}	\N	2026-06-18 08:35:21.491706+00
2	2	update	employee_government_profiles	2	{"tin": "000-000-062-000", "notes": "Seeded benefit profile (HG-HR)", "sss_number": "34-0000034-2", "updated_at": "2026-06-18T08:47:05.108Z", "employee_id": 2, "sss_enrolled": true, "tax_enrolled": false, "pagibig_number": "1212-0000-0058", "pagibig_enrolled": true, "philhealth_number": "12-000000046-2", "sss_deduction_mode": "manual", "sss_monthly_amount": "270.00", "tax_deduction_mode": "manual", "tax_monthly_amount": "0.00", "philhealth_enrolled": true, "pagibig_deduction_mode": "manual", "pagibig_monthly_amount": "100.00", "philhealth_deduction_mode": "manual", "philhealth_monthly_amount": "147.88"}	{"tin": "000-000-062-000", "notes": "Seeded benefit profile (HG-HR)", "sss_number": "34-0000034-2", "updated_at": "2026-06-18T11:05:08.493Z", "employee_id": 2, "sss_enrolled": true, "tax_enrolled": false, "pagibig_number": "1212-0000-0058", "pagibig_enrolled": true, "philhealth_number": "12-000000046-2", "sss_deduction_mode": "manual", "sss_monthly_amount": "100.00", "tax_deduction_mode": "manual", "tax_monthly_amount": "0.00", "philhealth_enrolled": true, "pagibig_deduction_mode": "manual", "pagibig_monthly_amount": "100.00", "philhealth_deduction_mode": "manual", "philhealth_monthly_amount": "147.88"}	\N	2026-06-18 11:05:08.5074+00
3	2	update	employee_government_profiles	2	{"tin": "000-000-062-000", "notes": "Seeded benefit profile (HG-HR)", "sss_number": "34-0000034-2", "updated_at": "2026-06-18T11:05:08.493Z", "employee_id": 2, "sss_enrolled": true, "tax_enrolled": false, "pagibig_number": "1212-0000-0058", "pagibig_enrolled": true, "philhealth_number": "12-000000046-2", "sss_deduction_mode": "manual", "sss_monthly_amount": "100.00", "tax_deduction_mode": "manual", "tax_monthly_amount": "0.00", "philhealth_enrolled": true, "pagibig_deduction_mode": "manual", "pagibig_monthly_amount": "100.00", "philhealth_deduction_mode": "manual", "philhealth_monthly_amount": "147.88"}	{"tin": "000-000-062-000", "notes": "Seeded benefit profile (HG-HR)", "sss_number": "34-0000034-2", "updated_at": "2026-06-18T11:05:12.666Z", "employee_id": 2, "sss_enrolled": true, "tax_enrolled": false, "pagibig_number": "1212-0000-0058", "pagibig_enrolled": true, "philhealth_number": "12-000000046-2", "sss_deduction_mode": "manual", "sss_monthly_amount": "100.00", "tax_deduction_mode": "manual", "tax_monthly_amount": "0.00", "philhealth_enrolled": true, "pagibig_deduction_mode": "manual", "pagibig_monthly_amount": "100.00", "philhealth_deduction_mode": "manual", "philhealth_monthly_amount": "147.88"}	\N	2026-06-18 11:05:12.675083+00
4	2	update	employee_government_profiles	2	{"tin": "000-000-062-000", "notes": "Seeded benefit profile (HG-HR)", "sss_number": "34-0000034-2", "updated_at": "2026-06-18T11:05:12.666Z", "employee_id": 2, "sss_enrolled": true, "tax_enrolled": false, "pagibig_number": "1212-0000-0058", "pagibig_enrolled": true, "philhealth_number": "12-000000046-2", "sss_deduction_mode": "manual", "sss_monthly_amount": "100.00", "tax_deduction_mode": "manual", "tax_monthly_amount": "0.00", "philhealth_enrolled": true, "pagibig_deduction_mode": "manual", "pagibig_monthly_amount": "100.00", "philhealth_deduction_mode": "manual", "philhealth_monthly_amount": "147.88"}	{"tin": "000-000-062-000", "notes": "Seeded benefit profile (HG-HR)", "sss_number": "34-0000034-2", "updated_at": "2026-06-18T11:29:59.942Z", "employee_id": 2, "sss_enrolled": true, "tax_enrolled": false, "pagibig_number": "1212-0000-0058", "pagibig_enrolled": true, "philhealth_number": "12-000000046-2", "sss_deduction_mode": "manual", "sss_monthly_amount": "100.00", "tax_deduction_mode": "manual", "tax_monthly_amount": "0.00", "philhealth_enrolled": true, "pagibig_deduction_mode": "manual", "pagibig_monthly_amount": "100.00", "philhealth_deduction_mode": "manual", "philhealth_monthly_amount": "147.88"}	\N	2026-06-18 11:29:59.950753+00
5	2	update	employee_government_profiles	2	{"tin": "000-000-062-000", "notes": "Seeded benefit profile (HG-HR)", "sss_number": "34-0000034-2", "updated_at": "2026-06-18T11:29:59.942Z", "employee_id": 2, "sss_enrolled": true, "tax_enrolled": false, "pagibig_number": "1212-0000-0058", "pagibig_enrolled": true, "philhealth_number": "12-000000046-2", "sss_deduction_mode": "manual", "sss_monthly_amount": "100.00", "tax_deduction_mode": "manual", "tax_monthly_amount": "0.00", "philhealth_enrolled": true, "pagibig_deduction_mode": "manual", "pagibig_monthly_amount": "100.00", "philhealth_deduction_mode": "manual", "philhealth_monthly_amount": "147.88"}	{"tin": "000-000-062-000", "notes": "Seeded benefit profile (HG-HR)", "sss_number": "34-0000034-2", "updated_at": "2026-06-18T11:30:01.904Z", "employee_id": 2, "sss_enrolled": true, "tax_enrolled": false, "pagibig_number": "1212-0000-0058", "pagibig_enrolled": true, "philhealth_number": "12-000000046-2", "sss_deduction_mode": "manual", "sss_monthly_amount": "100.00", "tax_deduction_mode": "manual", "tax_monthly_amount": "0.00", "philhealth_enrolled": true, "pagibig_deduction_mode": "manual", "pagibig_monthly_amount": "100.00", "philhealth_deduction_mode": "manual", "philhealth_monthly_amount": "147.88"}	\N	2026-06-18 11:30:01.910765+00
6	2	update	employee_government_profiles	2	{"tin": "000-000-062-000", "notes": "Seeded benefit profile (HG-HR)", "sss_number": "34-0000034-2", "updated_at": "2026-06-18T11:30:01.904Z", "employee_id": 2, "sss_enrolled": true, "tax_enrolled": false, "pagibig_number": "1212-0000-0058", "pagibig_enrolled": true, "philhealth_number": "12-000000046-2", "sss_deduction_mode": "manual", "sss_monthly_amount": "100.00", "tax_deduction_mode": "manual", "tax_monthly_amount": "0.00", "philhealth_enrolled": true, "pagibig_deduction_mode": "manual", "pagibig_monthly_amount": "100.00", "philhealth_deduction_mode": "manual", "philhealth_monthly_amount": "147.88"}	{"tin": "000-000-062-000", "notes": "Seeded benefit profile (HG-HR)", "sss_number": "34-0000034-2", "updated_at": "2026-06-18T11:30:05.842Z", "employee_id": 2, "sss_enrolled": true, "tax_enrolled": false, "pagibig_number": "1212-0000-0058", "pagibig_enrolled": true, "philhealth_number": "12-000000046-2", "sss_deduction_mode": "manual", "sss_monthly_amount": "100.00", "tax_deduction_mode": "manual", "tax_monthly_amount": "0.00", "philhealth_enrolled": true, "pagibig_deduction_mode": "manual", "pagibig_monthly_amount": "100.00", "philhealth_deduction_mode": "manual", "philhealth_monthly_amount": "147.88"}	\N	2026-06-18 11:30:05.847809+00
7	2	delete	employee_benefit_enrollments	3	{"id": 3, "notes": "Seeded allowance", "amount": "1500.00", "frequency": "monthly", "is_active": true, "employee_id": 4, "benefit_code": "rice", "benefit_name": "Rice allowance"}	\N	\N	2026-06-28 19:04:44.288168+00
8	2	delete	employee_benefit_enrollments	4	{"id": 4, "notes": "Seeded allowance", "amount": "800.00", "frequency": "per_payroll", "is_active": true, "employee_id": 2, "benefit_code": "meal", "benefit_name": "Meal allowance"}	\N	\N	2026-06-29 05:18:56.325551+00
9	2	delete	employee_benefit_enrollments	2	{"id": 2, "notes": "Seeded allowance", "amount": "1500.00", "frequency": "monthly", "is_active": true, "employee_id": 2, "benefit_code": "rice", "benefit_name": "Rice allowance"}	\N	\N	2026-06-29 05:18:58.047389+00
\.
COPY public.branches (id, name, address, phone, timezone, is_active, manager_id, default_latitude, default_longitude, created_at) FROM stdin;
2	test	Unknown location	dsadw	Asia/Manila	f	\N	0.0000000	0.0000000	2026-06-19 04:13:14.007533+00
1	Highway Grill Main	Iriga-Nabua Road, San Jose, Santa Lucia, Nabua, Camarines Sur, Bicol Region, 4434, Philippines	+63-45-000-0000	Asia/Manila	t	\N	13.4145032	123.3897434	2026-06-17 17:11:37.290308+00
\.
COPY public.compliance_checklists (id, name, checklist_type, frequency, due_day) FROM stdin;
1	Daily food safety walkthrough	food_safety	daily	\N
2	Fire extinguisher inspection	fire_safety	monthly	1
3	Labor law poster review	labor	annual	15
\.
COPY public.compliance_logs (id, checklist_id, branch_id, completed_by, completed_at, status, notes) FROM stdin;
\.
COPY public.departments (id, branch_id, name, cost_center, head_id) FROM stdin;
1	1	Management	MGMT	\N
2	1	Kitchen	KIT	\N
3	1	Service	SVC	\N
5	1	Bar	BAR	\N
6	1	Cafe	CAFE	\N
\.
COPY public.documents (id, employee_id, category, title, file_url, file_type, file_size_kb, is_confidential, expires_at, uploaded_by, created_at) FROM stdin;
2	2	payslip	Payslip JUN 16 â€“ 30	https://wn91eufbs8075c7h.public.blob.vercel-storage.com/documents/payslip-19.pdf	application/pdf	318	f	\N	2	2026-06-29 06:05:14.851816+00
3	4	payslip	Payslip JUN 16 â€“ 30	https://wn91eufbs8075c7h.public.blob.vercel-storage.com/documents/payslip-22.pdf	application/pdf	318	f	\N	2	2026-06-29 06:05:43.241166+00
\.
COPY public.employee_bank_accounts (id, employee_id, bank_name, account_name, account_no, routing_no, is_primary) FROM stdin;
\.
COPY public.employee_benefit_enrollments (id, employee_id, benefit_code, benefit_name, amount, frequency, is_active, notes) FROM stdin;
\.
COPY public.employee_contracts (id, employee_id, contract_type, start_date, end_date, hourly_rate, weekly_hours, document_id) FROM stdin;
\.
COPY public.employee_government_profiles (employee_id, sss_number, philhealth_number, pagibig_number, tin, sss_enrolled, philhealth_enrolled, pagibig_enrolled, notes, updated_at, sss_deduction_mode, sss_monthly_amount, philhealth_deduction_mode, philhealth_monthly_amount, pagibig_deduction_mode, pagibig_monthly_amount, tax_deduction_mode, tax_monthly_amount, tax_enrolled) FROM stdin;
2	34-0000034-2	12-000000046-2	1212-0000-0058	000-000-062-000	t	t	t	Seeded benefit profile (HG-HR)	2026-06-20 03:34:53.628605+00	manual	100.00	manual	147.88	manual	100.00	manual	0.00	f
4	34-0000068-4	\N	1212-0000-0116	\N	t	f	t	Seeded benefit profile (HG-200)	2026-06-20 03:34:53.628605+00	manual	270.00	manual	\N	manual	100.00	manual	\N	f
\.
COPY public.employee_loans (id, employee_id, loan_type, principal, balance, term_months, repayment_schedule, term_duration, monthly_deduction, purpose, status, approved_by, approved_at, created_at) FROM stdin;
1	4	cash_advance	500.00	0.00	2	one_month	1	250.00	\N	paid	2	2026-06-20 01:41:45.333979+00	2026-06-18 08:01:43.414738+00
\.
COPY public.employees (id, branch_id, department_id, position_id, emp_number, first_name, last_name, email, phone, hire_date, employment_type, pay_basis, pay_rate, is_stay_in, housing_deduction, status, date_of_birth, gender, nationality, national_id, address, emergency_name, emergency_phone, photo_url, created_at, worker_class) FROM stdin;
8	1	3	13	HG-204	Glocelyn	Esplago	glocelynesplago2@gmail.com	09068890748	2026-06-19	full_time	daily	455.00	f	0.00	active	1993-08-11	female	Filipino	\N	Zone 2 San Miguel Nabua Camarines Sur	\N	\N	\N	2026-06-19 08:40:00.007989+00	regular
7	1	2	12	HG-203	Arnel	Madridano	madridanoarnel53@gmail.com	09279757427	2026-06-19	full_time	daily	455.00	t	0.00	active	2026-06-19	male	Filipino	\N	\N	\N	\N	\N	2026-06-19 08:30:42.728795+00	regular
6	1	2	9	HG-202	Rose	Mediado	mediadorose@gmail.com	09468280950	2026-06-19	full_time	daily	455.00	f	0.00	active	1986-08-29	\N	Filipino	\N	Zone 7 san Vicente gurong-gurong, nabua camarines sur	\N	\N	\N	2026-06-19 08:29:03.718395+00	regular
5	1	2	2	HG-201	Ram	Reginaldo	ramreginaldo1985@gmail.com	09637603806	2026-06-19	full_time	daily	455.00	f	0.00	active	1985-12-21	male	Filipino	\N	Pinaglabanan st. Zone 6 san agustin iriga city	\N	\N	\N	2026-06-19 08:24:11.161435+00	regular
2	1	1	1	HG-HR	JENALYN	DENIEGA	deniegajena@gmail.com	09951311055	2024-01-15	full_time	daily	455.00	f	0.00	active	1998-03-17	female	Filipino	\N	unknown	\N	\N	\N	2026-06-17 17:11:37.290308+00	regular
4	1	2	12	HG-200	DARRYL JOHN	REYES	dareyes@my.cspc.edu.ph	09914423863	2026-06-18	full_time	daily	455.00	t	500.00	active	1998-03-17	male	Filipino	\N	Zone 7	\N	\N	https://wn91eufbs8075c7h.public.blob.vercel-storage.com/photos/4.jpg	2026-06-18 03:09:40.009224+00	regular
\.
COPY public.field_work_checkins (id, employee_id, site_id, latitude, longitude, address, attendance_id, notes, checked_in_at) FROM stdin;
\.
COPY public.field_work_sites (id, branch_id, name, address, latitude, longitude, radius_m, is_active, clock_in_eligible, created_at) FROM stdin;
2	1	Iriga-Nabua Road, San Jose, Nabua	Iriga-Nabua Road, San Jose, Santa Lucia, Nabua, Camarines Sur, Bicol Region, 4434, Philippines	13.4138744	123.3883744	100	f	t	2026-06-18 05:47:01.329449+00
1	1	Main branch geofence	Highway Grill, Iriga-Nabua Road, San Jose, Santa Lucia, Nabua, Camarines Sur, Bicol Region, 4434, Philippines	13.4145032	123.3897434	50	t	t	2026-06-17 17:11:37.290308+00
\.
COPY public.holidays (id, branch_id, holiday_date, name, holiday_type, pay_multiplier) FROM stdin;
1	\N	2026-06-12	Independence Day	national	2.00
\.
COPY public.leave_balances (id, employee_id, leave_type_id, year, accrued, used, pending, carried_forward) FROM stdin;
4	2	1	2026	15.0	0.0	0.0	0.0
5	2	2	2026	10.0	0.0	0.0	0.0
6	2	3	2026	5.0	0.0	0.0	0.0
10	4	1	2026	15.0	0.0	0.0	0.0
11	4	2	2026	10.0	0.0	0.0	0.0
12	4	3	2026	5.0	0.0	0.0	0.0
13	5	1	2026	15.0	0.0	0.0	0.0
14	5	2	2026	10.0	0.0	0.0	0.0
15	5	3	2026	5.0	0.0	0.0	0.0
16	6	1	2026	15.0	0.0	0.0	0.0
17	6	2	2026	10.0	0.0	0.0	0.0
18	6	3	2026	5.0	0.0	0.0	0.0
19	7	1	2026	15.0	0.0	0.0	0.0
20	7	2	2026	10.0	0.0	0.0	0.0
21	7	3	2026	5.0	0.0	0.0	0.0
22	8	1	2026	15.0	0.0	0.0	0.0
23	8	2	2026	10.0	0.0	0.0	0.0
24	8	3	2026	5.0	0.0	0.0	0.0
\.
COPY public.leave_requests (id, employee_id, leave_type_id, start_date, end_date, days_count, reason, status, reviewed_by, reviewed_at, notes, created_at) FROM stdin;
\.
COPY public.leave_types (id, name, paid, days_per_year, carry_forward, requires_approval, color_hex) FROM stdin;
1	Vacation	t	15.0	t	t	#378ADD
2	Sick	t	10.0	f	t	#1D9E75
3	Emergency leave	t	5.0	f	t	#BA7517
4	Unpaid absence	f	0.0	f	t	#888888
\.
COPY public.loan_payments (id, loan_id, amount, paid_on, notes) FROM stdin;
1	1	250.00	2026-06-30	Payroll deduction (run 2)
3	1	250.00	2026-07-01	Payroll deduction (run 4)
\.
COPY public.notifications (id, user_id, type, title, body, link, related_id, is_read, created_at) FROM stdin;
1	4	registration_approved	Registration approved â€” you can sign in	HR has approved your Highway Grill registration. Sign in to your account. Your status is pending until HR activates you for time clock, schedules, and payroll.	/	4	t	2026-06-18 03:34:33.704614+00
2	4	registration_activated	Account activated â€” you can clock in	Hi DARRYL JOHN REYES, your employee account is now active. You can time in/out, view your schedule, apply for leave, and access payroll.	/	4	t	2026-06-18 03:34:40.48209+00
3	4	registration_activated	Account activated â€” you can clock in	Hi DARRYL JOHN REYES, your employee account is now active. You can time in/out, view your schedule, apply for leave, and access payroll.	/	4	t	2026-06-18 03:38:11.102313+00
4	6	registration_approved	Registration approved â€” you can sign in	HR has approved your Highway Grill registration. Sign in to your account. Your status is pending until HR activates you for time clock, schedules, and payroll.	/	6	f	2026-06-19 08:52:35.82556+00
5	5	registration_approved	Registration approved â€” you can sign in	HR has approved your Highway Grill registration. Sign in to your account. Your status is pending until HR activates you for time clock, schedules, and payroll.	/	5	f	2026-06-19 08:52:36.805457+00
6	7	registration_approved	Registration approved â€” you can sign in	HR has approved your Highway Grill registration. Sign in to your account. Your status is pending until HR activates you for time clock, schedules, and payroll.	/	7	f	2026-06-19 08:52:38.024576+00
7	8	registration_approved	Registration approved â€” you can sign in	HR has approved your Highway Grill registration. Sign in to your account. Your status is pending until HR activates you for time clock, schedules, and payroll.	/	8	f	2026-06-19 08:52:39.016904+00
8	5	registration_activated	Account activated â€” you can clock in	Hi Ram Reginaldo, your employee account is now active. You can time in/out, view your schedule, apply for leave, and access payroll.	/	5	f	2026-06-19 08:52:41.513048+00
9	6	registration_activated	Account activated â€” you can clock in	Hi Rose Mediado, your employee account is now active. You can time in/out, view your schedule, apply for leave, and access payroll.	/	6	f	2026-06-19 08:52:42.61519+00
10	7	registration_activated	Account activated â€” you can clock in	Hi Arnel Madridano, your employee account is now active. You can time in/out, view your schedule, apply for leave, and access payroll.	/	7	f	2026-06-19 08:52:43.429447+00
11	8	registration_activated	Account activated â€” you can clock in	Hi Glocelyn Esplago, your employee account is now active. You can time in/out, view your schedule, apply for leave, and access payroll.	/	8	f	2026-06-19 08:52:44.226047+00
13	2	payslip	Payslip ready â€” JUN 16 â€“ 30	Your payslip was emailed and is available in My Payroll.	http://localhost:5173/payroll	19	t	2026-06-29 06:05:21.542374+00
15	4	payslip	Payslip ready â€” JUN 16 â€“ 30	Your payslip was emailed and is available in My Payroll.	http://localhost:5173/payroll	22	t	2026-06-29 06:34:44.276204+00
14	4	payslip	Payslip ready â€” JUN 16 â€“ 30	Your payslip was emailed and is available in My Payroll.	http://localhost:5173/payroll	22	t	2026-06-29 06:05:48.673922+00
12	4	loan_approved	Loan approved	Your loan application for â‚±500.00 was approved. Term: 1 month (2 cutoffs). Deduction per cutoff: â‚±250.00.	/loans	1	t	2026-06-20 01:41:45.351833+00
\.
COPY public.overtime_requests (id, employee_id, request_date, extra_hours, reason, status, source, attendance_id, created_at) FROM stdin;
4	4	2026-06-02	1.50	Seeded overtime	approved	manual	16	2026-06-28 18:24:50.478865+00
5	4	2026-06-05	1.50	Seeded overtime	approved	manual	19	2026-06-28 18:24:50.478865+00
6	4	2026-06-08	3.00	Seeded overtime	approved	manual	21	2026-06-28 18:24:50.478865+00
7	4	2026-06-12	1.50	Seeded overtime	approved	manual	25	2026-06-28 18:24:50.478865+00
8	4	2026-06-16	2.00	Seeded overtime	approved	manual	28	2026-06-28 18:24:50.478865+00
9	4	2026-06-20	2.00	Seeded overtime	approved	manual	32	2026-06-28 18:24:50.478865+00
10	4	2026-06-25	3.00	Seeded overtime	approved	manual	35	2026-06-28 18:24:50.478865+00
11	2	2026-06-02	2.00	Seeded overtime	approved	manual	39	2026-06-28 18:24:50.478865+00
12	2	2026-06-03	3.00	Seeded overtime	approved	manual	40	2026-06-28 18:24:50.478865+00
13	2	2026-06-04	3.00	Seeded overtime	approved	manual	41	2026-06-28 18:24:50.478865+00
14	2	2026-06-10	1.50	Seeded overtime	approved	manual	46	2026-06-28 18:24:50.478865+00
15	2	2026-06-13	2.00	Seeded overtime	approved	manual	49	2026-06-28 18:24:50.478865+00
16	2	2026-06-14	1.00	Seeded overtime	approved	manual	50	2026-06-28 18:24:50.478865+00
17	2	2026-06-20	3.00	Seeded overtime	approved	manual	55	2026-06-28 18:24:50.478865+00
18	2	2026-06-21	2.00	Seeded overtime	approved	manual	56	2026-06-28 18:24:50.478865+00
19	2	2026-06-27	2.00	Seeded overtime	approved	manual	61	2026-06-28 18:24:50.478865+00
20	2	2001-06-01	1.03	Past midnight; Exceeded 9h regular duty	approved	auto	39	2026-06-29 05:58:01.278218+00
21	4	2001-06-01	0.22	Past midnight; Exceeded 9h regular duty	approved	auto	16	2026-06-29 05:58:01.793298+00
22	2	2001-06-02	1.65	Past midnight; Exceeded 9h regular duty	approved	auto	40	2026-06-29 05:58:02.175945+00
23	2	2001-06-03	2.08	Past midnight; Exceeded 9h regular duty	approved	auto	41	2026-06-29 05:58:03.151426+00
24	4	2001-06-04	0.12	Past midnight; Exceeded 9h regular duty	approved	auto	19	2026-06-29 05:58:04.978509+00
25	4	2001-06-07	1.95	Past midnight; Exceeded 9h regular duty	approved	auto	21	2026-06-29 05:58:06.979498+00
26	2	2001-06-09	0.60	Past midnight; Exceeded 9h regular duty	approved	auto	46	2026-06-29 05:58:08.415812+00
27	4	2001-06-11	0.27	Past midnight; Exceeded 9h regular duty	approved	auto	25	2026-06-29 05:58:10.520176+00
28	2	2001-06-12	0.98	Past midnight; Exceeded 9h regular duty	approved	auto	49	2026-06-29 05:58:11.085337+00
29	2	2001-06-13	5.00	Past scheduled shift end; Past midnight; Exceeded 9h regular duty	approved	auto	50	2026-06-29 05:58:12.202858+00
30	4	2001-06-15	1.07	Exceeded 9h regular duty	approved	auto	28	2026-06-29 05:58:13.508438+00
31	2	2001-06-19	2.25	Exceeded 9h regular duty	approved	auto	55	2026-06-29 05:58:16.312885+00
34	4	2001-06-24	2.03	Exceeded 9h regular duty	approved	auto	35	2026-06-29 05:58:19.156186+00
35	2	2001-06-26	0.63	Exceeded 9h regular duty	approved	auto	61	2026-06-29 05:58:21.351594+00
37	4	2001-06-28	7.00	Past scheduled shift end; Past midnight	approved	auto	64	2026-06-29 07:24:58.044565+00
38	2	2026-06-28	4.00	Restore original DTR value	approved	auto	62	2026-06-29 07:32:19.154796+00
\.
COPY public.payroll_adjustments (id, employee_id, payroll_run_id, adj_type, amount, description, approved_by, created_at) FROM stdin;
\.
COPY public.payroll_run_deferrals (id, payroll_run_id, employee_id, note, deferred_by, deferred_at) FROM stdin;
\.
COPY public.payroll_runs (id, branch_id, period_start, period_end, pay_date, run_type, pay_frequency, status, processed_by, total_gross, total_net, processed_at, created_at) FROM stdin;
2	1	2026-06-16	2026-06-30	2026-06-30	regular	semi_monthly	cancelled	2	5030.00	4171.06	\N	2026-06-28 17:45:01.860364+00
1	1	2026-06-16	2026-06-30	2026-06-30	regular	semi_monthly	cancelled	2	1660.00	1280.45	\N	2026-06-18 07:51:26.54422+00
3	1	2026-06-16	2026-06-30	2026-06-30	regular	semi_monthly	processing	2	14215.32	13606.38	\N	2026-06-28 17:50:05.470039+00
4	1	2026-06-16	2026-06-30	2026-07-01	regular	semi_monthly	processing	2	11915.32	11056.38	\N	2026-06-28 18:40:09.320769+00
5	1	2026-06-16	2026-06-30	2026-06-30	regular	semi_monthly	processing	2	12654.69	10545.75	\N	2026-06-29 07:47:05.807225+00
\.
COPY public.payslips (id, payroll_run_id, employee_id, regular_hours, overtime_hours, holiday_hours, basic_pay, overtime_pay, holiday_pay, tips_amount, service_charge, gross_pay, sss_amount, philhealth_amount, pagibig_amount, tax_amount, other_deductions, net_pay, generated_at, payment_status, paid_at) FROM stdin;
1	1	2	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	125.00	0.00	0.00	0.00	0.00	2026-06-18 07:55:10.876285+00	ready	\N
2	1	4	2.00	0.00	0.00	910.00	0.00	0.00	0.00	750.00	1660.00	0.00	125.00	4.55	0.00	250.00	1280.45	2026-06-20 02:13:50.451924+00	ready	\N
3	2	2	2.00	0.00	0.00	910.00	0.00	0.00	0.00	1550.00	2460.00	50.00	73.94	50.00	0.00	0.00	2286.06	2026-06-28 17:48:43.173111+00	ready	\N
4	2	5	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	2026-06-28 17:48:43.228503+00	ready	\N
5	2	6	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	2026-06-28 17:48:43.282491+00	ready	\N
6	2	4	4.00	0.00	0.00	1820.00	0.00	0.00	0.00	750.00	2570.00	135.00	0.00	50.00	0.00	500.00	1885.00	2026-06-28 17:48:43.357321+00	ready	\N
7	2	7	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	2026-06-28 17:48:43.410892+00	ready	\N
8	2	8	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	2026-06-28 17:48:43.465165+00	ready	\N
10	3	2	13.00	7.00	0.00	5915.00	497.66	0.00	0.00	1550.00	7962.66	50.00	73.94	50.00	0.00	0.00	7788.72	2026-06-28 18:33:44.935942+00	ready	\N
20	4	5	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	2026-06-29 05:26:23.375059+00	ready	\N
21	4	6	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	2026-06-29 05:26:23.413516+00	ready	\N
23	4	7	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	2026-06-29 05:26:23.500036+00	ready	\N
24	4	8	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	2026-06-29 05:26:23.538685+00	ready	\N
19	4	2	13.00	7.00	0.00	5915.00	497.66	0.00	0.00	0.00	6412.66	50.00	73.94	50.00	0.00	0.00	6238.72	2026-06-29 05:26:23.333587+00	emailed	\N
9	3	4	11.00	7.00	0.00	5005.00	497.66	0.00	0.00	750.00	6252.66	135.00	0.00	50.00	0.00	250.00	5817.66	2026-06-28 18:33:06.073135+00	ready	\N
22	4	4	11.00	7.00	0.00	5005.00	497.66	0.00	0.00	0.00	5502.66	135.00	0.00	50.00	0.00	500.00	4817.66	2026-06-29 06:13:26.406549+00	emailed	\N
26	5	5	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	2026-06-29 07:47:32.920386+00	ready	\N
27	5	6	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	2026-06-29 07:47:32.979559+00	ready	\N
28	5	4	12.00	7.00	0.00	5460.00	497.66	0.00	0.00	0.00	5957.66	135.00	0.00	50.00	0.00	250.00	5522.66	2026-06-29 07:47:33.039211+00	ready	\N
29	5	7	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	2026-06-29 07:47:33.095978+00	ready	\N
30	5	8	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	2026-06-29 07:47:33.153961+00	ready	\N
25	5	2	13.00	11.00	0.00	5915.00	782.03	0.00	0.00	0.00	6697.03	50.00	73.94	50.00	0.00	1500.00	5023.09	2026-06-29 07:48:12.896619+00	ready	\N
\.
COPY public.permissions (permission_id, permission_key, permission_name, module, description) FROM stdin;
1	attendance.self	Clock in/out (self)	attendance	Employee DTR
2	attendance.view	View attendance	attendance	HR attendance register
3	attendance.manage	Manage attendance	attendance	Manual entries, overtime approval
4	leave.view	View leave	leave	See balances and requests
5	leave.apply	Apply for leave	leave	Submit leave requests
6	leave.approve	Approve leave	leave	Review crew leave
7	leave.manage	Manage leave types	leave	Configure leave types
8	shifts.view.self	View own schedule	shifts	Employee roster
9	shifts.manage	Manage shifts	shifts	Templates and roster
10	documents.view.self	View own documents	documents	Service records
11	announcements.view	View announcements	content	Memos and notices
12	loans.self	Loans (self)	loans	Apply and view own loans
13	loans.manage	Manage loans	loans	HR loan review
14	payroll.view.self	View own payslips	payroll	Employee payroll
15	payroll.view	View payroll	payroll	HR payroll runs
16	payroll.manage	Manage payroll	payroll	Generate and pay runs
17	employees.view	View employees	employees	Employee directory
18	employees.manage	Manage employees	employees	HR employee records
19	reports.view	HR dashboard & reports	reports	Dashboard stats
20	users.approve	Approve registrations	users	Crew onboarding
21	users.manage	Manage users & roles	users	System user admin
22	profile.edit.self	Edit own profile	profile	Employee profile
23	settings.branches.manage	Manage branches	settings	Branch settings
24	settings.departments.manage	Manage departments	settings	Departments & positions
25	compliance.view	View compliance	compliance	Checklists and audit
26	overtime.apply	Apply for overtime	attendance	Employee OT requests
27	attendance.correct.approve	Approve attendance corrections	attendance	Review crew time-in/out correction requests
\.
COPY public.positions (id, department_id, title, pay_grade, min_hourly, max_hourly, is_tipped) FROM stdin;
1	1	HR Manager	M1	80.00	120.00	f
2	2	Line Cook	K2	70.00	95.00	f
3	3	Service Crew	S1	65.00	85.00	t
5	2	Back Kitchen	K2	72.00	100.00	f
6	2	Sous Chef	K4	90.00	125.00	f
7	2	Grill Cook	K3	80.00	115.00	f
8	2	Pastry Chef	K3	82.00	118.00	f
9	2	Kitchen Helper	K1	65.00	88.00	f
10	2	Prep Cook	K2	72.00	100.00	f
11	2	Head Cook	K4	95.00	130.00	f
12	2	Dishwasher	K1	65.00	85.00	f
13	3	Server	S2	70.00	100.00	t
14	3	Cashier	S2	72.00	95.00	f
15	3	Host	S2	68.00	92.00	f
16	3	Food Runner	S1	65.00	85.00	f
17	3	Busser	S1	62.00	82.00	f
23	5	Bartender	B3	75.00	110.00	t
24	6	Cafe Server	C2	68.00	95.00	t
25	6	Cafe Cashier	C2	70.00	92.00	f
26	6	Barista	C2	70.00	98.00	f
28	1	Restaurant Manager	M2	120.00	180.00	f
\.
COPY public.role_permissions (role_id, permission_id) FROM stdin;
1	1
1	2
1	3
1	4
1	5
1	6
1	7
1	8
1	9
1	10
1	11
1	12
1	13
1	14
1	15
1	16
1	17
1	18
1	19
1	20
1	21
1	22
1	23
1	24
1	25
1	26
1	27
2	27
3	1
3	4
3	5
3	8
3	10
3	11
3	12
3	14
3	22
3	26
2	1
2	2
2	26
2	25
2	11
2	10
2	18
2	17
2	5
2	6
2	7
2	4
2	13
2	12
2	16
2	15
2	14
2	22
2	19
2	23
2	24
2	9
2	8
2	20
2	21
2	3
\.
COPY public.roles (role_id, role_slug, role_name, description, role_type, is_system, display_order) FROM stdin;
1	admin	System Admin	Full system access	system	t	1
2	hr	HR Manager	HR operations and payroll	staff	t	2
3	employee	Employee	Self-service portal	staff	t	3
\.
COPY public.schedules (id, branch_id, week_start, status, published_by, published_at, day_footnotes) FROM stdin;
1	1	2026-06-14	published	\N	2026-06-17 17:11:37.290308+00	\N
2	1	2026-06-21	published	2	2026-06-18 03:34:19.278126+00	\N
3	1	2026-06-28	published	2	2026-06-18 03:45:48.801568+00	\N
4	1	2026-06-07	published	4	2026-06-19 07:05:37.65898+00	\N
5	1	2026-07-05	published	2	2026-06-27 20:16:29.132415+00	\N
6	1	2026-07-12	published	4	2026-06-29 19:45:55.95121+00	\N
7	1	2026-07-19	published	4	2026-07-14 21:11:52.250409+00	\N
8	1	2026-07-26	published	4	2026-07-14 21:24:19.565191+00	\N
\.
COPY public.shift_assignments (id, schedule_id, employee_id, shift_template_id, shift_date, start_time, end_time, break_mins, notes) FROM stdin;
8	1	4	\N	2026-06-18	00:00:00	00:00:00	0	REST_DAY
9	2	4	\N	2026-06-25	00:00:00	00:00:00	0	REST_DAY
10	1	4	\N	2026-06-16	00:00:00	00:00:00	0	REST_DAY
11	2	4	\N	2026-06-23	00:00:00	00:00:00	0	REST_DAY
12	1	4	\N	2026-06-14	15:00:00	00:00:00	0	\N
13	2	4	\N	2026-06-21	15:00:00	00:00:00	0	\N
14	3	4	\N	2026-06-28	15:00:00	00:00:00	0	\N
15	3	4	\N	2026-06-30	00:00:00	00:00:00	0	REST_DAY
16	3	4	\N	2026-07-02	00:00:00	00:00:00	0	REST_DAY
17	1	4	1	2026-06-15	15:00:00	00:00:00	0	\N
18	2	4	1	2026-06-22	15:00:00	00:00:00	0	\N
19	1	4	1	2026-06-17	15:00:00	00:00:00	0	\N
20	2	4	1	2026-06-24	15:00:00	00:00:00	0	\N
21	1	4	1	2026-06-19	15:00:00	00:00:00	0	\N
22	2	4	1	2026-06-26	15:00:00	00:00:00	0	\N
23	1	4	1	2026-06-20	15:00:00	00:00:00	0	\N
24	2	4	1	2026-06-27	15:00:00	00:00:00	0	\N
25	1	2	1	2026-06-14	11:00:00	20:00:00	0	\N
26	2	2	1	2026-06-21	11:00:00	20:00:00	0	\N
28	2	7	1	2026-06-21	09:00:00	06:00:00	0	\N
30	2	7	1	2026-06-22	09:00:00	06:00:00	0	\N
32	2	7	1	2026-06-23	09:00:00	06:00:00	0	\N
34	2	7	1	2026-06-24	09:00:00	06:00:00	0	\N
35	1	7	\N	2026-06-16	00:00:00	00:00:00	0	REST_DAY
37	2	7	1	2026-06-25	09:00:00	06:00:00	0	\N
39	2	7	1	2026-06-26	09:00:00	06:00:00	0	\N
41	2	7	1	2026-06-27	09:00:00	06:00:00	0	\N
42	1	7	\N	2026-06-14	09:00:00	18:00:00	0	\N
43	1	7	\N	2026-06-15	09:00:00	18:00:00	0	\N
45	1	7	\N	2026-06-18	09:00:00	18:00:00	0	\N
46	1	7	\N	2026-06-19	09:00:00	18:00:00	0	\N
47	1	7	\N	2026-06-20	09:00:00	18:00:00	0	\N
49	1	7	1	2026-06-17	09:00:00	18:00:00	0	\N
51	2	5	1	2026-06-21	09:00:00	18:00:00	0	\N
53	2	5	1	2026-06-23	09:00:00	18:00:00	0	\N
55	2	5	1	2026-06-24	09:00:00	18:00:00	0	\N
57	2	5	1	2026-06-25	09:00:00	18:00:00	0	\N
59	1	5	2	2026-06-14	15:00:00	00:00:00	0	\N
60	1	5	2	2026-06-16	15:00:00	00:00:00	0	\N
61	1	5	\N	2026-06-17	15:00:00	15:00:00	0	\N
62	1	5	1	2026-06-18	09:00:00	18:00:00	0	\N
63	3	4	1	2026-06-29	15:00:00	00:00:00	0	\N
64	3	4	1	2026-07-01	15:00:00	00:00:00	0	\N
65	3	4	1	2026-07-03	15:00:00	00:00:00	0	\N
66	3	4	1	2026-07-04	15:00:00	00:00:00	0	\N
67	3	2	1	2026-06-28	11:00:00	20:00:00	0	\N
68	3	7	1	2026-06-28	09:00:00	06:00:00	0	\N
69	3	7	1	2026-06-29	09:00:00	06:00:00	0	\N
70	3	7	1	2026-06-30	09:00:00	06:00:00	0	\N
71	3	7	1	2026-07-01	09:00:00	06:00:00	0	\N
72	3	7	1	2026-07-02	09:00:00	06:00:00	0	\N
73	3	7	1	2026-07-03	09:00:00	06:00:00	0	\N
74	3	7	1	2026-07-04	09:00:00	06:00:00	0	\N
75	3	5	1	2026-06-28	09:00:00	18:00:00	0	\N
76	3	5	1	2026-06-30	09:00:00	18:00:00	0	\N
77	3	5	1	2026-07-01	09:00:00	18:00:00	0	\N
78	3	5	1	2026-07-02	09:00:00	18:00:00	0	\N
79	5	4	\N	2026-07-05	15:00:00	00:00:00	0	\N
80	5	4	\N	2026-07-07	00:00:00	00:00:00	0	REST_DAY
81	5	4	\N	2026-07-09	00:00:00	00:00:00	0	REST_DAY
82	5	4	1	2026-07-06	15:00:00	00:00:00	0	\N
83	5	4	1	2026-07-08	15:00:00	00:00:00	0	\N
84	5	4	1	2026-07-10	15:00:00	00:00:00	0	\N
85	5	4	1	2026-07-11	15:00:00	00:00:00	0	\N
86	5	2	1	2026-07-05	11:00:00	20:00:00	0	\N
87	5	7	1	2026-07-05	09:00:00	06:00:00	0	\N
88	5	7	1	2026-07-06	09:00:00	06:00:00	0	\N
89	5	7	1	2026-07-07	09:00:00	06:00:00	0	\N
90	5	7	1	2026-07-08	09:00:00	06:00:00	0	\N
91	5	7	1	2026-07-09	09:00:00	06:00:00	0	\N
92	5	7	1	2026-07-10	09:00:00	06:00:00	0	\N
93	5	7	1	2026-07-11	09:00:00	06:00:00	0	\N
94	5	5	1	2026-07-05	09:00:00	18:00:00	0	\N
95	5	5	1	2026-07-07	09:00:00	18:00:00	0	\N
96	5	5	1	2026-07-08	09:00:00	18:00:00	0	\N
97	5	5	1	2026-07-09	09:00:00	18:00:00	0	\N
98	6	4	\N	2026-07-12	15:00:00	00:00:00	0	\N
99	6	4	\N	2026-07-14	00:00:00	00:00:00	0	REST_DAY
100	6	4	\N	2026-07-16	00:00:00	00:00:00	0	REST_DAY
101	6	4	1	2026-07-13	15:00:00	00:00:00	0	\N
102	6	4	1	2026-07-15	15:00:00	00:00:00	0	\N
103	6	4	1	2026-07-17	15:00:00	00:00:00	0	\N
104	6	4	1	2026-07-18	15:00:00	00:00:00	0	\N
105	6	2	1	2026-07-12	11:00:00	20:00:00	0	\N
106	6	7	1	2026-07-12	09:00:00	06:00:00	0	\N
107	6	7	1	2026-07-13	09:00:00	06:00:00	0	\N
108	6	7	1	2026-07-14	09:00:00	06:00:00	0	\N
109	6	7	1	2026-07-15	09:00:00	06:00:00	0	\N
110	6	7	1	2026-07-16	09:00:00	06:00:00	0	\N
111	6	7	1	2026-07-17	09:00:00	06:00:00	0	\N
112	6	7	1	2026-07-18	09:00:00	06:00:00	0	\N
113	6	5	1	2026-07-12	09:00:00	18:00:00	0	\N
114	6	5	1	2026-07-14	09:00:00	18:00:00	0	\N
115	6	5	1	2026-07-15	09:00:00	18:00:00	0	\N
116	6	5	1	2026-07-16	09:00:00	18:00:00	0	\N
117	7	4	\N	2026-07-19	15:00:00	00:00:00	0	\N
118	7	4	\N	2026-07-21	00:00:00	00:00:00	0	REST_DAY
119	7	4	\N	2026-07-23	00:00:00	00:00:00	0	REST_DAY
120	7	4	1	2026-07-20	15:00:00	00:00:00	0	\N
121	7	4	1	2026-07-22	15:00:00	00:00:00	0	\N
122	7	4	1	2026-07-24	15:00:00	00:00:00	0	\N
123	7	4	1	2026-07-25	15:00:00	00:00:00	0	\N
124	7	2	1	2026-07-19	11:00:00	20:00:00	0	\N
125	7	7	1	2026-07-19	09:00:00	06:00:00	0	\N
126	7	7	1	2026-07-20	09:00:00	06:00:00	0	\N
127	7	7	1	2026-07-21	09:00:00	06:00:00	0	\N
128	7	7	1	2026-07-22	09:00:00	06:00:00	0	\N
129	7	7	1	2026-07-23	09:00:00	06:00:00	0	\N
130	7	7	1	2026-07-24	09:00:00	06:00:00	0	\N
131	7	7	1	2026-07-25	09:00:00	06:00:00	0	\N
132	7	5	1	2026-07-19	09:00:00	18:00:00	0	\N
133	7	5	1	2026-07-21	09:00:00	18:00:00	0	\N
134	7	5	1	2026-07-22	09:00:00	18:00:00	0	\N
135	7	5	1	2026-07-23	09:00:00	18:00:00	0	\N
136	8	4	\N	2026-07-26	15:00:00	00:00:00	0	\N
137	8	4	\N	2026-07-28	00:00:00	00:00:00	0	REST_DAY
138	8	4	\N	2026-07-30	00:00:00	00:00:00	0	REST_DAY
139	8	4	1	2026-07-27	15:00:00	00:00:00	0	\N
140	8	4	1	2026-07-29	15:00:00	00:00:00	0	\N
141	8	4	1	2026-07-31	15:00:00	00:00:00	0	\N
142	8	4	1	2026-08-01	15:00:00	00:00:00	0	\N
143	8	2	1	2026-07-26	11:00:00	20:00:00	0	\N
144	8	7	1	2026-07-26	09:00:00	06:00:00	0	\N
145	8	7	1	2026-07-27	09:00:00	06:00:00	0	\N
146	8	7	1	2026-07-28	09:00:00	06:00:00	0	\N
147	8	7	1	2026-07-29	09:00:00	06:00:00	0	\N
148	8	7	1	2026-07-30	09:00:00	06:00:00	0	\N
149	8	7	1	2026-07-31	09:00:00	06:00:00	0	\N
150	8	7	1	2026-08-01	09:00:00	06:00:00	0	\N
151	8	5	1	2026-07-26	09:00:00	18:00:00	0	\N
152	8	5	1	2026-07-28	09:00:00	18:00:00	0	\N
153	8	5	1	2026-07-29	09:00:00	18:00:00	0	\N
154	8	5	1	2026-07-30	09:00:00	18:00:00	0	\N
\.
COPY public.shift_swap_requests (id, requester_assignment_id, requester_employee_id, target_employee_id, target_assignment_id, message, created_by_user_id, status, responded_at, created_at) FROM stdin;
\.
COPY public.shift_templates (id, branch_id, name, start_time, end_time, break_mins, color_hex) FROM stdin;
1	1	Morning	09:00:00	18:00:00	60	#378ADD
2	1	Afternoon	15:00:00	00:00:00	60	#1D9E75
\.
COPY public.tips_distribution (id, tips_pool_id, employee_id, percentage, amount) FROM stdin;
\.
COPY public.tips_pool (id, branch_id, pool_date, total_tips, shift_type, status) FROM stdin;
\.
COPY public.user_permissions (user_id, permission_id, grant_type) FROM stdin;
\.
COPY public.user_sessions (id, user_id, token_hash, expires_at, created_at) FROM stdin;
68	4	082ddd098de97966026b83828724d64c86d7f23e4dafc65afa9e3ccb51744f1f	2026-06-30 20:11:12.207+00	2026-06-29 20:11:12.208523+00
69	4	ca98a4970454fe1a678ddda7acf5df583c3cd0852a1dc11cb687dce28dc4f3a9	2026-06-30 20:14:45.832+00	2026-06-29 20:14:45.832773+00
70	4	6baed3288af3befbe84c44fed3bc657eabe49739ed4f2bd1ed2de7a02ef195d8	2026-07-01 22:29:20.398+00	2026-06-30 22:29:20.399799+00
71	4	1782df3d2a373ecbb94b6d132ac70b3d5e53b182759cc9acab0a06e8aa1b4c04	2026-07-01 22:29:45.328+00	2026-06-30 22:29:45.329413+00
72	4	4e729e11e17d5832f5cdc575de7dcad9f0dcdc5acfa1706ac3833927d5cc4048	2026-07-08 09:01:29.657+00	2026-07-07 09:01:29.658267+00
73	4	7de0f02d95fcaecb9b90002b35d539ed9ddabf298539d10b261e2909c46f6487	2026-07-12 20:42:36.793+00	2026-07-11 20:42:36.79512+00
74	4	5c7364fa0af7a9a08c3dc4a962c9fbfb9927542ed43a02f558ea3eca638a8a57	2026-07-12 21:30:08.159+00	2026-07-11 21:30:08.160941+00
75	4	7f7c8a0329b97403a69230266e6b6d4907f2bcef4bff20e5e7313b267043ff75	2026-07-12 21:52:57.919+00	2026-07-11 21:52:57.92092+00
77	4	9f2fdf6648c4c408d427b2a3673ba0c305a88bbd7fa7ebc4979b295432fb37c2	2026-07-12 21:57:42.35+00	2026-07-11 21:57:42.351888+00
78	4	e2993150956492c6d008573ff9f33359841bba088f94bd7c9a9ff22de61fae08	2026-07-15 20:35:52.513+00	2026-07-14 20:35:52.514359+00
79	4	fb61f696da55de93614b18e6479896248fd482656d6f04fa03aa16db6d043d0e	2026-07-15 20:47:16.467+00	2026-07-14 20:47:16.469206+00
80	4	6cca4a8b33ff48bc59637c3994bb75a3225a58f0f0b9bd636c79f7957e8f2b34	2026-07-15 21:11:48.43+00	2026-07-14 21:11:48.431121+00
81	4	9d4a09b207c93bd88a107f6ab4f109307a3a19244ad2399c174b857841b87823	2026-07-16 04:06:04.375+00	2026-07-15 04:06:04.3768+00
29	4	7a1394c3cf2386311984bd2c6a1a533639383b3f70c35c3f7e5001bc4908cad6	2026-06-19 08:58:54.559+00	2026-06-18 08:58:54.561017+00
40	2	2cc5790b29d2093a5aadc1534722fe2e731fa0835b6979496ac26ce82ae22b8e	2026-06-20 07:12:29.971+00	2026-06-19 07:12:29.972622+00
44	4	87693cd360d3fa9507da0e2244b633ff872162c7d6e5df2a12050758e2a3695c	2026-06-21 09:59:57.026+00	2026-06-20 09:59:57.027073+00
45	2	838a7f33ffb3dfc09e1863b37fc5229c0f96d708fb797f55caea5ffe606c779f	2026-06-23 03:54:30.96+00	2026-06-22 03:54:30.961699+00
47	4	f8c584e5ea3231f11f2a97f448a167652b64f4b5aa0513457d02da8f6b03936d	2026-06-28 20:17:00.291+00	2026-06-27 20:17:00.291564+00
49	4	9b343b1712ab0cbf723bd36bc24f17838e115dea271f6467c1126cb902897c42	2026-06-29 17:29:51.647+00	2026-06-28 17:29:51.647671+00
51	2	a0655f51f4178a07e55b3dedae4f3debdb630089e9f10550fefceb845ba11970	2026-06-29 17:38:39.552+00	2026-06-28 17:38:39.552755+00
\.
COPY public.users (id, email, password_hash, role_id, employee_id, is_active, account_status, activated_at, activated_by, approved_at, approved_by, last_login_at, created_at) FROM stdin;
4	dareyes@my.cspc.edu.ph	dsadsadsa	3	4	t	active	2026-06-18 03:38:11.085072+00	2	2026-06-18 03:34:33.699509+00	2	2026-07-15 04:06:04.398576+00	2026-06-18 03:09:40.009224+00
5	ramreginaldo1985@gmail.com	198521	3	5	t	active	2026-06-19 08:52:41.46321+00	2	2026-06-19 08:52:36.801669+00	2	\N	2026-06-19 08:24:11.161435+00
6	mediadorose@gmail.com	252917	3	6	t	active	2026-06-19 08:52:42.596372+00	2	2026-06-19 08:52:35.819784+00	2	\N	2026-06-19 08:29:03.718395+00
7	madridanoarnel53@gmail.com	arnel2000	3	7	t	active	2026-06-19 08:52:43.40986+00	2	2026-06-19 08:52:38.021149+00	2	\N	2026-06-19 08:30:42.728795+00
8	glocelynesplago2@gmail.com	Jameslyn042123	3	8	t	active	2026-06-19 08:52:44.192181+00	2	2026-06-19 08:52:39.014121+00	2	\N	2026-06-19 08:40:00.007989+00
1	admin@highwaygrill.com	$2b$10$bqNP7HI5iOCKpoyRn0czkObfX2bEL9.NWqpSg3PNYrFEtImQ/wEVe	1	\N	t	active	2026-06-17 17:11:37.290308+00	\N	\N	\N	2026-06-19 09:17:12.522521+00	2026-06-17 17:11:37.290308+00
2	hr@highwaygrill.com	dsadsadsa	2	2	t	active	2026-06-17 17:11:37.290308+00	\N	\N	\N	2026-06-29 20:10:30.10139+00	2026-06-17 17:11:37.290308+00
\.
SELECT pg_catalog.setval('public.announcements_id_seq', 2, true);
SELECT pg_catalog.setval('public.attendance_correction_requests_id_seq', 1, false);
SELECT pg_catalog.setval('public.attendance_id_seq', 65, true);
SELECT pg_catalog.setval('public.audit_logs_id_seq', 9, true);
SELECT pg_catalog.setval('public.branches_id_seq', 2, true);
SELECT pg_catalog.setval('public.compliance_checklists_id_seq', 3, true);
SELECT pg_catalog.setval('public.compliance_logs_id_seq', 1, false);
SELECT pg_catalog.setval('public.departments_id_seq', 7, true);
SELECT pg_catalog.setval('public.documents_id_seq', 3, true);
SELECT pg_catalog.setval('public.employee_bank_accounts_id_seq', 1, false);
SELECT pg_catalog.setval('public.employee_benefit_enrollments_id_seq', 4, true);
SELECT pg_catalog.setval('public.employee_contracts_id_seq', 1, false);
SELECT pg_catalog.setval('public.employee_loans_id_seq', 1, true);
SELECT pg_catalog.setval('public.employees_id_seq', 8, true);
SELECT pg_catalog.setval('public.field_work_checkins_id_seq', 1, false);
SELECT pg_catalog.setval('public.field_work_sites_id_seq', 2, true);
SELECT pg_catalog.setval('public.holidays_id_seq', 1, true);
SELECT pg_catalog.setval('public.leave_balances_id_seq', 24, true);
SELECT pg_catalog.setval('public.leave_requests_id_seq', 1, false);
SELECT pg_catalog.setval('public.leave_types_id_seq', 4, true);
SELECT pg_catalog.setval('public.loan_payments_id_seq', 3, true);
SELECT pg_catalog.setval('public.notifications_id_seq', 15, true);
SELECT pg_catalog.setval('public.overtime_requests_id_seq', 38, true);
SELECT pg_catalog.setval('public.payroll_adjustments_id_seq', 2, true);
SELECT pg_catalog.setval('public.payroll_run_deferrals_id_seq', 1, false);
SELECT pg_catalog.setval('public.payroll_runs_id_seq', 5, true);
SELECT pg_catalog.setval('public.payslips_id_seq', 30, true);
SELECT pg_catalog.setval('public.permissions_permission_id_seq', 26, true);
SELECT pg_catalog.setval('public.positions_id_seq', 28, true);
SELECT pg_catalog.setval('public.roles_role_id_seq', 3, true);
SELECT pg_catalog.setval('public.schedules_id_seq', 8, true);
SELECT pg_catalog.setval('public.shift_assignments_id_seq', 154, true);
SELECT pg_catalog.setval('public.shift_swap_requests_id_seq', 1, false);
SELECT pg_catalog.setval('public.shift_templates_id_seq', 3, true);
SELECT pg_catalog.setval('public.tips_distribution_id_seq', 1, false);
SELECT pg_catalog.setval('public.tips_pool_id_seq', 1, false);
SELECT pg_catalog.setval('public.user_sessions_id_seq', 81, true);
SELECT pg_catalog.setval('public.users_id_seq', 8, true);
ALTER TABLE ONLY public.announcements
    ADD CONSTRAINT announcements_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.attendance_correction_requests
    ADD CONSTRAINT attendance_correction_requests_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.attendance
    ADD CONSTRAINT attendance_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.branches
    ADD CONSTRAINT branches_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.compliance_checklists
    ADD CONSTRAINT compliance_checklists_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.compliance_logs
    ADD CONSTRAINT compliance_logs_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.employee_bank_accounts
    ADD CONSTRAINT employee_bank_accounts_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.employee_benefit_enrollments
    ADD CONSTRAINT employee_benefit_enrollments_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.employee_contracts
    ADD CONSTRAINT employee_contracts_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.employee_government_profiles
    ADD CONSTRAINT employee_government_profiles_pkey PRIMARY KEY (employee_id);
ALTER TABLE ONLY public.employee_loans
    ADD CONSTRAINT employee_loans_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_emp_number_key UNIQUE (emp_number);
ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.field_work_checkins
    ADD CONSTRAINT field_work_checkins_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.field_work_sites
    ADD CONSTRAINT field_work_sites_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.holidays
    ADD CONSTRAINT holidays_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.leave_balances
    ADD CONSTRAINT leave_balances_employee_id_leave_type_id_year_key UNIQUE (employee_id, leave_type_id, year);
ALTER TABLE ONLY public.leave_balances
    ADD CONSTRAINT leave_balances_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.leave_types
    ADD CONSTRAINT leave_types_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.loan_payments
    ADD CONSTRAINT loan_payments_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.overtime_requests
    ADD CONSTRAINT overtime_requests_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.payroll_adjustments
    ADD CONSTRAINT payroll_adjustments_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.payroll_run_deferrals
    ADD CONSTRAINT payroll_run_deferrals_payroll_run_id_employee_id_key UNIQUE (payroll_run_id, employee_id);
ALTER TABLE ONLY public.payroll_run_deferrals
    ADD CONSTRAINT payroll_run_deferrals_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.payroll_runs
    ADD CONSTRAINT payroll_runs_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.payslips
    ADD CONSTRAINT payslips_payroll_run_id_employee_id_key UNIQUE (payroll_run_id, employee_id);
ALTER TABLE ONLY public.payslips
    ADD CONSTRAINT payslips_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_permission_key_key UNIQUE (permission_key);
ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_pkey PRIMARY KEY (permission_id);
ALTER TABLE ONLY public.positions
    ADD CONSTRAINT positions_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (role_id, permission_id);
ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (role_id);
ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_role_slug_key UNIQUE (role_slug);
ALTER TABLE ONLY public.schedules
    ADD CONSTRAINT schedules_branch_id_week_start_key UNIQUE (branch_id, week_start);
ALTER TABLE ONLY public.schedules
    ADD CONSTRAINT schedules_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.shift_assignments
    ADD CONSTRAINT shift_assignments_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.shift_assignments
    ADD CONSTRAINT shift_assignments_schedule_id_employee_id_shift_date_key UNIQUE (schedule_id, employee_id, shift_date);
ALTER TABLE ONLY public.shift_swap_requests
    ADD CONSTRAINT shift_swap_requests_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.shift_templates
    ADD CONSTRAINT shift_templates_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.tips_distribution
    ADD CONSTRAINT tips_distribution_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.tips_pool
    ADD CONSTRAINT tips_pool_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.user_permissions
    ADD CONSTRAINT user_permissions_pkey PRIMARY KEY (user_id, permission_id);
ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT user_sessions_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);
ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);
CREATE INDEX idx_attendance_corrections_employee ON public.attendance_correction_requests USING btree (employee_id, created_at DESC);
CREATE INDEX idx_attendance_corrections_status ON public.attendance_correction_requests USING btree (status, created_at DESC);
CREATE INDEX idx_attendance_employee_clock ON public.attendance USING btree (employee_id, clock_in);
CREATE INDEX idx_audit_logs_created ON public.audit_logs USING btree (created_at DESC);
CREATE INDEX idx_benefit_enrollments_employee ON public.employee_benefit_enrollments USING btree (employee_id);
CREATE INDEX idx_employees_branch ON public.employees USING btree (branch_id);
CREATE INDEX idx_employees_status ON public.employees USING btree (status);
CREATE INDEX idx_notifications_user ON public.notifications USING btree (user_id, is_read);
CREATE INDEX idx_shift_assignments_date ON public.shift_assignments USING btree (shift_date);
CREATE INDEX idx_user_sessions_token ON public.user_sessions USING btree (token_hash);
CREATE INDEX idx_user_sessions_user ON public.user_sessions USING btree (user_id);
CREATE TRIGGER employee_government_profiles_updated_at BEFORE UPDATE ON public.employee_government_profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE ONLY public.announcements
    ADD CONSTRAINT announcements_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.announcements
    ADD CONSTRAINT announcements_posted_by_fkey FOREIGN KEY (posted_by) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.attendance
    ADD CONSTRAINT attendance_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.attendance_correction_requests
    ADD CONSTRAINT attendance_correction_requests_attendance_id_fkey FOREIGN KEY (attendance_id) REFERENCES public.attendance(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.attendance_correction_requests
    ADD CONSTRAINT attendance_correction_requests_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.attendance_correction_requests
    ADD CONSTRAINT attendance_correction_requests_resolved_attendance_id_fkey FOREIGN KEY (resolved_attendance_id) REFERENCES public.attendance(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.attendance_correction_requests
    ADD CONSTRAINT attendance_correction_requests_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.attendance
    ADD CONSTRAINT attendance_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.compliance_logs
    ADD CONSTRAINT compliance_logs_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.compliance_logs
    ADD CONSTRAINT compliance_logs_checklist_id_fkey FOREIGN KEY (checklist_id) REFERENCES public.compliance_checklists(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.compliance_logs
    ADD CONSTRAINT compliance_logs_completed_by_fkey FOREIGN KEY (completed_by) REFERENCES public.employees(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.employee_bank_accounts
    ADD CONSTRAINT employee_bank_accounts_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.employee_benefit_enrollments
    ADD CONSTRAINT employee_benefit_enrollments_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.employee_contracts
    ADD CONSTRAINT employee_contracts_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.employee_government_profiles
    ADD CONSTRAINT employee_government_profiles_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.employee_loans
    ADD CONSTRAINT employee_loans_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.employee_loans
    ADD CONSTRAINT employee_loans_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);
ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_position_id_fkey FOREIGN KEY (position_id) REFERENCES public.positions(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.field_work_checkins
    ADD CONSTRAINT field_work_checkins_attendance_id_fkey FOREIGN KEY (attendance_id) REFERENCES public.attendance(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.field_work_checkins
    ADD CONSTRAINT field_work_checkins_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.field_work_checkins
    ADD CONSTRAINT field_work_checkins_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.field_work_sites(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.field_work_sites
    ADD CONSTRAINT field_work_sites_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.attendance
    ADD CONSTRAINT fk_attendance_shift FOREIGN KEY (shift_assignment_id) REFERENCES public.shift_assignments(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.branches
    ADD CONSTRAINT fk_branches_manager FOREIGN KEY (manager_id) REFERENCES public.employees(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.employee_contracts
    ADD CONSTRAINT fk_contracts_document FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.departments
    ADD CONSTRAINT fk_departments_head FOREIGN KEY (head_id) REFERENCES public.employees(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.users
    ADD CONSTRAINT fk_users_employee FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.holidays
    ADD CONSTRAINT holidays_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.leave_balances
    ADD CONSTRAINT leave_balances_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.leave_balances
    ADD CONSTRAINT leave_balances_leave_type_id_fkey FOREIGN KEY (leave_type_id) REFERENCES public.leave_types(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_leave_type_id_fkey FOREIGN KEY (leave_type_id) REFERENCES public.leave_types(id);
ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.loan_payments
    ADD CONSTRAINT loan_payments_loan_id_fkey FOREIGN KEY (loan_id) REFERENCES public.employee_loans(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.overtime_requests
    ADD CONSTRAINT overtime_requests_attendance_id_fkey FOREIGN KEY (attendance_id) REFERENCES public.attendance(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.overtime_requests
    ADD CONSTRAINT overtime_requests_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.payroll_adjustments
    ADD CONSTRAINT payroll_adjustments_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.payroll_adjustments
    ADD CONSTRAINT payroll_adjustments_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.payroll_adjustments
    ADD CONSTRAINT payroll_adjustments_payroll_run_id_fkey FOREIGN KEY (payroll_run_id) REFERENCES public.payroll_runs(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.payroll_run_deferrals
    ADD CONSTRAINT payroll_run_deferrals_deferred_by_fkey FOREIGN KEY (deferred_by) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.payroll_run_deferrals
    ADD CONSTRAINT payroll_run_deferrals_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.payroll_run_deferrals
    ADD CONSTRAINT payroll_run_deferrals_payroll_run_id_fkey FOREIGN KEY (payroll_run_id) REFERENCES public.payroll_runs(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.payroll_runs
    ADD CONSTRAINT payroll_runs_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.payroll_runs
    ADD CONSTRAINT payroll_runs_processed_by_fkey FOREIGN KEY (processed_by) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.payslips
    ADD CONSTRAINT payslips_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.payslips
    ADD CONSTRAINT payslips_payroll_run_id_fkey FOREIGN KEY (payroll_run_id) REFERENCES public.payroll_runs(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.positions
    ADD CONSTRAINT positions_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES public.permissions(permission_id) ON DELETE CASCADE;
ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(role_id) ON DELETE CASCADE;
ALTER TABLE ONLY public.schedules
    ADD CONSTRAINT schedules_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.schedules
    ADD CONSTRAINT schedules_published_by_fkey FOREIGN KEY (published_by) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.shift_assignments
    ADD CONSTRAINT shift_assignments_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.shift_assignments
    ADD CONSTRAINT shift_assignments_schedule_id_fkey FOREIGN KEY (schedule_id) REFERENCES public.schedules(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.shift_assignments
    ADD CONSTRAINT shift_assignments_shift_template_id_fkey FOREIGN KEY (shift_template_id) REFERENCES public.shift_templates(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.shift_swap_requests
    ADD CONSTRAINT shift_swap_requests_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.shift_swap_requests
    ADD CONSTRAINT shift_swap_requests_requester_assignment_id_fkey FOREIGN KEY (requester_assignment_id) REFERENCES public.shift_assignments(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.shift_swap_requests
    ADD CONSTRAINT shift_swap_requests_requester_employee_id_fkey FOREIGN KEY (requester_employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.shift_swap_requests
    ADD CONSTRAINT shift_swap_requests_target_assignment_id_fkey FOREIGN KEY (target_assignment_id) REFERENCES public.shift_assignments(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.shift_swap_requests
    ADD CONSTRAINT shift_swap_requests_target_employee_id_fkey FOREIGN KEY (target_employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.shift_templates
    ADD CONSTRAINT shift_templates_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.tips_distribution
    ADD CONSTRAINT tips_distribution_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.tips_distribution
    ADD CONSTRAINT tips_distribution_tips_pool_id_fkey FOREIGN KEY (tips_pool_id) REFERENCES public.tips_pool(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.tips_pool
    ADD CONSTRAINT tips_pool_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.user_permissions
    ADD CONSTRAINT user_permissions_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES public.permissions(permission_id) ON DELETE CASCADE;
ALTER TABLE ONLY public.user_permissions
    ADD CONSTRAINT user_permissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT user_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_activated_by_fkey FOREIGN KEY (activated_by) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(role_id);
\unrestrict BxfTL2IWFkPPyUfKcOYoXv8gOs26ZOqknZE2qLWDqrUiz1OEFN1uE7d4niqe5Pb
