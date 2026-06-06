<?php

declare(strict_types=1);

namespace Hg\Api\Modules\Attendance;

use Hg\Api\Core\Database;
use Hg\Api\Core\Schema;
use Hg\Api\Modules\Fieldwork\FieldWorkService;
use Hg\Api\Modules\Notifications\NotificationService;
use Hg\Api\Modules\Overtime\OvertimeService;

/**
 * Auto clock-out (restricted outside-vicinity rules, peer shift-end, midnight cascade)
 * and auto overtime (9h cap + schedule end). Shift-end reminders for employees still on duty.
 */
final class AttendanceAutoService
{
    public const MAX_REGULAR_HOURS = 9.0;
    public const OUTSIDE_MINUTES = 5;
    public const ENDING_SOON_MINUTES = 30;
    public const PEER_CLOCKOUT_GRACE_MINUTES = 15;

    public function __construct(
        private readonly AttendanceService $attendance = new AttendanceService(),
        private readonly FieldWorkService $fieldWork = new FieldWorkService(),
        private readonly OvertimeService $overtime = new OvertimeService(),
        private readonly NotificationService $notifications = new NotificationService(),
    ) {}

    public function linkShiftOnClockIn(string $attendanceId, string $employeeId): void
    {
        if (!Schema::hasColumn('attendance', 'shift_assignment_id')) {
            return;
        }

        $shift = $this->shiftForDate($employeeId, date('Y-m-d'));
        if (!$shift) {
            return;
        }

        Database::connection()->prepare(
            'UPDATE attendance SET shift_assignment_id = :sid WHERE id = :id'
        )->execute(['sid' => $shift['id'], 'id' => $attendanceId]);
    }

    public function manualClockOut(
        string $employeeId,
        ?float $latitude = null,
        ?float $longitude = null,
        ?string $address = null
    ): array {
        $open = $this->attendance->openSession($employeeId);
        if (!$open) {
            throw new \RuntimeException('No open attendance session');
        }

        $branchId = $this->employeeBranchId($employeeId);
        $geofenceRequired = $this->fieldWork->branchHasActiveZones($branchId);
        $inside = !$geofenceRequired
            || ($latitude !== null && $longitude !== null && $this->fieldWork->matchSite($latitude, $longitude, $branchId) !== null);

        $now = date('Y-m-d H:i:s');
        $closed = $this->closeSession($open, $now, 'manual', $latitude, $longitude, $address);

        if ($inside && $this->isPastMidnight($open['clock_in'], $now)) {
            $this->cascadeMidnightClockOut($branchId, $now, $employeeId);
        }

        return $this->attendance->get($closed['id']) ?? $closed;
    }

    /** @return array{auto_clocked_out: bool, session: ?array, shift: ?array} */
    public function vicinityPing(string $employeeId, float $latitude, float $longitude): array
    {
        $open = $this->attendance->openSession($employeeId);
        if (!$open) {
            return ['auto_clocked_out' => false, 'session' => null, 'shift' => null];
        }

        $shift = $this->shiftContext($employeeId, $open);
        $branchId = $this->employeeBranchId($employeeId);

        if (!$this->fieldWork->branchHasActiveZones($branchId)) {
            $this->processShiftReminders($employeeId, $open, $shift);
            return ['auto_clocked_out' => false, 'session' => $open, 'shift' => $shift];
        }

        $inside = $this->fieldWork->matchSite($latitude, $longitude, $branchId) !== null;

        if ($inside) {
            $this->clearOutsideSince($open['id']);
            $this->processShiftReminders($employeeId, $open, $shift);

            $peerClosed = $this->tryPeerShiftEndClockOut($open, $shift);
            if ($peerClosed) {
                return [
                    'auto_clocked_out' => true,
                    'session' => $this->attendance->get($peerClosed['id']),
                    'shift' => $shift,
                ];
            }

            return ['auto_clocked_out' => false, 'session' => $this->attendance->get($open['id']), 'shift' => $shift];
        }

        $outsideSince = $this->ensureOutsideSince($open);
        $elapsed = time() - strtotime((string) $outsideSince);
        if ($elapsed < self::OUTSIDE_MINUTES * 60) {
            return ['auto_clocked_out' => false, 'session' => $this->attendance->get($open['id']), 'shift' => $shift];
        }

        if (!$this->canAutoClockOutOutside($open, $shift)) {
            return ['auto_clocked_out' => false, 'session' => $this->attendance->get($open['id']), 'shift' => $shift];
        }

        $clockOutAt = date('Y-m-d H:i:s', strtotime((string) $outsideSince) + self::OUTSIDE_MINUTES * 60);
        $closed = $this->closeSession($open, $clockOutAt, 'auto_outside', $latitude, $longitude, null);

        return [
            'auto_clocked_out' => true,
            'session' => $this->attendance->get($closed['id']),
            'shift' => $shift,
        ];
    }

