<?php

declare(strict_types=1);

namespace Hg\Api\Modules\Users;

use Hg\Api\Core\Auth;
use Hg\Api\Core\Database;
use Hg\Api\Core\EmailService;
use Hg\Api\Modules\Leave\LeaveService;
use Hg\Api\Modules\Notifications\NotificationService;

final class UserService
{
    private const USER_SELECT = 'SELECT u.id, u.email, u.is_active, u.account_status, u.employee_id, u.role_id,
                    u.last_login_at, u.approved_at, u.activated_at,
                    r.role_slug, r.role_name,
                    e.emp_number, e.first_name, e.last_name, e.status AS employee_status,
                    e.photo_url, e.gender, e.phone, e.is_stay_in, e.housing_deduction,
                    p.title AS position_title';

    public function list(?string $accountStatus = null): array
    {
        $sql = self::USER_SELECT . '
             FROM users u
             INNER JOIN roles r ON r.role_id = u.role_id
             LEFT JOIN employees e ON e.id = u.employee_id
             LEFT JOIN positions p ON p.id = e.position_id
             WHERE 1=1';
        $params = [];
        if ($accountStatus !== null && $accountStatus !== '') {
            $sql .= ' AND u.account_status = :st';
            $params['st'] = $accountStatus;
        }
        $sql .= ' ORDER BY u.email';
        $stmt = Database::connection()->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll();
    }

