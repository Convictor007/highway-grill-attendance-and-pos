<?php

declare(strict_types=1);

namespace Hg\Api\Modules\Shifts;

use Hg\Api\Core\Database;
use Hg\Api\Modules\Notifications\NotificationService;

final class ShiftSwapService
{
    public function __construct(
        private readonly NotificationService $notifications = new NotificationService(),
    ) {}

    public function list(?string $employeeId = null, bool $hrView = false): array
    {
        $sql = 'SELECT sw.*,
                       ra.shift_date AS requester_date, ra.start_time AS requester_start, ra.end_time AS requester_end,
                       ta.shift_date AS target_date, ta.start_time AS target_start, ta.end_time AS target_end,
                       er.first_name AS requester_first, er.last_name AS requester_last,
                       et.first_name AS target_first, et.last_name AS target_last
                FROM shift_swap_requests sw
                INNER JOIN shift_assignments ra ON ra.id = sw.requester_assignment_id
                LEFT JOIN shift_assignments ta ON ta.id = sw.target_assignment_id
                INNER JOIN employees er ON er.id = sw.requester_employee_id
                INNER JOIN employees et ON et.id = sw.target_employee_id
                WHERE 1=1';
        $params = [];
        if (!$hrView && $employeeId) {
            $sql .= ' AND (sw.requester_employee_id = :eid OR sw.target_employee_id = :eid2)';
            $params['eid'] = $employeeId;
            $params['eid2'] = $employeeId;
        }
        $sql .= ' ORDER BY sw.created_at DESC LIMIT 100';
        $stmt = Database::connection()->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll();
    }

    public function create(array $data, string $userId, string $requesterEmployeeId): array
    {
        $assignmentId = (string) ($data['requester_assignment_id'] ?? '');
        $targetEmployeeId = (string) ($data['target_employee_id'] ?? '');
        if ($assignmentId === '' || $targetEmployeeId === '') {
            throw new \InvalidArgumentException('requester_assignment_id and target_employee_id required');
        }
        if ($targetEmployeeId === $requesterEmployeeId) {
            throw new \InvalidArgumentException('Cannot swap with yourself');
        }

        $assignment = $this->getAssignment($assignmentId);
        if (!$assignment || $assignment['employee_id'] !== $requesterEmployeeId) {
            throw new \InvalidArgumentException('Shift assignment not found');
        }
        if ($assignment['shift_date'] < date('Y-m-d')) {
            throw new \InvalidArgumentException('Cannot swap past shifts');
        }

        $target = $this->getEmployee($targetEmployeeId);
        $requester = $this->getEmployee($requesterEmployeeId);
        if (!$target || !$requester || $target['branch_id'] !== $requester['branch_id']) {
            throw new \InvalidArgumentException('Coworker must be in your branch');
        }

        $targetAssignmentId = isset($data['target_assignment_id']) && $data['target_assignment_id'] !== ''
            ? (string) $data['target_assignment_id']
            : null;
        if ($targetAssignmentId) {
            $ta = $this->getAssignment($targetAssignmentId);
            if (!$ta || $ta['employee_id'] !== $targetEmployeeId) {
                throw new \InvalidArgumentException('Target shift not found');
            }
            if ($ta['shift_date'] < date('Y-m-d')) {
                throw new \InvalidArgumentException('Cannot swap past shifts');
            }
        }

        $pending = Database::connection()->prepare(
            'SELECT id FROM shift_swap_requests
             WHERE status = \'pending\'
               AND (requester_assignment_id = :a OR target_assignment_id = :b)
             LIMIT 1'
        );
        $pending->execute(['a' => $assignmentId, 'b' => $targetAssignmentId ?? $assignmentId]);
        if ($pending->fetch()) {
            throw new \InvalidArgumentException('A pending swap already exists for this shift');
        }

        $id = Database::uuid();
        Database::connection()->prepare(
            'INSERT INTO shift_swap_requests
             (id, requester_assignment_id, requester_employee_id, target_employee_id, target_assignment_id,
              message, created_by_user_id)
             VALUES (:id, :raid, :reid, :teid, :taid, :msg, :uid)'
        )->execute([
            'id' => $id,
            'raid' => $assignmentId,
            'reid' => $requesterEmployeeId,
            'teid' => $targetEmployeeId,
            'taid' => $targetAssignmentId,
            'msg' => $data['message'] ?? null,
            'uid' => $userId,
        ]);

        $row = $this->get($id);
        $this->notifySwapCreated($row);
        return $row;
    }

