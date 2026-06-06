USE highway_grill_hrms;

CREATE TABLE IF NOT EXISTS notifications (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    user_id CHAR(36) NOT NULL,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(200) NOT NULL,
    body TEXT,
    link VARCHAR(255) NULL,
    related_id CHAR(36) NULL,
    is_read TINYINT(1) NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_notifications_user (user_id, is_read, created_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS shift_swap_requests (
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
    FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_swap_target_status (target_employee_id, status),
    INDEX idx_swap_requester (requester_employee_id, status)
) ENGINE=InnoDB;