    /** Shift context for open session (status UI + reminders). */
    public function shiftContextForEmployee(string $employeeId): ?array
    {
        $open = $this->attendance->openSession($employeeId);
        if (!$open) {
            return null;
        }
        return $this->shiftContext($employeeId, $open);
    }

    public function recalculateForRecord(string $attendanceId): ?array
    {
        $row = $this->attendance->get($attendanceId);
        if (!$row || empty($row['clock_out'])) {
            return $row;
        }

        $hours = $this->computeHourSplit($row);
        $this->persistHourSplit($attendanceId, $hours['regular'], $hours['overtime'], (float) $hours['worked']);
        $this->syncOvertimeRecord($attendanceId, $row['employee_id'], $row['clock_in'], $hours['overtime'], $hours['reason']);

        return $this->attendance->get($attendanceId);
    }

    private function shiftContext(string $employeeId, array $open): ?array
    {
        $shift = $this->resolveShift($open, $employeeId);
        if (!$shift || empty($shift['shift_date']) || empty($shift['start_time']) || empty($shift['end_time'])) {
            $worked = $this->workedHours((string) $open['clock_in'], date('Y-m-d H:i:s'), $open);
            $pastMidnight = $this->isPastMidnight((string) $open['clock_in'], date('Y-m-d H:i:s'));
            return [
                'has_shift' => false,
                'shift_label' => null,
                'shift_end' => null,
                'minutes_until_end' => null,
                'phase' => $pastMidnight ? 'overdue' : 'normal',
                'show_end_shift' => $pastMidnight || $worked >= self::MAX_REGULAR_HOURS,
                'can_auto_clock_out_outside' => $pastMidnight || $worked >= self::MAX_REGULAR_HOURS,
                'hours_from_scheduled_start' => round($worked, 2),
            ];
        }

        $startTs = $this->shiftTimestamp((string) $shift['shift_date'], (string) $shift['start_time']);
        $endTs = $this->shiftEndTimestamp((string) $shift['shift_date'], (string) $shift['start_time'], (string) $shift['end_time']);
        $now = time();
        $minutesUntilEnd = $endTs !== false ? (int) round(($endTs - $now) / 60) : null;
        $hoursFromStart = $startTs !== false ? round(max(0, ($now - $startTs) / 3600), 2) : 0.0;

        $phase = 'normal';
        if ($minutesUntilEnd !== null) {
            if ($minutesUntilEnd <= 0) {
                $phase = 'overdue';
            } elseif ($minutesUntilEnd <= self::ENDING_SOON_MINUTES) {
                $phase = 'ending_soon';
            }
        }

        $pastMidnight = $this->isPastMidnight((string) $open['clock_in'], date('Y-m-d H:i:s', $now));
        $canAutoOutside = $pastMidnight || $hoursFromStart >= self::MAX_REGULAR_HOURS;

        $startLabel = substr((string) $shift['start_time'], 0, 5);
        $endLabel = substr((string) $shift['end_time'], 0, 5);

        return [
            'has_shift' => true,
            'shift_label' => "{$startLabel}–{$endLabel}",
            'shift_date' => $shift['shift_date'],
            'shift_start' => $startLabel,
            'shift_end' => $endLabel,
            'shift_end_at' => $endTs !== false ? date('Y-m-d H:i:s', $endTs) : null,
            'minutes_until_end' => $minutesUntilEnd,
            'phase' => $phase,
            'show_end_shift' => $phase === 'ending_soon' || $phase === 'overdue',
            'can_auto_clock_out_outside' => $canAutoOutside,
            'hours_from_scheduled_start' => $hoursFromStart,
        ];
    }

    private function canAutoClockOutOutside(array $open, ?array $shift): bool
    {
        if ($shift && isset($shift['can_auto_clock_out_outside'])) {
            return (bool) $shift['can_auto_clock_out_outside'];
        }
        $now = date('Y-m-d H:i:s');
        if ($this->isPastMidnight((string) $open['clock_in'], $now)) {
            return true;
        }
        $worked = $this->workedHours((string) $open['clock_in'], $now, $open);
        return $worked >= self::MAX_REGULAR_HOURS;
    }