    public function respond(string $id, string $action, string $userId, string $responderEmployeeId): ?array
    {
        if (!in_array($action, ['accept', 'reject'], true)) {
            throw new \InvalidArgumentException('action must be accept or reject');
        }

        $swap = $this->get($id);
        if (!$swap || $swap['status'] !== 'pending') {
            return null;
        }
        if ($swap['target_employee_id'] !== $responderEmployeeId) {
            throw new \InvalidArgumentException('Only the requested coworker can respond');
        }

        if ($action === 'reject') {
            Database::connection()->prepare(
                'UPDATE shift_swap_requests SET status = \'rejected\', responded_at = NOW() WHERE id = :id'
            )->execute(['id' => $id]);
            $row = $this->get($id);
            $this->notifySwapRejected($row);
            return $row;
        }

        $pdo = Database::connection();
        $pdo->beginTransaction();
        try {
            $this->executeSwap($swap);
            $pdo->prepare(
                'UPDATE shift_swap_requests SET status = \'accepted\', responded_at = NOW() WHERE id = :id'
            )->execute(['id' => $id]);
            $pdo->commit();
        } catch (\Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }

        $row = $this->get($id);
        $this->notifySwapAccepted($row);
        return $row;
    }

    public function cancel(string $id, string $requesterEmployeeId): bool
    {
        $swap = $this->get($id);
        if (!$swap || $swap['status'] !== 'pending' || $swap['requester_employee_id'] !== $requesterEmployeeId) {
            return false;
        }
        Database::connection()->prepare(
            'UPDATE shift_swap_requests SET status = \'cancelled\', responded_at = NOW() WHERE id = :id'
        )->execute(['id' => $id]);
        return true;
    }

    private function executeSwap(array $swap): void
    {
        $requesterAssignment = $this->getAssignment($swap['requester_assignment_id']);
        if (!$requesterAssignment || $requesterAssignment['employee_id'] !== $swap['requester_employee_id']) {
            throw new \RuntimeException('Requester shift changed; swap cannot complete');
        }

        $pdo = Database::connection();
        if (!empty($swap['target_assignment_id'])) {
            $targetAssignment = $this->getAssignment($swap['target_assignment_id']);
            if (!$targetAssignment || $targetAssignment['employee_id'] !== $swap['target_employee_id']) {
                throw new \RuntimeException('Target shift changed; swap cannot complete');
            }
            $pdo->prepare('UPDATE shift_assignments SET employee_id = :eid WHERE id = :id')->execute([
                'eid' => $swap['target_employee_id'],
                'id' => $swap['requester_assignment_id'],
            ]);
            $pdo->prepare('UPDATE shift_assignments SET employee_id = :eid WHERE id = :id')->execute([
                'eid' => $swap['requester_employee_id'],
                'id' => $swap['target_assignment_id'],
            ]);
            return;
        }

        $pdo->prepare('UPDATE shift_assignments SET employee_id = :eid WHERE id = :id')->execute([
            'eid' => $swap['target_employee_id'],
            'id' => $swap['requester_assignment_id'],
        ]);
    }