    public function listPendingRegistrations(): array
    {
        $stmt = Database::connection()->prepare(
            self::USER_SELECT . '
             FROM users u
             INNER JOIN roles r ON r.role_id = u.role_id
             LEFT JOIN employees e ON e.id = u.employee_id
             LEFT JOIN positions p ON p.id = e.position_id
             WHERE u.account_status IN (\'awaiting_hr\', \'pending\')
             ORDER BY u.created_at ASC'
        );
        $stmt->execute();
        return $stmt->fetchAll();
    }

    public function create(array $data): array
    {
        $pdo = Database::connection();
        $email = trim((string) ($data['email'] ?? ''));
        $password = (string) ($data['password'] ?? '');
        $roleId = (int) ($data['role_id'] ?? 0);
        if ($email === '' || $password === '' || $roleId < 1) {
            throw new \InvalidArgumentException('email, password, and role_id required');
        }

        $exists = $pdo->prepare('SELECT id FROM users WHERE email = :email LIMIT 1');
        $exists->execute(['email' => $email]);
        if ($exists->fetch()) {
            throw new \RuntimeException('Email already registered');
        }

        $accountStatus = (string) ($data['account_status'] ?? 'active');
        if (!in_array($accountStatus, ['awaiting_hr', 'pending', 'active', 'rejected'], true)) {
            $accountStatus = 'active';
        }

        $id = Database::uuid();
        $pdo->prepare(
            'INSERT INTO users (id, email, password_hash, role_id, employee_id, is_active, account_status, activated_at)
             VALUES (:id, :email, :pass, :rid, :eid, :active, :st, :activated)'
        )->execute([
            'id' => $id,
            'email' => $email,
            'pass' => Auth::hashPassword($password),
            'rid' => $roleId,
            'eid' => $data['employee_id'] ?? null,
            'active' => $accountStatus === 'active' || $accountStatus === 'pending' ? 1 : 0,
            'st' => $accountStatus,
            'activated' => $accountStatus === 'active' ? date('Y-m-d H:i:s') : null,
        ]);

        return $this->get($id);
    }

    public function get(string $id): array
    {
        $stmt = Database::connection()->prepare(
            self::USER_SELECT . '
             FROM users u
             INNER JOIN roles r ON r.role_id = u.role_id
             LEFT JOIN employees e ON e.id = u.employee_id
             LEFT JOIN positions p ON p.id = e.position_id
             WHERE u.id = :id LIMIT 1'
        );
        $stmt->execute(['id' => $id]);
        $row = $stmt->fetch();
        if (!$row) {
            throw new \RuntimeException('User not found');
        }
        return $row;
    }

    public function update(string $id, array $data): array
    {
        $pdo = Database::connection();
        if (!empty($data['password'])) {
            $pdo->prepare('UPDATE users SET password_hash = :p WHERE id = :id')
                ->execute(['p' => Auth::hashPassword((string) $data['password']), 'id' => $id]);
        }
        if (isset($data['role_id'])) {
            $pdo->prepare('UPDATE users SET role_id = :r WHERE id = :id')
                ->execute(['r' => (int) $data['role_id'], 'id' => $id]);
        }
        if (array_key_exists('employee_id', $data)) {
            $eid = $data['employee_id'];
            $eid = ($eid === '' || $eid === null) ? null : (string) $eid;
            $pdo->prepare('UPDATE users SET employee_id = :e WHERE id = :id')
                ->execute(['e' => $eid, 'id' => $id]);
        }
        if (isset($data['is_active'])) {
            $pdo->prepare('UPDATE users SET is_active = :a WHERE id = :id')
                ->execute(['a' => $data['is_active'] ? 1 : 0, 'id' => $id]);
        }
        if (isset($data['account_status'])) {
            $st = (string) $data['account_status'];
            if (in_array($st, ['awaiting_hr', 'pending', 'active', 'rejected'], true)) {
                $pdo->prepare('UPDATE users SET account_status = :st WHERE id = :id')
                    ->execute(['st' => $st, 'id' => $id]);
            }
        }
        return $this->get($id);
    }

    /** HR accepts registration — applicant can sign in (pending) but cannot clock in yet. */
    public function approveRegistration(string $userId, string $hrUserId): array
    {
        $user = $this->get($userId);
        if (($user['account_status'] ?? '') !== 'awaiting_hr') {
            throw new \RuntimeException('Only awaiting HR registrations can be approved');
        }
        if (($user['role_slug'] ?? '') !== 'employee') {
            throw new \RuntimeException('Only employee registrations use this workflow');
        }

        $pdo = Database::connection();
        $pdo->prepare(
            'UPDATE users SET account_status = \'pending\', is_active = 1, approved_at = NOW(), approved_by = :hr
             WHERE id = :id'
        )->execute(['id' => $userId, 'hr' => $hrUserId]);

        $this->notifyApplicant(
            $userId,
            $user['email'],
            'Registration approved — you can sign in',
            'HR has approved your Highway Grill registration. Sign in to your account. '
            . 'Your status is pending until HR activates you for time clock, schedules, and payroll.',
            'registration_approved'
        );

        return $this->get($userId);
    }

    /** HR fully activates employee — clock in, schedules, loans enabled. */
    public function activateEmployee(string $userId, string $hrUserId): array
    {
        $user = $this->get($userId);
        $status = $user['account_status'] ?? '';
        if (!in_array($status, ['pending', 'awaiting_hr'], true)) {
            throw new \RuntimeException('Only pending employees can be activated');
        }
        if (empty($user['employee_id'])) {
            throw new \RuntimeException('User is not linked to an employee record');
        }

        $pdo = Database::connection();
        $pdo->beginTransaction();
        try {
            $pdo->prepare(
                'UPDATE users SET account_status = \'active\', is_active = 1,
                 approved_at = COALESCE(approved_at, NOW()), approved_by = COALESCE(approved_by, :hr),
                 activated_at = NOW(), activated_by = :hr2
                 WHERE id = :id'
            )->execute(['id' => $userId, 'hr' => $hrUserId, 'hr2' => $hrUserId]);

            $pdo->prepare(
                'UPDATE employees SET status = \'active\' WHERE id = :eid AND status = \'pending\''
            )->execute(['eid' => $user['employee_id']]);

            $pdo->commit();
        } catch (\Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }

        (new LeaveService())->ensureBalancesForEmployee((string) $user['employee_id'], (int) date('Y'));

        $name = trim(($user['first_name'] ?? '') . ' ' . ($user['last_name'] ?? ''));
        $this->notifyApplicant(
            $userId,
            $user['email'],
            'Account activated — you can clock in',
            "Hi {$name}, your employee account is now active. You can time in/out, view your schedule, apply for leave, and access payroll.",
            'registration_activated'
        );

        return $this->get($userId);
    }

    public function rejectRegistration(string $userId, string $hrUserId, ?string $reason = null): array
    {
        $user = $this->get($userId);
        if (!in_array($user['account_status'] ?? '', ['awaiting_hr', 'pending'], true)) {
            throw new \RuntimeException('Only pending registrations can be rejected');
        }

        $pdo = Database::connection();
        $pdo->prepare(
            'UPDATE users SET account_status = \'rejected\', is_active = 0, approved_by = :hr WHERE id = :id'
        )->execute(['id' => $userId, 'hr' => $hrUserId]);

        if (!empty($user['employee_id'])) {
            $pdo->prepare(
                'UPDATE employees SET status = \'terminated\' WHERE id = :eid AND status IN (\'pending\', \'active\')'
            )->execute(['eid' => $user['employee_id']]);
        }

        $note = $reason ? " Reason: {$reason}" : '';
        $this->notifyApplicant(
            $userId,
            $user['email'],
            'Registration not approved',
            'Your Highway Grill registration was not approved.' . $note,
            'registration_rejected'
        );

        return $this->get($userId);
    }

    private function notifyApplicant(
        string $userId,
        string $email,
        string $title,
        string $body,
        string $type
    ): void {
        (new NotificationService())->create($userId, $type, $title, $body, $userId, '/');
        EmailService::send($email, $title, $body);
    }
}