    private function processShiftReminders(string $employeeId, array $open, ?array $shift): void
    {
        if (!$shift) {
            return;
        }
        $userId = $this->notifications->userIdForEmployee($employeeId);
        if (!$userId) {
            return;
        }

        $sessionId = (string) $open['id'];
        $phase = $shift['phase'] ?? 'normal';
        $endLabel = $shift['shift_end'] ?? 'shift end';

        if ($phase === 'ending_soon' && !$this->notifications->existsForRelated($userId, 'shift_ending_soon', $sessionId)) {
            $mins = max(1, (int) ($shift['minutes_until_end'] ?? self::ENDING_SOON_MINUTES));
            $this->notifications->create(
                $userId,
                'shift_ending_soon',
                'Shift ending soon',
                "Your shift ends in about {$mins} minutes ({$endLabel}). Tap End shift when you finish duty.",
                $sessionId,
                '/'
            );
        }

        if ($phase === 'overdue' && !$this->notifications->existsForRelated($userId, 'shift_end_reminder', $sessionId)) {
            $this->notifications->create(
                $userId,
                'shift_end_reminder',
                'Please clock out',
                "Your scheduled shift ended at {$endLabel}. You are still clocked in — tap End shift when you leave.",
                $sessionId,
                '/'
            );
        }
    }

    private function tryPeerShiftEndClockOut(array $open, ?array $shift): ?array
    {
        if (!$shift || empty($shift['has_shift']) || ($shift['phase'] ?? '') !== 'overdue') {
            return null;
        }

        $endTs = isset($shift['shift_end_at']) ? strtotime((string) $shift['shift_end_at']) : false;
        if ($endTs === false || time() < $endTs + self::PEER_CLOCKOUT_GRACE_MINUTES * 60) {
            return null;
        }

        $employeeId = (string) $open['employee_id'];
        $shiftRow = $this->resolveShift($open, $employeeId);
        if (!$shiftRow) {
            return null;
        }

        $stmt = Database::connection()->prepare(
            'SELECT MIN(a.clock_out) AS peer_out
             FROM attendance a
             INNER JOIN shift_assignments sa ON sa.employee_id = a.employee_id
               AND sa.shift_date = :shift_date
               AND sa.start_time = :start_time
               AND sa.end_time = :end_time
             INNER JOIN employees e ON e.id = a.employee_id
             WHERE sa.employee_id != :eid
               AND e.branch_id = (SELECT branch_id FROM employees WHERE id = :eid2 LIMIT 1)
               AND DATE(a.clock_in) = :shift_date2
               AND a.clock_out IS NOT NULL
               AND a.clock_out > :clock_in
               AND a.clock_out <= NOW()'
        );
        $stmt->execute([
            'shift_date' => $shiftRow['shift_date'],
            'shift_date2' => $shiftRow['shift_date'],
            'start_time' => $shiftRow['start_time'],
            'end_time' => $shiftRow['end_time'],
            'eid' => $employeeId,
            'eid2' => $employeeId,
            'clock_in' => $open['clock_in'],
        ]);
        $peerOut = $stmt->fetchColumn();
        if (!$peerOut) {
            return null;
        }

        return $this->closeSession($open, (string) $peerOut, 'auto_peer_shift_end', null, null, null);
    }