    private function notifySwapCreated(array $swap): void
    {
        $name = trim(($swap['requester_first'] ?? '') . ' ' . ($swap['requester_last'] ?? ''));
        $shift = $this->formatShift($swap['requester_date'], $swap['requester_start'], $swap['requester_end']);
        $body = "{$name} wants to swap their {$shift} shift with you.";
        if (!empty($swap['message'])) {
            $body .= ' Message: ' . $swap['message'];
        }

        $targetUserId = $this->notifications->userIdForEmployee($swap['target_employee_id']);
        if ($targetUserId) {
            $this->notifications->create(
                $targetUserId,
                'shift_swap_pending',
                'Shift swap request',
                $body,
                $swap['id'],
                '/scheduling'
            );
        }

        $this->notifications->notifyUserIds(
            $this->notifications->hrSchedulerUserIds(),
            'shift_swap_pending_hr',
            'Shift swap requested',
            "{$name} requested a shift swap (pending coworker approval). {$shift}",
            $swap['id'],
            '/shifts'
        );
    }

    private function notifySwapAccepted(array $swap): void
    {
        $targetName = trim(($swap['target_first'] ?? '') . ' ' . ($swap['target_last'] ?? ''));
        $shift = $this->formatShift($swap['requester_date'], $swap['requester_start'], $swap['requester_end']);

        $requesterUserId = $this->notifications->userIdForEmployee($swap['requester_employee_id']);
        if ($requesterUserId) {
            $this->notifications->create(
                $requesterUserId,
                'shift_swap_accepted',
                'Swap accepted',
                "{$targetName} accepted your shift swap for {$shift}. The roster has been updated.",
                $swap['id'],
                '/scheduling'
            );
        }

        $requesterName = trim(($swap['requester_first'] ?? '') . ' ' . ($swap['requester_last'] ?? ''));
        $this->notifications->notifyUserIds(
            $this->notifications->hrSchedulerUserIds(),
            'shift_swap_completed_hr',
            'Shift swap completed',
            "{$targetName} accepted a swap with {$requesterName}. {$shift} — roster updated.",
            $swap['id'],
            '/shifts'
        );
    }

    private function notifySwapRejected(array $swap): void
    {
        $targetName = trim(($swap['target_first'] ?? '') . ' ' . ($swap['target_last'] ?? ''));
        $shift = $this->formatShift($swap['requester_date'], $swap['requester_start'], $swap['requester_end']);

        $requesterUserId = $this->notifications->userIdForEmployee($swap['requester_employee_id']);
        if ($requesterUserId) {
            $this->notifications->create(
                $requesterUserId,
                'shift_swap_rejected',
                'Swap declined',
                "{$targetName} declined your shift swap for {$shift}.",
                $swap['id'],
                '/scheduling'
            );
        }
    }

    private function formatShift(?string $date, ?string $start, ?string $end): string
    {
        $d = $date ?? '';
        $s = $start ? substr($start, 0, 5) : '';
        $e = $end ? substr($end, 0, 5) : '';
        return trim("{$d} {$s}–{$e}");
    }

    public function get(string $id): ?array
    {
        $stmt = Database::connection()->prepare(
            'SELECT sw.*,
                    ra.shift_date AS requester_date, ra.start_time AS requester_start, ra.end_time AS requester_end,
                    ta.shift_date AS target_date, ta.start_time AS target_start, ta.end_time AS target_end,
                    er.first_name AS requester_first, er.last_name AS requester_last,
                    et.first_name AS target_first, et.last_name AS target_last
             FROM shift_swap_requests sw
             INNER JOIN shift_assignments ra ON ra.id = sw.requester_assignment_id
             LEFT JOIN shift_assignments ta ON ta.id = sw.target_assignment_id
             INNER JOIN employees er ON er.id = sw.requester_employee_id
             INNER JOIN employees et ON et.id = sw.target_employee_id
             WHERE sw.id = :id LIMIT 1'
        );
        $stmt->execute(['id' => $id]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    private function getAssignment(string $id): ?array
    {
        $stmt = Database::connection()->prepare('SELECT * FROM shift_assignments WHERE id = :id LIMIT 1');
        $stmt->execute(['id' => $id]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    private function getEmployee(string $id): ?array
    {
        $stmt = Database::connection()->prepare(
            'SELECT id, branch_id, first_name, last_name, status FROM employees WHERE id = :id LIMIT 1'
        );
        $stmt->execute(['id' => $id]);
        $row = $stmt->fetch();
        return $row && $row['status'] === 'active' ? $row : null;
    }
}
