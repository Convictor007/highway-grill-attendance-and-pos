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
                WHERE (
                    DATE(a.clock_in) = :d
                    OR (a.clock_out IS NOT NULL AND DATE(a.clock_out) = :d2)
                    OR (a.clock_in < DATE_ADD(:d3, INTERVAL 1 DAY) AND (a.clock_out IS NULL OR a.clock_out >= :d4))
                )';
        $params = ['d' => $date, 'd2' => $date, 'd3' => $date, 'd4' => $date];
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
        if ($this->isManagementEmployee($employeeId)) {
            return [
                'geofence_required' => false,
                'clock_in_exempt' => true,
                'mobile_clock' => true,
                'position_label' => 'Management',
            ];
        }

        if ($this->isDeliveryRider($employeeId)) {
            return [
                'geofence_required' => false,
                'clock_in_exempt' => false,
                'mobile_clock' => true,
                'position_label' => 'Delivery',
            ];
        }

        $branchId = $this->employeeBranchId($employeeId);
        $required = (new FieldWorkService())->branchHasClockInZones($branchId);
        $position = $this->employeePositionLabel($employeeId);

        return [
            'geofence_required' => $required,
            'clock_in_exempt' => false,
            'mobile_clock' => false,
            'position_label' => $position,
        ];
    }

    public function clockIn(
        string $employeeId,
        string $method = 'app',
        ?float $latitude = null,
        ?float $longitude = null,
        ?string $address = null,
        ?float $accuracyM = null
    ): array {
        if ($this->openSession($employeeId)) {
            throw new \RuntimeException('Already clocked in');
        }

        $this->assertGeofenceForClockIn($employeeId, $latitude, $longitude, $accuracyM);
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

    public function scheduledShiftForEmployee(string $employeeId, string $date): ?array
    {
        $stmt = Database::connection()->prepare(
            'SELECT sa.*, st.name AS shift_name, COALESCE(sa.break_mins, st.break_mins, 0) AS break_mins
             FROM shift_assignments sa
             INNER JOIN schedules sch ON sch.id = sa.schedule_id
               AND sch.status IN (\'published\', \'locked\', \'draft\')
             LEFT JOIN shift_templates st ON st.id = sa.shift_template_id
             WHERE sa.employee_id = :eid AND sa.shift_date = :d
               AND (sa.notes IS NULL OR sa.notes != \'REST_DAY\')
             ORDER BY sa.start_time LIMIT 1'
        );
        $stmt->execute(['eid' => $employeeId, 'd' => $date]);
        $row = $stmt->fetch();
        if (!$row) {
            return null;
        }

        $start = substr((string) $row['start_time'], 0, 8);
        $end = substr((string) $row['end_time'], 0, 8);
        $endDate = $date;
        if (strcmp($end, $start) <= 0) {
            $endDate = date('Y-m-d', strtotime($date . ' +1 day'));
        }
        $clockIn = $date . ' ' . $start;
        $clockOut = $endDate . ' ' . $end;
        $breakMins = (int) $row['break_mins'];
        $rawHours = (strtotime($clockOut) - strtotime($clockIn)) / 3600;
        $hours = round(max(0, $rawHours - $breakMins / 60), 2);

        return [
            'assignment_id' => $row['id'],
            'shift_name' => $row['shift_name'] ?? null,
            'shift_date' => $date,
            'start_time' => $row['start_time'],
            'end_time' => $row['end_time'],
            'break_mins' => $breakMins,
            'clock_in' => $clockIn,
            'clock_out' => $clockOut,
            'suggested_hours' => $hours,
            'off_day' => false,
        ];
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
        $hasShiftCol = Schema::hasColumn('attendance', 'shift_assignment_id');
        if ($hasShiftCol) {
            Database::connection()->prepare(
                'INSERT INTO attendance (id, employee_id, clock_in, clock_out, actual_hours, method, shift_assignment_id, approved_by, approved_at)
                 VALUES (:id, :eid, :cin, :cout, :hrs, :method, :said, :by, NOW())'
            )->execute([
                'id' => $id,
                'eid' => $data['employee_id'],
                'cin' => $clockIn,
                'cout' => $clockOut,
                'hrs' => $hours,
                'method' => $data['method'] ?? 'manual',
                'said' => $data['shift_assignment_id'] ?? null,
                'by' => $reviewerUserId,
            ]);
        } else {
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
        }

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
        foreach (['clock_in', 'clock_out', 'actual_hours', 'regular_hours', 'overtime_hours', 'method', 'clock_in_address', 'clock_out_address', 'shift_assignment_id'] as $f) {
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

    public function statistics(?string $branchId, string $from, string $to): array
    {
        $pdo = Database::connection();
        $empSql = "SELECT COUNT(*) FROM employees WHERE status = 'active'";
        $empParams = [];
        if ($branchId) {
            $empSql .= ' AND branch_id = :b';
            $empParams['b'] = $branchId;
        }
        $empStmt = $pdo->prepare($empSql);
        $empStmt->execute($empParams);
        $activeEmployees = (int) $empStmt->fetchColumn();

        $attSql = 'SELECT e.id, e.emp_number, e.first_name, e.last_name,
                          COALESCE(SUM(a.actual_hours), 0) AS total_hours,
                          COUNT(DISTINCT DATE(a.clock_in)) AS days_present
                   FROM employees e
                   LEFT JOIN attendance a ON a.employee_id = e.id
                     AND DATE(a.clock_in) BETWEEN :f AND :t AND a.clock_out IS NOT NULL
                   WHERE e.status = \'active\'';
        $attParams = ['f' => $from, 't' => $to];
        if ($branchId) {
            $attSql .= ' AND e.branch_id = :b';
            $attParams['b'] = $branchId;
        }
        $attSql .= ' GROUP BY e.id ORDER BY e.last_name';
        $attStmt = $pdo->prepare($attSql);
        $attStmt->execute($attParams);
        $byEmployee = $attStmt->fetchAll();

        $totalHours = 0.0;
        $totalDays = 0;
        foreach ($byEmployee as $row) {
            $totalHours += (float) $row['total_hours'];
            $totalDays += (int) $row['days_present'];
        }

        $holidaySql = 'SELECT COALESCE(SUM(a.actual_hours), 0)
                       FROM attendance a
                       INNER JOIN employees e ON e.id = a.employee_id
                       INNER JOIN holidays h ON h.holiday_date = DATE(a.clock_in)
                         AND (h.branch_id IS NULL OR h.branch_id = e.branch_id)
                       WHERE DATE(a.clock_in) BETWEEN :f AND :t';
        $holidayParams = ['f' => $from, 't' => $to];
        if ($branchId) {
            $holidaySql .= ' AND e.branch_id = :b';
            $holidayParams['b'] = $branchId;
        }
        $holidayStmt = $pdo->prepare($holidaySql);
        $holidayStmt->execute($holidayParams);
        $holidayHours = round((float) $holidayStmt->fetchColumn(), 2);

        $otSql = "SELECT COALESCE(SUM(o.extra_hours), 0)
                  FROM overtime_requests o
                  INNER JOIN employees e ON e.id = o.employee_id
                  WHERE o.status = 'approved' AND o.request_date BETWEEN :f AND :t";
        $otParams = ['f' => $from, 't' => $to];
        if ($branchId) {
            $otSql .= ' AND e.branch_id = :b';
            $otParams['b'] = $branchId;
        }
        $otStmt = $pdo->prepare($otSql);
        $otStmt->execute($otParams);
        $overtimeHours = round((float) $otStmt->fetchColumn(), 2);

        $periodDays = max(1, (int) ((strtotime($to) - strtotime($from)) / 86400) + 1);
        $expectedSlots = $activeEmployees * $periodDays;

        return [
            'from' => $from,
            'to' => $to,
            'active_employees' => $activeEmployees,
            'total_hours' => round($totalHours, 2),
            'avg_hours_per_employee' => $activeEmployees > 0 ? round($totalHours / $activeEmployees, 2) : 0,
            'total_days_present' => $totalDays,
            'attendance_rate' => $expectedSlots > 0 ? round(($totalDays / $expectedSlots) * 100, 1) : 0,
            'holiday_hours_worked' => $holidayHours,
            'approved_overtime_hours' => $overtimeHours,
            'by_employee' => $byEmployee,
        ];
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

    private function isManagementEmployee(string $employeeId): bool
    {
        $stmt = Database::connection()->prepare(
            'SELECT r.role_slug FROM users u
             INNER JOIN roles r ON r.role_id = u.role_id
             WHERE u.employee_id = :eid AND u.is_active = 1 LIMIT 1'
        );
        $stmt->execute(['eid' => $employeeId]);
        $slug = $stmt->fetchColumn();

        return is_string($slug) && in_array($slug, ['admin', 'hr'], true);
    }

    private function assertGeofenceForClockIn(
        string $employeeId,
        ?float $latitude,
        ?float $longitude,
        ?float $accuracyM = null
    ): void {
        $policy = $this->clockPolicyForEmployee($employeeId);
        if (!$policy['geofence_required']) {
            return;
        }

        $branchId = $this->employeeBranchId($employeeId);
        $fieldWork = new FieldWorkService();
        if (!$fieldWork->branchHasClockInZones($branchId)) {
            return;
        }

        if ($latitude === null || $longitude === null) {
            throw new \InvalidArgumentException(
                'Location access is required to clock in. Tap Enable location on the time clock, allow browser GPS, then try again.'
            );
        }

        $match = $fieldWork->matchClockInSite($latitude, $longitude, $branchId, $accuracyM);
        if ($match === null) {
            $status = $fieldWork->zoneStatus($latitude, $longitude, $branchId, true, $accuracyM);
            $nearest = $status['nearest_distance_m'] ?? null;
            $radius = isset($status['nearest_site']['radius_m']) ? (int) $status['nearest_site']['radius_m'] : null;
            $edgeGap = $nearest !== null && $radius !== null ? max(0, (int) round($nearest - $radius)) : null;
            $hint = $edgeGap !== null && $radius !== null
                ? sprintf(' About %dm outside the %dm zone — move closer or ask HR to widen the area.', $edgeGap, $radius)
                : ($nearest !== null ? sprintf(' Nearest zone center: %dm away.', (int) round($nearest)) : '');
            throw new \InvalidArgumentException(
                'You must be inside the registered work zone to clock in.' . $hint
            );
        }
    }

    private function isDeliveryRider(string $employeeId): bool
    {
        $stmt = Database::connection()->prepare(
            'SELECT p.title, d.name AS department_name
             FROM employees e
             LEFT JOIN positions p ON p.id = e.position_id
             LEFT JOIN departments d ON d.id = p.department_id
             WHERE e.id = :id LIMIT 1'
        );
        $stmt->execute(['id' => $employeeId]);
        $row = $stmt->fetch();
        if (!$row) {
            return false;
        }
        $title = strtolower((string) ($row['title'] ?? ''));
        $dept = strtolower((string) ($row['department_name'] ?? ''));

        return str_contains($dept, 'delivery')
            || str_contains($title, 'delivery')
            || str_contains($title, 'rider');
    }

    private function employeePositionLabel(string $employeeId): ?string
    {
        $stmt = Database::connection()->prepare(
            'SELECT p.title, d.name AS department_name
             FROM employees e
             LEFT JOIN positions p ON p.id = e.position_id
             LEFT JOIN departments d ON d.id = p.department_id
             WHERE e.id = :id LIMIT 1'
        );
        $stmt->execute(['id' => $employeeId]);
        $row = $stmt->fetch();
        if (!$row) {
            return null;
        }
        $title = trim((string) ($row['title'] ?? ''));
        if ($title !== '') {
            return $title;
        }

        return trim((string) ($row['department_name'] ?? '')) ?: null;
    }
}
