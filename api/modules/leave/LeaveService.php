<?php

declare(strict_types=1);

namespace Hg\Api\Modules\Leave;

use Hg\Api\Core\Database;
use Hg\Api\Modules\Notifications\NotificationService;

final class LeaveService
{
    public function __construct(
        private readonly NotificationService $notifications = new NotificationService(),
    ) {}

    public function types(): array
    {
        return Database::connection()->query('SELECT * FROM leave_types ORDER BY name')->fetchAll();
    }

    public function balances(?string $employeeId = null, ?int $year = null): array
    {
        $year ??= (int) date('Y');
        if ($employeeId) {
            $this->ensureBalancesForEmployee($employeeId, $year);
        }

        $sql = 'SELECT lb.*, lt.name AS leave_type_name, e.first_name, e.last_name, e.emp_number
                FROM leave_balances lb
                INNER JOIN leave_types lt ON lt.id = lb.leave_type_id
                INNER JOIN employees e ON e.id = lb.employee_id
                WHERE lb.year = :yr';
        $params = ['yr' => $year];
        if ($employeeId) {
            $sql .= ' AND lb.employee_id = :eid';
            $params['eid'] = $employeeId;
        }
        $sql .= ' ORDER BY e.last_name, lt.name';
        $stmt = Database::connection()->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll();
    }

    public function ensureBalancesForEmployee(string $employeeId, int $year): void
    {
        $pdo = Database::connection();
        $types = $pdo->query('SELECT id, days_per_year FROM leave_types')->fetchAll();
        foreach ($types as $type) {
            $exists = $pdo->prepare(
                'SELECT id FROM leave_balances WHERE employee_id = :e AND leave_type_id = :t AND year = :y LIMIT 1'
            );
            $exists->execute(['e' => $employeeId, 't' => $type['id'], 'y' => $year]);
            if ($exists->fetch()) {
                continue;
            }
            $pdo->prepare(
                'INSERT INTO leave_balances (id, employee_id, leave_type_id, year, accrued, used, pending, carried_forward)
                 VALUES (UUID(), :e, :t, :y, :acc, 0, 0, 0)'
            )->execute([
                'e' => $employeeId,
                't' => $type['id'],
                'y' => $year,
                'acc' => $type['days_per_year'],
            ]);
        }
    }

    public function requests(?string $employeeId = null, ?string $status = null): array
    {
        $sql = 'SELECT lr.*, lt.name AS leave_type_name, e.first_name, e.last_name, e.emp_number
                FROM leave_requests lr
                INNER JOIN leave_types lt ON lt.id = lr.leave_type_id
                INNER JOIN employees e ON e.id = lr.employee_id WHERE 1=1';
        $params = [];
        if ($employeeId) {
            $sql .= ' AND lr.employee_id = :eid';
            $params['eid'] = $employeeId;
        }
        if ($status) {
            $sql .= ' AND lr.status = :st';
            $params['st'] = $status;
        }
        $sql .= ' ORDER BY lr.created_at DESC';
        $stmt = Database::connection()->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll();
    }

    public function createType(array $data): array
    {
        $id = Database::uuid();
        Database::connection()->prepare(
            'INSERT INTO leave_types (id, name, paid, days_per_year, carry_forward, requires_approval, color_hex)
             VALUES (:id, :name, :paid, :days, :cf, :ra, :color)'
        )->execute([
            'id' => $id,
            'name' => $data['name'],
            'paid' => !empty($data['paid']) ? 1 : 0,
            'days' => $data['days_per_year'] ?? 0,
            'cf' => !empty($data['carry_forward']) ? 1 : 0,
            'ra' => !isset($data['requires_approval']) || $data['requires_approval'] ? 1 : 0,
            'color' => $data['color_hex'] ?? '#378ADD',
        ]);
        $stmt = Database::connection()->prepare('SELECT * FROM leave_types WHERE id = :id');
        $stmt->execute(['id' => $id]);
        return $stmt->fetch();
    }

    public function updateType(string $id, array $data): ?array
    {
        $map = ['name', 'days_per_year', 'color_hex'];
        $sets = [];
        $params = ['id' => $id];
        foreach ($map as $f) {
            if (array_key_exists($f, $data)) {
                $sets[] = "$f = :$f";
                $params[$f] = $data[$f];
            }
        }
        foreach (['paid', 'carry_forward', 'requires_approval'] as $bool) {
            if (array_key_exists($bool, $data)) {
                $sets[] = "$bool = :$bool";
                $params[$bool] = $data[$bool] ? 1 : 0;
            }
        }
        if ($sets === []) {
            $stmt = Database::connection()->prepare('SELECT * FROM leave_types WHERE id = :id');
            $stmt->execute(['id' => $id]);
            return $stmt->fetch() ?: null;
        }
        Database::connection()->prepare('UPDATE leave_types SET ' . implode(', ', $sets) . ' WHERE id = :id')
            ->execute($params);
        $stmt = Database::connection()->prepare('SELECT * FROM leave_types WHERE id = :id');
        $stmt->execute(['id' => $id]);
        return $stmt->fetch() ?: null;
    }