    private function closeSession(
        array $open,
        string $clockOutAt,
        string $clockOutType,
        ?float $latitude,
        ?float $longitude,
        ?string $address
    ): array {
        $pdo = Database::connection();
        $worked = $this->workedHours((string) $open['clock_in'], $clockOutAt, $open);
        $hourSplit = $this->computeHourSplit(array_merge($open, ['clock_out' => $clockOutAt, 'actual_hours' => $worked]));

        $sets = [
            'clock_out = :cout',
            'actual_hours = :hrs',
        ];
        $params = [
            'id' => $open['id'],
            'cout' => $clockOutAt,
            'hrs' => $worked,
        ];

        if (Schema::hasColumn('attendance', 'regular_hours')) {
            $sets[] = 'regular_hours = :reg';
            $sets[] = 'overtime_hours = :ot';
            $params['reg'] = $hourSplit['regular'];
            $params['ot'] = $hourSplit['overtime'];
        }
        if (Schema::hasColumn('attendance', 'clock_out_type')) {
            $sets[] = 'clock_out_type = :cot';
            $params['cot'] = $clockOutType;
        }
        if (Schema::hasColumn('attendance', 'outside_since')) {
            $sets[] = 'outside_since = NULL';
        }
        if (Schema::hasColumn('attendance', 'clock_out_address')) {
            $sets[] = 'latitude = COALESCE(:lat, latitude)';
            $sets[] = 'longitude = COALESCE(:lng, longitude)';
            $sets[] = 'clock_out_address = COALESCE(:addr, clock_out_address)';
            $params['lat'] = $latitude;
            $params['lng'] = $longitude;
            $params['addr'] = $address;
        } else {
            $sets[] = 'latitude = COALESCE(:lat, latitude)';
            $sets[] = 'longitude = COALESCE(:lng, longitude)';
            $params['lat'] = $latitude;
            $params['lng'] = $longitude;
        }

        $pdo->prepare('UPDATE attendance SET ' . implode(', ', $sets) . ' WHERE id = :id')->execute($params);

        $this->syncOvertimeRecord(
            $open['id'],
            $open['employee_id'],
            $open['clock_in'],
            $hourSplit['overtime'],
            $hourSplit['reason'] . ' (' . $this->clockOutTypeLabel($clockOutType) . ')'
        );

        $stmt = $pdo->prepare('SELECT * FROM attendance WHERE id = :id');
        $stmt->execute(['id' => $open['id']]);

        return $stmt->fetch() ?: [];
    }

    private function cascadeMidnightClockOut(?string $branchId, string $clockOutAt, string $triggerEmployeeId): void
    {
        if ($branchId === null || $branchId === '') {
            return;
        }

        $stmt = Database::connection()->prepare(
            'SELECT a.* FROM attendance a
             INNER JOIN employees e ON e.id = a.employee_id
             WHERE a.clock_out IS NULL AND e.branch_id = :bid AND a.employee_id != :eid'
        );
        $stmt->execute(['bid' => $branchId, 'eid' => $triggerEmployeeId]);

        foreach ($stmt->fetchAll() as $open) {
            $this->closeSession($open, $clockOutAt, 'auto_midnight_cascade', null, null, null);
        }
    }

    private function computeHourSplit(array $record): array
    {
        $clockIn = (string) $record['clock_in'];
        $clockOut = (string) ($record['clock_out'] ?? '');
        $worked = isset($record['actual_hours']) && $record['actual_hours'] !== null
            ? (float) $record['actual_hours']
            : $this->workedHours($clockIn, $clockOut, $record);

        $otFromCap = max(0.0, round($worked - self::MAX_REGULAR_HOURS, 2));
        $otFromSchedule = $this->overtimePastScheduleEnd($record, $clockOut);
        $overtime = round(max($otFromCap, $otFromSchedule), 2);
        $regular = round(max(0.0, $worked - $overtime), 2);

        $reasons = [];
        if ($otFromCap > 0) {
            $reasons[] = 'Exceeded ' . self::MAX_REGULAR_HOURS . 'h regular cap';
        }
        if ($otFromSchedule > 0) {
            $reasons[] = 'Worked past scheduled shift end';
        }

        return [
            'worked' => $worked,
            'regular' => $regular,
            'overtime' => $overtime,
            'reason' => $reasons !== [] ? implode('; ', $reasons) : 'Auto-detected overtime',
        ];
    }

    private function overtimePastScheduleEnd(array $record, string $clockOut): float
    {
        $shift = $this->resolveShift($record, (string) $record['employee_id']);
        if (!$shift || empty($shift['shift_date']) || empty($shift['end_time'])) {
            return 0.0;
        }

        $scheduledEnd = $this->shiftEndTimestamp(
            (string) $shift['shift_date'],
            (string) ($shift['start_time'] ?? '00:00:00'),
            (string) $shift['end_time']
        );
        $endTs = strtotime($clockOut);
        if ($scheduledEnd === false || $endTs === false || $endTs <= $scheduledEnd) {
            return 0.0;
        }

        return round(($endTs - $scheduledEnd) / 3600, 2);
    }

    private function workedHours(string $clockIn, string $clockOut, array $record): float
    {
        $minutes = (int) round((strtotime($clockOut) - strtotime($clockIn)) / 60);
        if (!empty($record['break_start']) && !empty($record['break_end'])) {
            $breakMins = (int) round((strtotime((string) $record['break_end']) - strtotime((string) $record['break_start'])) / 60);
            $minutes = max(0, $minutes - $breakMins);
        }
        return round($minutes / 60, 2);
    }

