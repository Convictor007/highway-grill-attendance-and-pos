<?php

declare(strict_types=1);

namespace Hg\Api\Modules\Auth;

use Hg\Api\Core\Auth;
use Hg\Api\Core\Database;
use Hg\Api\Core\EmailService;
use Hg\Api\Modules\Employees\EmployeeService;
use Hg\Api\Modules\Notifications\NotificationService;

final class RegistrationService
{
    public function registerOptions(?string $branchId = null): array
    {
        $pdo = Database::connection();
        $branches = $pdo->query(
            'SELECT id, name FROM branches WHERE is_active = 1 ORDER BY name'
        )->fetchAll();

        $departments = [];
        $positions = [];
        if ($branchId !== null && $branchId !== '') {
            $deptStmt = $pdo->prepare(
                "SELECT id, branch_id, name FROM departments
                 WHERE branch_id = :bid AND name != 'Management'
                 ORDER BY name"
            );
            $deptStmt->execute(['bid' => $branchId]);
            $departments = $deptStmt->fetchAll();

            $posStmt = $pdo->prepare(
                "SELECT p.id, p.department_id, p.title, p.pay_grade, p.is_tipped, d.name AS department_name
                 FROM positions p
                 INNER JOIN departments d ON d.id = p.department_id
                 WHERE d.branch_id = :bid
                   AND d.name != 'Management'
                 ORDER BY d.name, p.title"
            );
            $posStmt->execute(['bid' => $branchId]);
            $positions = $posStmt->fetchAll();
        }

        return [
            'branches' => $branches,
            'departments' => $departments,
            'positions' => $positions,
        ];
    }

    public function register(array $data): array
    {
        $email = strtolower(trim((string) ($data['email'] ?? '')));
        $password = (string) ($data['password'] ?? '');
        $firstName = trim((string) ($data['first_name'] ?? ''));
        $lastName = trim((string) ($data['last_name'] ?? ''));
        $branchId = trim((string) ($data['branch_id'] ?? ''));
        $phone = trim((string) ($data['phone'] ?? ''));

        if ($email === '' || $password === '' || $firstName === '' || $lastName === '' || $branchId === '') {
            throw new \InvalidArgumentException('email, password, first_name, last_name, and branch_id are required');
        }
        if (strlen($password) < 6) {
            throw new \InvalidArgumentException('Password must be at least 6 characters');
        }

        $pdo = Database::connection();
        $employeeService = new EmployeeService();

        $branch = $pdo->prepare('SELECT id, name FROM branches WHERE id = :id AND is_active = 1 LIMIT 1');
        $branch->execute(['id' => $branchId]);
        if (!$branch->fetch()) {
            throw new \InvalidArgumentException('Invalid branch');
        }

        $employeeService->validatePositionForBranch(
            $branchId,
            $data['department_id'] ?? null,
            $data['position_id'] ?? null
        );

        $exists = $pdo->prepare('SELECT id FROM users WHERE email = :email LIMIT 1');
        $exists->execute(['email' => $email]);
        if ($exists->fetch()) {
            throw new \RuntimeException('Email already registered');
        }

        $empExists = $pdo->prepare('SELECT id FROM employees WHERE email = :email LIMIT 1');
        $empExists->execute(['email' => $email]);
        if ($empExists->fetch()) {
            throw new \RuntimeException('Email already used on an employee record');
        }

        $roleStmt = $pdo->prepare('SELECT role_id FROM roles WHERE role_slug = :slug LIMIT 1');
        $roleStmt->execute(['slug' => 'employee']);
        $roleId = (int) $roleStmt->fetchColumn();
        if ($roleId < 1) {
            throw new \RuntimeException('Employee role not configured');
        }

        $empNumber = $this->nextEmpNumber($pdo);
        $employeeId = Database::uuid();
        $userId = Database::uuid();

        $employmentType = (string) ($data['employment_type'] ?? 'full_time');
        if (!in_array($employmentType, ['full_time', 'part_time', 'casual', 'seasonal'], true)) {
            $employmentType = 'full_time';
        }

        $gender = $data['gender'] ?? null;
        if ($gender !== null && $gender !== '') {
            $gender = (string) $gender;
            if (!in_array($gender, ['male', 'female', 'other', 'prefer_not'], true)) {
                throw new \InvalidArgumentException('Invalid gender');
            }
        } else {
            $gender = null;
        }

        $dob = trim((string) ($data['date_of_birth'] ?? ''));
        if ($dob !== '' && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $dob)) {
            throw new \InvalidArgumentException('date_of_birth must be YYYY-MM-DD');
        }