    public function createRequest(array $data): array
    {
        $pdo = Database::connection();
        $id = Database::uuid();
        $year = (int) date('Y', strtotime($data['start_date']));
        $this->ensureBalancesForEmployee($data['employee_id'], $year);

        $pdo->prepare(
            'INSERT INTO leave_requests (id, employee_id, leave_type_id, start_date, end_date, days_count, reason, status)
             VALUES (:id, :eid, :lt, :start, :end, :days, :reason, :status)'
        )->execute([
            'id' => $id,
            'eid' => $data['employee_id'],
            'lt' => $data['leave_type_id'],
            'start' => $data['start_date'],
            'end' => $data['end_date'],
            'days' => $data['days_count'],
            'reason' => $data['reason'] ?? null,
            'status' => 'pending',
        ]);

        $pdo->prepare(
            'UPDATE leave_balances SET pending = pending + :d
             WHERE employee_id = :e AND leave_type_id = :t AND year = :y'
        )->execute([
            'd' => $data['days_count'],
            'e' => $data['employee_id'],
            't' => $data['leave_type_id'],
            'y' => $year,
        ]);

        $stmt = $pdo->prepare('SELECT * FROM leave_requests WHERE id = :id');
        $stmt->execute(['id' => $id]);
        return $stmt->fetch();
    }

    public function review(string $id, string $status, string $reviewerId, ?string $notes = null): ?array
    {
        if (!in_array($status, ['approved', 'rejected', 'cancelled'], true)) {
            throw new \InvalidArgumentException('Invalid status');
        }
        $pdo = Database::connection();
        $req = $pdo->prepare('SELECT employee_id, leave_type_id, days_count, start_date, status FROM leave_requests WHERE id = :id');
        $req->execute(['id' => $id]);
        $row = $req->fetch();
        if (!$row) {
            return null;
        }

        $pdo->prepare(
            'UPDATE leave_requests SET status = :st, reviewed_by = :rb, reviewed_at = NOW(), notes = :notes WHERE id = :id'
        )->execute(['st' => $status, 'rb' => $reviewerId, 'notes' => $notes, 'id' => $id]);

        if ($row['status'] === 'pending') {
            $year = (int) date('Y', strtotime($row['start_date']));
            $d = $row['days_count'];
            if ($status === 'approved') {
                $this->ensureBalancesForEmployee($row['employee_id'], $year);
                $pdo->prepare(
                    'UPDATE leave_balances SET used = used + :d, pending = GREATEST(pending - :d, 0)
                     WHERE employee_id = :e AND leave_type_id = :t AND year = :y'
                )->execute(['d' => $d, 'e' => $row['employee_id'], 't' => $row['leave_type_id'], 'y' => $year]);
            } elseif (in_array($status, ['rejected', 'cancelled'], true)) {
                $pdo->prepare(
                    'UPDATE leave_balances SET pending = GREATEST(pending - :d, 0)
                     WHERE employee_id = :e AND leave_type_id = :t AND year = :y'
                )->execute(['d' => $d, 'e' => $row['employee_id'], 't' => $row['leave_type_id'], 'y' => $year]);
            }
        }

        $stmt = $pdo->prepare('SELECT * FROM leave_requests WHERE id = :id');
        $stmt->execute(['id' => $id]);
        $row = $stmt->fetch() ?: null;
        if ($row && in_array($status, ['approved', 'rejected'], true)) {
            $this->notifyLeaveDecision($row, $status);
        }
        return $row;
    }

    public function cancelRequest(string $id, string $employeeId): ?array
    {
        $pdo = Database::connection();
        $stmt = $pdo->prepare('SELECT * FROM leave_requests WHERE id = :id LIMIT 1');
        $stmt->execute(['id' => $id]);
        $row = $stmt->fetch();
        if (!$row || $row['employee_id'] !== $employeeId) {
            return null;
        }
        if ($row['status'] !== 'pending') {
            throw new \RuntimeException('Only pending requests can be cancelled');
        }
        $year = (int) date('Y', strtotime($row['start_date']));
        $pdo->prepare(
            "UPDATE leave_requests SET status = 'cancelled', reviewed_at = NOW() WHERE id = :id"
        )->execute(['id' => $id]);
        $pdo->prepare(
            'UPDATE leave_balances SET pending = GREATEST(pending - :d, 0)
             WHERE employee_id = :e AND leave_type_id = :t AND year = :y'
        )->execute([
            'd' => $row['days_count'],
            'e' => $row['employee_id'],
            't' => $row['leave_type_id'],
            'y' => $year,
        ]);
        $out = $pdo->prepare('SELECT * FROM leave_requests WHERE id = :id');
        $out->execute(['id' => $id]);
        return $out->fetch() ?: null;
    }

    private function notifyLeaveDecision(array $row, string $status): void
    {
        $userId = $this->notifications->userIdForEmployee((string) $row['employee_id']);
        if (!$userId) {
            return;
        }
        $typeStmt = Database::connection()->prepare('SELECT name FROM leave_types WHERE id = :id LIMIT 1');
        $typeStmt->execute(['id' => $row['leave_type_id']]);
        $typeName = $typeStmt->fetchColumn() ?: 'Leave';
        $range = "{$row['start_date']} – {$row['end_date']}";
        if ($status === 'approved') {
            $this->notifications->create(
                $userId,
                'leave_approved',
                'Leave approved',
                "Your {$typeName} request ({$range}) was approved.",
                $row['id'],
                '/leaves'
            );
            return;
        }
        $this->notifications->create(
            $userId,
            'leave_rejected',
            'Leave declined',
            "Your {$typeName} request ({$range}) was declined.",
            $row['id'],
            '/leaves'
        );
    }
}