    private function syncOvertimeRecord(
        string $attendanceId,
        string $employeeId,
        string $clockIn,
        float $overtimeHours,
        string $reason
    ): void {
        if ($overtimeHours <= 0) {
            return;
        }
        $this->overtime->upsertAutoFromAttendance(
            $attendanceId,
            $employeeId,
            date('Y-m-d', strtotime($clockIn)),
            $overtimeHours,
            $reason
        );
    }

    private function persistHourSplit(string $attendanceId, float $regular, float $overtime, float $worked): void
    {
        if (!Schema::hasColumn('attendance', 'regular_hours')) {
            return;
        }
        Database::connection()->prepare(
            'UPDATE attendance SET actual_hours = :w, regular_hours = :r, overtime_hours = :o WHERE id = :id'
        )->execute(['w' => $worked, 'r' => $regular, 'o' => $overtime, 'id' => $attendanceId]);
    }

    private function resolveShift(array $record, string $employeeId): ?array
    {
        if (!empty($record['shift_assignment_id'])) {
            $stmt = Database::connection()->prepare('SELECT * FROM shift_assignments WHERE id = :id LIMIT 1');
            $stmt->execute(['id' => $record['shift_assignment_id']]);
            $row = $stmt->fetch();
            if ($row) {
                return $row;
            }
        }
        return $this->shiftForDate($employeeId, date('Y-m-d', strtotime((string) $record['clock_in'])));
    }

    private function shiftForDate(string $employeeId, string $date): ?array
    {
        $stmt = Database::connection()->prepare(
            'SELECT * FROM shift_assignments WHERE employee_id = :eid AND shift_date = :d ORDER BY start_time LIMIT 1'
        );
        $stmt->execute(['eid' => $employeeId, 'd' => $date]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    private function shiftTimestamp(string $date, string $time): int|false
    {
        return strtotime($date . ' ' . $time);
    }

    /** Handles overnight shifts (e.g. 15:00–00:00 ends next calendar day). */
    private function shiftEndTimestamp(string $date, string $startTime, string $endTime): int|false
    {
        $startTs = strtotime($date . ' ' . $startTime);
        $endTs = strtotime($date . ' ' . $endTime);
        if ($startTs === false || $endTs === false) {
            return false;
        }
        if ($endTs <= $startTs) {
            $endTs = strtotime($date . ' ' . $endTime . ' +1 day');
        }
        return $endTs;
    }

    private function isPastMidnight(string $clockIn, string $clockOut): bool
    {
        $shiftDate = date('Y-m-d', strtotime($clockIn));
        $midnight = strtotime($shiftDate . ' +1 day midnight');
        return $midnight !== false && strtotime($clockOut) >= $midnight;
    }

    private function ensureOutsideSince(array $open): string
    {
        if (Schema::hasColumn('attendance', 'outside_since') && !empty($open['outside_since'])) {
            return (string) $open['outside_since'];
        }

        $now = date('Y-m-d H:i:s');
        if (Schema::hasColumn('attendance', 'outside_since')) {
            Database::connection()->prepare(
                'UPDATE attendance SET outside_since = :s WHERE id = :id'
            )->execute(['s' => $now, 'id' => $open['id']]);
        }

        return $now;
    }

    private function clearOutsideSince(string $attendanceId): void
    {
        if (!Schema::hasColumn('attendance', 'outside_since')) {
            return;
        }
        Database::connection()->prepare(
            'UPDATE attendance SET outside_since = NULL WHERE id = :id'
        )->execute(['id' => $attendanceId]);
    }

    private function employeeBranchId(string $employeeId): ?string
    {
        $stmt = Database::connection()->prepare('SELECT branch_id FROM employees WHERE id = :id LIMIT 1');
        $stmt->execute(['id' => $employeeId]);
        $emp = $stmt->fetch();
        return $emp['branch_id'] ?? null;
    }

    private function clockOutTypeLabel(string $type): string
    {
        return match ($type) {
            'auto_outside' => 'auto clock-out: outside vicinity 5+ min (past 9h or midnight)',
            'auto_midnight_cascade' => 'auto clock-out: midnight cascade',
            'auto_peer_shift_end' => 'auto clock-out: matched coworker shift end',
            default => 'manual clock-out',
        };
    }
}