        $pdo->beginTransaction();
        try {
            $pdo->prepare(
                'INSERT INTO employees (id, branch_id, department_id, position_id, emp_number, first_name, last_name,
                 email, phone, hire_date, employment_type, status, date_of_birth, gender, nationality,
                 address, emergency_name, emergency_phone)
                 VALUES (:id, :bid, :did, :pid, :num, :fn, :ln, :email, :phone, CURDATE(), :etype, \'pending\',
                 :dob, :gender, :nationality, :address, :emergency_name, :emergency_phone)'
            )->execute([
                'id' => $employeeId,
                'bid' => $branchId,
                'did' => ($data['department_id'] ?? '') !== '' ? $data['department_id'] : null,
                'pid' => ($data['position_id'] ?? '') !== '' ? $data['position_id'] : null,
                'num' => $empNumber,
                'fn' => $firstName,
                'ln' => $lastName,
                'email' => $email,
                'phone' => $phone !== '' ? $phone : null,
                'etype' => $employmentType,
                'dob' => $dob !== '' ? $dob : null,
                'gender' => $gender,
                'nationality' => trim((string) ($data['nationality'] ?? '')) ?: 'Filipino',
                'address' => trim((string) ($data['address'] ?? '')) ?: null,
                'emergency_name' => trim((string) ($data['emergency_name'] ?? '')) ?: null,
                'emergency_phone' => trim((string) ($data['emergency_phone'] ?? '')) ?: null,
            ]);

            $pdo->prepare(
                'INSERT INTO users (id, email, password_hash, role_id, employee_id, is_active, account_status)
                 VALUES (:id, :email, :pass, :rid, :eid, 0, \'awaiting_hr\')'
            )->execute([
                'id' => $userId,
                'email' => $email,
                'pass' => Auth::hashPassword($password),
                'rid' => $roleId,
                'eid' => $employeeId,
            ]);

            $pdo->commit();
        } catch (\Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }

        $fullName = "{$firstName} {$lastName}";
        $positionTitle = '';
        if (!empty($data['position_id'])) {
            $pos = $pdo->prepare('SELECT title FROM positions WHERE id = :id LIMIT 1');
            $pos->execute(['id' => $data['position_id']]);
            $positionTitle = (string) ($pos->fetchColumn() ?: '');
        }
        $this->notifyHrOfRegistration($userId, $fullName, $email, $empNumber, $positionTitle);

        return [
            'message' => 'Registration submitted. HR will review your application and notify you by email when you can sign in.',
            'emp_number' => $empNumber,
            'account_status' => 'awaiting_hr',
        ];
    }

    private function nextEmpNumber(\PDO $pdo): string
    {
        $stmt = $pdo->query(
            "SELECT emp_number FROM employees
             WHERE emp_number REGEXP '^HG-[0-9]+$'
             ORDER BY CAST(SUBSTRING(emp_number, 4) AS UNSIGNED) DESC
             LIMIT 1"
        );
        $last = $stmt->fetchColumn();
        $n = 200;
        if (is_string($last) && preg_match('/^HG-(\d+)$/', $last, $m)) {
            $n = (int) $m[1] + 1;
        }
        return 'HG-' . $n;
    }

    private function notifyHrOfRegistration(
        string $userId,
        string $fullName,
        string $email,
        string $empNumber,
        string $positionTitle
    ): void {
        $notifications = new NotificationService();
        $hrIds = $this->hrApproverUserIds();
        $title = 'New employee registration';
        $role = $positionTitle !== '' ? " applying as {$positionTitle}" : '';
        $body = "{$fullName} ({$empNumber}){$role} registered with {$email}. Review under Users → Pending registrations.";
        $notifications->notifyUserIds($hrIds, 'registration_pending', $title, $body, $userId, '/users');

        $config = require dirname(__DIR__, 2) . '/config/config.php';
        $hrEmail = (string) ($config['hr_notify_email'] ?? '');
        if ($hrEmail !== '') {
            EmailService::send(
                $hrEmail,
                $title,
                "{$body}\n\nOpen the HRMS Users page to approve or reject this application."
            );
        }
    }

    /** @return list<string> */
    private function hrApproverUserIds(): array
    {
        $stmt = Database::connection()->query(
            'SELECT DISTINCT u.id
             FROM users u
             INNER JOIN role_permissions rp ON rp.role_id = u.role_id
             INNER JOIN permissions p ON p.permission_id = rp.permission_id
             WHERE p.permission_key = \'users.manage\'
               AND u.is_active = 1
               AND u.account_status = \'active\''
        );
        return array_column($stmt->fetchAll(), 'id');
    }
}
