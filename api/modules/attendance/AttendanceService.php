<?php

declare(strict_types=1);

namespace Hg\Api\Modules\Attendance;

use Hg\Api\Core\Database;
use Hg\Api\Core\Schema;
use Hg\Api\Modules\Fieldwork\FieldWorkService;

final class AttendanceService
{
    public function list(?string $date = null, ?string $branchId = null, ?string $employeeId = null): array
    {
        $date = $date ?? date('Y-m-d');
        $sql = 'SELECT a.*, e.emp_number, e.first_name, e.last_name, e.branch_id
                FROM attendance a
                INNER JOIN employees e ON e.id = a.employee_id
                WHERE DATE(a.clock_in) = :d';
        $params = ['d' => $date];
        if ($employeeId) {
            $sql .= ' AND a.employee_id = :eid';
            $params['eid'] = $employeeId;
        }
        if ($branchId) {
            $sql .= ' AND e.branch_id = :b';
            $params['b'] = $branchId;
        }
        $sql .= ' ORDER BY a.clock_in';
        $stmt = Database::connection()->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll();
    }

    public function openSession(string $employeeId): ?array
    {
        $stmt = Database::connection()->prepare(
            'SELECT * FROM attendance WHERE employee_id = :eid AND clock_out IS NULL ORDER BY clock_in DESC LIMIT 1'
        );
        $stmt->execute(['eid' => $employeeId]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public function clockPolicyForEmployee(string $employeeId): array
    {
        $branchId = $this->employeeBranchId($employeeId);
        $required = (new FieldWorkService())->branchHasActiveZones($branchId);

        return ['geofence_required' => $required];
    }

    public function clockIn(
        string $employeeId,
        string $method = 'app',
        ?float $latitude = null,
        ?float $longitude = null,
        ?string $address = null
    ): array {
        if ($this->openSession($employeeId)) {
            throw new \RuntimeException('Already clocked in');
        }

        $this->assertGeofenceForClockIn($employeeId, $latitude, $longitude);
        $id = Database::uuid();
        $pdo = Database::connection();
        $hasAddr = Schema::hasColumn('attendance', 'clock_in_address');
        if ($hasAddr) {
            $pdo->prepare(
                'INSERT INTO attendance (id, employee_id, clock_in, method, ip_address, latitude, longitude, clock_in_address)
                 VALUES (:id, :eid, NOW(), :method, :ip, :lat, :lng, :addr)'
            )->execute([
                'id' => $id,
                'eid' => $employeeId,
                'method' => $method,
                'ip' => $_SERVER['REMOTE_ADDR'] ?? null,
                'lat' => $latitude,
                'lng' => $longitude,
                'addr' => $address,
            ]);
        } else {
            $pdo->prepare(
                'INSERT INTO attendance (id, employee_id, clock_in, method, ip_address, latitude, longitude)
                 VALUES (:id, :eid, NOW(), :method, :ip, :lat, :lng)'
            )->execute([
                'id' => $id,
                'eid' => $employeeId,
                'method' => $method,
                'ip' => $_SERVER['REMOTE_ADDR'] ?? null,
                'lat' => $latitude,
                'lng' => $longitude,
            ]);
        }
        $stmt = $pdo->prepare('SELECT * FROM attendance WHERE id = :id');
        $stmt->execute(['id' => $id]);
        $row = $stmt->fetch();
        if ($row) {
            (new AttendanceAutoService())->linkShiftOnClockIn($id, $employeeId);
            $stmt->execute(['id' => $id]);
            $row = $stmt->fetch();
        }
        return $row;
    }

    public function clockOut(
        string $employeeId,
        ?float $latitude = null,
        ?float $longitude = null,
        ?string $address = null
    ): array {
        return (new AttendanceAutoService())->manualClockOut($employeeId, $latitude, $longitude, $address);
    }

    public function get(string $id): ?array
    {
        $stmt = Database::connection()->prepare(
            'SELECT a.*, e.emp_number, e.first_name, e.last_name
             FROM attendance a
             INNER JOIN employees e ON e.id = a.employee_id
             WHERE a.id = :id LIMIT 1'
        );
        $stmt->execute(['id' => $id]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public function manualEntry(array $data, string $reviewerUserId): array
    {
        $id = Database::uuid();
        $clockIn = $data['clock_in'] ?? date('Y-m-d H:i:s');
        $clockOut = $data['clock_out'] ?? null;
        $hours = $data['actual_hours'] ?? null;
        if ($clockOut && $hours === null) {
            $hours = round((strtotime($clockOut) - strtotime($clockIn)) / 3600, 2);
        }
        Database::connection()->prepare(
            'INSERT INTO attendance (id, employee_id, clock_in, clock_out, actual_hours, method, approved_by, approved_at)
             VALUES (:id, :eid, :cin, :cout, :hrs, :method, :by, NOW())'
        )->execute([
            'id' => $id,
            'eid' => $data['employee_id'],
            'cin' => $clockIn,
            'cout' => $clockOut,
            'hrs' => $hours,
            'method' => $data['method'] ?? 'manual',
            'by' => $reviewerUserId,
        ]);
        return $this->get($id) ?? [];
    }

    public function update(string $id, array $data, ?string $approverUserId = null): ?array
    {
        $existing = $this->get($id);
        if (!$existing) {
            return null;
        }
        $sets = [];
        $params = ['id' => $id];
        foreach (['clock_in', 'clock_out', 'actual_hours', 'regular_hours', 'overtime_hours', 'method', 'clock_in_address', 'clock_out_address'] as $f) {
            if (array_key_exists($f, $data)) {
                $sets[] = "$f = :$f";
                $params[$f] = $data[$f];
            }
        }
        if ($sets === []) {
            return $existing;
        }
        if ($approverUserId !== null) {
            $sets[] = 'approved_by = :approved_by';
            $sets[] = 'approved_at = NOW()';
            $params['approved_by'] = $approverUserId;
        }
        $cin = $data['clock_in'] ?? $existing['clock_in'];
        $cout = $data['clock_out'] ?? $existing['clock_out'];
        if ($cout && !array_key_exists('actual_hours', $data)) {
            $sets[] = 'actual_hours = :actual_hours';
            $params['actual_hours'] = round((strtotime((string) $cout) - strtotime((string) $cin)) / 3600, 2);
        }
        Database::connection()->prepare('UPDATE attendance SET ' . implode(', ', $sets) . ' WHERE id = :id')
            ->execute($params);

        $row = $this->get($id);
        if ($row && (array_key_exists('regular_hours', $data) || array_key_exists('overtime_hours', $data))) {
            $ot = (float) ($row['overtime_hours'] ?? 0);
            if ($ot > 0) {
                (new \Hg\Api\Modules\Overtime\OvertimeService())->upsertAutoFromAttendance(
                    $id,
                    (string) $row['employee_id'],
                    date('Y-m-d', strtotime((string) $row['clock_in'])),
                    $ot,
                    'HR attendance correction'
                );
            }
            return $row;
        }

        return (new AttendanceAutoService())->recalculateForRecord($id) ?? $row;
    }

    public function hoursSummary(string $employeeId, string $from, string $to): array
    {
        $stmt = Database::connection()->prepare(
            'SELECT COALESCE(SUM(actual_hours), 0) AS total_hours, COUNT(*) AS shift_count
             FROM attendance
             WHERE employee_id = :eid AND DATE(clock_in) BETWEEN :f AND :t AND clock_out IS NOT NULL'
        );
        $stmt->execute(['eid' => $employeeId, 'f' => $from, 't' => $to]);
        $row = $stmt->fetch();
        return [
            'from' => $from,
            'to' => $to,
            'total_hours' => (float) ($row['total_hours'] ?? 0),
            'shift_count' => (int) ($row['shift_count'] ?? 0),
        ];
    }

    public function breakStart(string $employeeId): array
    {
        $open = $this->openSession($employeeId);
        if (!$open) {
            throw new \RuntimeException('Clock in before starting a break');
        }
        if (!empty($open['break_start']) && empty($open['break_end'])) {
            throw new \RuntimeException('Break already in progress');
        }
        Database::connection()->prepare(
            'UPDATE attendance SET break_start = NOW(), break_end = NULL WHERE id = :id'
        )->execute(['id' => $open['id']]);
        return $this->get($open['id']) ?? [];
    }

    public function breakEnd(string $employeeId): array
    {
        $open = $this->openSession($employeeId);
        if (!$open || empty($open['break_start']) || !empty($open['break_end'])) {
            throw new \RuntimeException('No break in progress');
        }
        Database::connection()->prepare(
            'UPDATE attendance SET break_end = NOW() WHERE id = :id'
        )->execute(['id' => $open['id']]);
        return $this->get($open['id']) ?? [];
    }

    private function employeeBranchId(string $employeeId): ?string
    {
        $stmt = Database::connection()->prepare('SELECT branch_id FROM employees WHERE id = :id LIMIT 1');
        $stmt->execute(['id' => $employeeId]);
        $emp = $stmt->fetch();

        return $emp['branch_id'] ?? null;
    }

    private function assertGeofenceForClockIn(string $employeeId, ?float $latitude, ?float $longitude): void
    {
        $branchId = $this->employeeBranchId($employeeId);
        $fieldWork = new FieldWorkService();
        if (!$fieldWork->branchHasActiveZones($branchId)) {
            return;
        }

        if ($latitude === null || $longitude === null) {
            throw new \InvalidArgumentException(
                'Location access is required to clock in. Enable GPS on your device and try again.'
            );
        }

        if (!$fieldWork->matchSite($latitude, $longitude, $branchId)) {
            throw new \InvalidArgumentException(
                'You must be inside a registered work zone to clock in. If you are off-site, use Field Work to check in.'
            );
        }
    }
}
