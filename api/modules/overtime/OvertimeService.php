<?php

declare(strict_types=1);

namespace Hg\Api\Modules\Overtime;

use Hg\Api\Core\Database;
use Hg\Api\Core\Schema;
use Hg\Api\Modules\Notifications\NotificationService;

final class OvertimeService
{
    public function __construct(
        private readonly NotificationService $notifications = new NotificationService(),
    ) {}

    public function list(?string $employeeId = null): array
    {
        $sql = 'SELECT o.*, e.emp_number, e.first_name, e.last_name
                FROM overtime_requests o
                INNER JOIN employees e ON e.id = o.employee_id WHERE 1=1';
        $params = [];
        if ($employeeId) {
            $sql .= ' AND o.employee_id = :eid';
            $params['eid'] = $employeeId;
        }
        $sql .= ' ORDER BY o.created_at DESC';
        $stmt = Database::connection()->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll();
    }

    public function create(array $data): array
    {
        $id = Database::uuid();
        Database::connection()->prepare(
            'INSERT INTO overtime_requests (id, employee_id, request_date, extra_hours, reason, status)
             VALUES (:id, :eid, :dt, :hrs, :reason, :st)'
        )->execute([
            'id' => $id,
            'eid' => $data['employee_id'],
            'dt' => $data['request_date'],
            'hrs' => $data['extra_hours'],
            'reason' => $data['reason'] ?? null,
            'st' => 'pending',
        ]);
        $stmt = Database::connection()->prepare('SELECT * FROM overtime_requests WHERE id = :id');
        $stmt->execute(['id' => $id]);
        return $stmt->fetch();
    }

    public function review(string $id, string $status, string $reviewerUserId): ?array
    {
        if (!in_array($status, ['approved', 'rejected'], true)) {
            throw new \RuntimeException('status must be approved or rejected');
        }
        $stmt = Database::connection()->prepare('SELECT * FROM overtime_requests WHERE id = :id');
        $stmt->execute(['id' => $id]);
        $row = $stmt->fetch();
        if (!$row || $row['status'] !== 'pending') {
            return null;
        }
        Database::connection()->prepare(
            'UPDATE overtime_requests SET status = :st WHERE id = :id'
        )->execute(['st' => $status, 'id' => $id]);
        $stmt = Database::connection()->prepare('SELECT * FROM overtime_requests WHERE id = :id');
        $stmt->execute(['id' => $id]);
        $updated = $stmt->fetch() ?: null;
        if ($updated) {
            $this->notifyOvertimeDecision($updated, $status);
        }
        return $updated;
    }

    public function upsertAutoFromAttendance(
        string $attendanceId,
        string $employeeId,
        string $requestDate,
        float $extraHours,
        string $reason
    ): array {
        if ($extraHours <= 0) {
            return [];
        }

        $pdo = Database::connection();
        if (Schema::hasColumn('overtime_requests', 'attendance_id')) {
            $stmt = $pdo->prepare(
                'SELECT id FROM overtime_requests WHERE attendance_id = :aid LIMIT 1'
            );
            $stmt->execute(['aid' => $attendanceId]);
            $existing = $stmt->fetch();
            if ($existing) {
                $pdo->prepare(
                    'UPDATE overtime_requests SET extra_hours = :hrs, reason = :reason, status = :st
                     WHERE id = :id'
                )->execute([
                    'hrs' => $extraHours,
                    'reason' => $reason,
                    'st' => 'approved',
                    'id' => $existing['id'],
                ]);
                $stmt = $pdo->prepare('SELECT * FROM overtime_requests WHERE id = :id');
                $stmt->execute(['id' => $existing['id']]);
                return $stmt->fetch() ?: [];
            }
        }

        $id = Database::uuid();
        if (Schema::hasColumn('overtime_requests', 'source')) {
            $pdo->prepare(
                'INSERT INTO overtime_requests (id, employee_id, request_date, extra_hours, reason, status, source, attendance_id)
                 VALUES (:id, :eid, :dt, :hrs, :reason, :st, :src, :aid)'
            )->execute([
                'id' => $id,
                'eid' => $employeeId,
                'dt' => $requestDate,
                'hrs' => $extraHours,
                'reason' => $reason,
                'st' => 'approved',
                'src' => 'auto',
                'aid' => Schema::hasColumn('overtime_requests', 'attendance_id') ? $attendanceId : null,
            ]);
        } else {
            $pdo->prepare(
                'INSERT INTO overtime_requests (id, employee_id, request_date, extra_hours, reason, status)
                 VALUES (:id, :eid, :dt, :hrs, :reason, :st)'
            )->execute([
                'id' => $id,
                'eid' => $employeeId,
                'dt' => $requestDate,
                'hrs' => $extraHours,
                'reason' => $reason,
                'st' => 'pending',
            ]);
        }

        $stmt = $pdo->prepare('SELECT * FROM overtime_requests WHERE id = :id');
        $stmt->execute(['id' => $id]);
        return $stmt->fetch() ?: [];
    }

    private function notifyOvertimeDecision(array $row, string $status): void
    {
        $userId = $this->notifications->userIdForEmployee((string) $row['employee_id']);
        if (!$userId) {
            return;
        }
        $hrs = $row['extra_hours'];
        $date = $row['request_date'];
        if ($status === 'approved') {
            $this->notifications->create(
                $userId,
                'overtime_approved',
                'Overtime approved',
                "Your overtime request for {$date} ({$hrs} hrs) was approved.",
                $row['id'],
                '/overtime'
            );
            return;
        }
        $this->notifications->create(
            $userId,
            'overtime_rejected',
            'Overtime declined',
            "Your overtime request for {$date} ({$hrs} hrs) was declined.",
            $row['id'],
            '/overtime'
        );
    }
}
