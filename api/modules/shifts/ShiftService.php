<?php

declare(strict_types=1);

namespace Hg\Api\Modules\Shifts;

use Hg\Api\Core\Database;
use Hg\Api\Core\Schema;

final class ShiftService
{
    public function templates(?string $branchId = null): array
    {
        $sql = 'SELECT st.*, b.name AS branch_name FROM shift_templates st
                INNER JOIN branches b ON b.id = st.branch_id WHERE 1=1';
        $params = [];
        if ($branchId) {
            $sql .= ' AND st.branch_id = :b';
            $params['b'] = $branchId;
        }
        $sql .= ' ORDER BY b.name, st.start_time';
        $stmt = Database::connection()->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll();
    }

    public function schedules(?string $branchId = null): array
    {
        $sql = 'SELECT s.*, b.name AS branch_name FROM schedules s
                INNER JOIN branches b ON b.id = s.branch_id
                WHERE s.week_start > \'2000-01-01\'';
        $params = [];
        if ($branchId) {
            $sql .= ' AND s.branch_id = :b';
            $params['b'] = $branchId;
        }
        $sql .= ' ORDER BY s.week_start DESC';
        $stmt = Database::connection()->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll();
    }

    public function createSchedule(array $data, string $userId): array
    {
        if (empty($data['branch_id']) || empty($data['week_start'])) {
            throw new \InvalidArgumentException('branch_id and week_start are required');
        }
        $weekStart = $this->normalizeWeekStartSunday((string) $data['week_start']);
        if ($weekStart === '0000-00-00' || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $weekStart)) {
            throw new \InvalidArgumentException('Invalid week_start');
        }

        $id = Database::uuid();
        Database::connection()->prepare(
            'INSERT INTO schedules (id, branch_id, week_start, status, published_by, published_at)
             VALUES (:id, :bid, :ws, :st, :uid, NOW())'
        )->execute([
            'id' => $id,
            'bid' => $data['branch_id'],
            'ws' => $weekStart,
            'st' => $data['status'] ?? 'draft',
            'uid' => $userId,
        ]);
        $stmt = Database::connection()->prepare('SELECT * FROM schedules WHERE id = :id');
        $stmt->execute(['id' => $id]);
        return $stmt->fetch();
    }

    public function assignments(?string $scheduleId = null): array
    {
        $sql = 'SELECT sa.*, e.emp_number, e.first_name, e.last_name, st.name AS shift_name
                FROM shift_assignments sa
                INNER JOIN employees e ON e.id = sa.employee_id
                LEFT JOIN shift_templates st ON st.id = sa.shift_template_id
                WHERE 1=1';
        $params = [];
        if ($scheduleId) {
            $sql .= ' AND sa.schedule_id = :sid';
            $params['sid'] = $scheduleId;
        }
        $sql .= ' ORDER BY sa.shift_date, sa.start_time';
        $stmt = Database::connection()->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll();
    }

    public function addAssignment(array $data): array
    {
        $this->assertScheduleEditable((string) $data['schedule_id']);
        $id = Database::uuid();
        Database::connection()->prepare(
            'INSERT INTO shift_assignments (id, schedule_id, employee_id, shift_template_id,
             shift_date, start_time, end_time, break_mins, notes)
             VALUES (:id, :sid, :eid, :tid, :sd, :st, :et, :bm, :notes)'
        )->execute([
            'id' => $id,
            'sid' => $data['schedule_id'],
            'eid' => $data['employee_id'],
            'tid' => $data['shift_template_id'] ?? null,
            'sd' => $data['shift_date'],
            'st' => $data['start_time'],
            'et' => $data['end_time'],
            'bm' => $data['break_mins'] ?? 0,
            'notes' => $data['notes'] ?? null,
        ]);
        $stmt = Database::connection()->prepare('SELECT * FROM shift_assignments WHERE id = :id');
        $stmt->execute(['id' => $id]);
        return $stmt->fetch();
    }

    public function createTemplate(array $data): array
    {
        $id = Database::uuid();
        Database::connection()->prepare(
            'INSERT INTO shift_templates (id, branch_id, name, start_time, end_time, break_mins, color_hex)
             VALUES (:id, :bid, :name, :st, :et, :bm, :color)'
        )->execute([
            'id' => $id,
            'bid' => $data['branch_id'],
            'name' => $data['name'],
            'st' => $data['start_time'],
            'et' => $data['end_time'],
            'bm' => $data['break_mins'] ?? 0,
            'color' => $data['color_hex'] ?? null,
        ]);
        $stmt = Database::connection()->prepare('SELECT * FROM shift_templates WHERE id = :id');
        $stmt->execute(['id' => $id]);
        return $stmt->fetch();
    }

    public function updateTemplate(string $id, array $data): ?array
    {
        $fields = ['branch_id', 'name', 'start_time', 'end_time', 'break_mins', 'color_hex'];
        $sets = [];
        $params = ['id' => $id];
        foreach ($fields as $f) {
            if (array_key_exists($f, $data)) {
                $sets[] = "$f = :$f";
                $params[$f] = $data[$f];
            }
        }
        if ($sets === []) {
            $stmt = Database::connection()->prepare('SELECT * FROM shift_templates WHERE id = :id');
            $stmt->execute(['id' => $id]);
            return $stmt->fetch() ?: null;
        }
        Database::connection()->prepare('UPDATE shift_templates SET ' . implode(', ', $sets) . ' WHERE id = :id')
            ->execute($params);
        $stmt = Database::connection()->prepare(
            'SELECT st.*, b.name AS branch_name FROM shift_templates st
             INNER JOIN branches b ON b.id = st.branch_id WHERE st.id = :id'
        );
        $stmt->execute(['id' => $id]);
        return $stmt->fetch() ?: null;
    }

    public function myShifts(string $employeeId, ?string $from = null, ?string $to = null): array
    {
        $from ??= date('Y-m-d', strtotime('monday this week'));
        $to ??= date('Y-m-d', strtotime('sunday this week'));
        $stmt = Database::connection()->prepare(
            'SELECT sa.*, st.name AS shift_name, st.color_hex, sch.status AS schedule_status
             FROM shift_assignments sa
             INNER JOIN schedules sch ON sch.id = sa.schedule_id
             LEFT JOIN shift_templates st ON st.id = sa.shift_template_id
             WHERE sa.employee_id = :eid AND sa.shift_date BETWEEN :f AND :t
               AND sch.status IN (\'published\', \'locked\')
             ORDER BY sa.shift_date, sa.start_time'
        );
        $stmt->execute(['eid' => $employeeId, 'f' => $from, 't' => $to]);
        return $stmt->fetchAll();
    }

    public function getSchedule(string $id): ?array
    {
        $stmt = Database::connection()->prepare(
            'SELECT s.*, b.name AS branch_name FROM schedules s
             INNER JOIN branches b ON b.id = s.branch_id WHERE s.id = :id LIMIT 1'
        );
        $stmt->execute(['id' => $id]);
        $row = $stmt->fetch();

        return $row ?: null;
    }

    public function updateSchedule(string $id, array $data, string $userId): ?array
    {
        $existing = $this->getSchedule($id);
        if (!$existing) {
            return null;
        }

        $sets = [];
        $params = ['id' => $id];

        if (!empty($data['status'])) {
            $status = (string) $data['status'];
            $allowed = ['draft', 'published'];
            if (!in_array($status, $allowed, true)) {
                throw new \InvalidArgumentException('Invalid schedule status');
            }

            $sets[] = 'status = :st';
            $params['st'] = $status;
            if ($status === 'published') {
                $sets[] = 'published_by = :uid';
                $sets[] = 'published_at = NOW()';
                $params['uid'] = $userId;
            }
        }

        if (array_key_exists('day_footnotes', $data) && Schema::hasColumn('schedules', 'day_footnotes')) {
            $sets[] = 'day_footnotes = :df';
            $params['df'] = json_encode($data['day_footnotes'], JSON_THROW_ON_ERROR);
        }

        if ($sets === []) {
            return $existing;
        }

        Database::connection()->prepare('UPDATE schedules SET ' . implode(', ', $sets) . ' WHERE id = :id')
            ->execute($params);

        return $this->getSchedule($id);
    }

    public function updateAssignment(string $id, array $data): ?array
    {
        $stmt = Database::connection()->prepare(
            'SELECT sa.* FROM shift_assignments sa WHERE sa.id = :id LIMIT 1'
        );
        $stmt->execute(['id' => $id]);
        $existing = $stmt->fetch();
        if (!$existing) {
            return null;
        }

        $this->assertScheduleEditable((string) $existing['schedule_id']);

        $fields = ['shift_template_id', 'start_time', 'end_time', 'break_mins', 'notes'];
        $sets = [];
        $params = ['id' => $id];
        foreach ($fields as $f) {
            if (array_key_exists($f, $data)) {
                $sets[] = "$f = :$f";
                $params[$f] = $data[$f];
            }
        }
        if ($sets === []) {
            return $existing;
        }

        Database::connection()->prepare('UPDATE shift_assignments SET ' . implode(', ', $sets) . ' WHERE id = :id')
            ->execute($params);

        $stmt = Database::connection()->prepare('SELECT * FROM shift_assignments WHERE id = :id');
        $stmt->execute(['id' => $id]);

        return $stmt->fetch() ?: null;
    }

    public function upsertRosterCell(array $data, string $userId): array
    {
        $branchId = (string) ($data['branch_id'] ?? '');
        $weekStart = $this->normalizeWeekStartSunday($data['week_start'] ?? null);
        $employeeId = (string) ($data['employee_id'] ?? '');
        $shiftDate = (string) ($data['shift_date'] ?? '');

        if ($branchId === '' || $employeeId === '' || $shiftDate === '') {
            throw new \InvalidArgumentException('branch_id, employee_id, and shift_date are required');
        }

        $schedule = $this->ensureSchedule($branchId, $weekStart, $userId);
        $this->assertScheduleEditable((string) $schedule['id']);

        Database::connection()->prepare(
            'DELETE FROM shift_assignments WHERE schedule_id = :sid AND employee_id = :eid AND shift_date = :sd'
        )->execute([
            'sid' => $schedule['id'],
            'eid' => $employeeId,
            'sd' => $shiftDate,
        ]);

        if (!empty($data['off'])) {
            $restId = Database::uuid();
            Database::connection()->prepare(
                'INSERT INTO shift_assignments (id, schedule_id, employee_id, shift_template_id, shift_date, start_time, end_time, break_mins, notes)
                 VALUES (:id, :sid, :eid, NULL, :sd, \'00:00:00\', \'00:00:00\', 0, \'REST_DAY\')'
            )->execute([
                'id' => $restId,
                'sid' => $schedule['id'],
                'eid' => $employeeId,
                'sd' => $shiftDate,
            ]);

            return ['schedule_id' => $schedule['id'], 'rest_day' => true, 'assignment_id' => $restId];
        }

        if (empty($data['start_time']) || empty($data['end_time'])) {
            throw new \InvalidArgumentException('start_time and end_time are required when assigning a shift');
        }

        $assignment = $this->addAssignment([
            'schedule_id' => $schedule['id'],
            'employee_id' => $employeeId,
            'shift_template_id' => $data['shift_template_id'] ?? null,
            'shift_date' => $shiftDate,
            'start_time' => $data['start_time'],
            'end_time' => $data['end_time'],
            'break_mins' => $data['break_mins'] ?? 0,
            'notes' => $data['notes'] ?? null,
        ]);

        return ['schedule_id' => $schedule['id'], 'assignment' => $assignment];
    }

    public function ensureSchedule(string $branchId, string $weekStart, string $userId): array
    {
        $existing = $this->findScheduleForWeek($branchId, $weekStart);
        if ($existing) {
            return $existing;
        }

        return $this->createSchedule([
            'branch_id' => $branchId,
            'week_start' => $weekStart,
            'status' => 'draft',
        ], $userId);
    }

    private function findScheduleForWeek(string $branchId, string $weekStart): ?array
    {
        $stmt = Database::connection()->prepare(
            'SELECT * FROM schedules WHERE branch_id = :bid AND week_start = :ws LIMIT 1'
        );
        $stmt->execute(['bid' => $branchId, 'ws' => $weekStart]);
        $row = $stmt->fetch();

        return $row ?: null;
    }

    /** @return array<int, string> */
    private function resolveDayFootnotes(?array $schedule): array
    {
        if (!$schedule || !Schema::hasColumn('schedules', 'day_footnotes')) {
            return [];
        }

        $raw = $schedule['day_footnotes'] ?? null;
        if ($raw === null || $raw === '') {
            return [];
        }

        $decoded = is_string($raw) ? json_decode($raw, true) : $raw;
        if (!is_array($decoded)) {
            return [];
        }

        $out = [];
        foreach ($decoded as $idx => $text) {
            $i = (int) $idx;
            $t = trim((string) $text);
            if ($t !== '') {
                $out[$i] = $t;
            }
        }

        return $out;
    }

    public function deleteAssignment(string $id): bool
    {
        $sched = Database::connection()->prepare(
            'SELECT sa.schedule_id FROM shift_assignments sa WHERE sa.id = :id LIMIT 1'
        );
        $sched->execute(['id' => $id]);
        $row = $sched->fetch();
        if ($row) {
            $this->assertScheduleEditable((string) $row['schedule_id']);
        }
        $stmt = Database::connection()->prepare('DELETE FROM shift_assignments WHERE id = :id');
        $stmt->execute(['id' => $id]);
        return $stmt->rowCount() > 0;
    }

    /** Sunday-based week grid (Excel-style roster). */
    public function rosterGrid(?string $branchId, ?string $weekStart = null): array
    {
        if ($branchId === null || $branchId === '') {
            throw new \InvalidArgumentException('branch_id is required');
        }

        $weekStart = $this->normalizeWeekStartSunday($weekStart);
        $weekEnd = date('Y-m-d', strtotime($weekStart . ' +6 days'));
        $today = date('Y-m-d');
        $tomorrow = date('Y-m-d', strtotime('+1 day'));

        $schedule = $this->findScheduleForWeek($branchId, $weekStart);
        $dayFootnotes = $this->resolveDayFootnotes($schedule);

        $dayLabels = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
        $days = [];
        for ($i = 0; $i < 7; $i++) {
            $date = date('Y-m-d', strtotime($weekStart . " +$i days"));
            $footnote = $dayFootnotes[$i] ?? null;
            $days[] = [
                'label' => $dayLabels[$i],
                'highlight' => $footnote !== null,
                'footnote' => $footnote,
                'day_index' => $i,
                'date' => $date,
                'is_today' => $date === $today,
                'is_tomorrow' => $date === $tomorrow,
            ];
        }

        $branchStmt = Database::connection()->prepare('SELECT name FROM branches WHERE id = :id LIMIT 1');
        $branchStmt->execute(['id' => $branchId]);
        $branchName = $branchStmt->fetchColumn() ?: null;

        $empStmt = Database::connection()->prepare(
            'SELECT e.id, e.emp_number, e.first_name, e.last_name, d.name AS department_name
             FROM employees e
             LEFT JOIN departments d ON d.id = e.department_id
             WHERE e.branch_id = :bid AND e.status = :st
             ORDER BY COALESCE(d.name, \'zzz\'), e.last_name, e.first_name'
        );
        $empStmt->execute(['bid' => $branchId, 'st' => 'active']);
        $employees = $empStmt->fetchAll();

        $assignStmt = Database::connection()->prepare(
            'SELECT sa.id, sa.employee_id, sa.shift_date, sa.start_time, sa.end_time, sa.notes
             FROM shift_assignments sa
             INNER JOIN schedules sch ON sch.id = sa.schedule_id
             WHERE sch.branch_id = :bid
               AND sa.shift_date BETWEEN :from AND :to
               AND sch.status IN (\'published\', \'draft\', \'locked\')
             ORDER BY sa.shift_date, sa.start_time'
        );
        $assignStmt->execute(['bid' => $branchId, 'from' => $weekStart, 'to' => $weekEnd]);
        $byEmployeeDate = [];
        foreach ($assignStmt->fetchAll() as $a) {
            $key = $a['employee_id'] . '|' . $a['shift_date'];
            $byEmployeeDate[$key] = $a;
        }

        $rows = [];
        $prevDept = null;
        foreach ($employees as $emp) {
            $dept = $emp['department_name'] ?? '';
            $sectionDivider = $prevDept !== null && $dept !== $prevDept;
            $prevDept = $dept;

            $cells = [];
            foreach ($days as $day) {
                $key = $emp['id'] . '|' . $day['date'];
                if (isset($byEmployeeDate[$key])) {
                    $a = $byEmployeeDate[$key];
                    $isRest = ($a['notes'] ?? '') === 'REST_DAY';
                    if ($isRest) {
                        $cells[] = [
                            'date' => $day['date'],
                            'status' => 'day_off',
                            'label' => 'Day off',
                            'off' => true,
                            'assignment_id' => $a['id'],
                        ];
                    } else {
                        $cells[] = [
                            'date' => $day['date'],
                            'status' => 'working',
                            'label' => $this->formatShiftLabel((string) $a['start_time'], (string) $a['end_time']),
                            'off' => false,
                            'assignment_id' => $a['id'],
                            'start_time' => $a['start_time'],
                            'end_time' => $a['end_time'],
                        ];
                    }
                } else {
                    $cells[] = [
                        'date' => $day['date'],
                        'status' => 'unset',
                        'label' => '',
                        'off' => false,
                    ];
                }
            }

            $rows[] = [
                'employee_id' => $emp['id'],
                'display_name' => trim($emp['first_name'] . ' ' . $emp['last_name']),
                'emp_number' => $emp['emp_number'],
                'department_name' => $dept !== '' ? $dept : null,
                'section_divider' => $sectionDivider,
                'cells' => $cells,
            ];
        }

        $footnotes = [];
        foreach ($days as $day) {
            if (!empty($day['footnote'])) {
                $footnotes[] = [
                    'day_index' => $day['day_index'],
                    'day_label' => $day['label'],
                    'text' => $day['footnote'],
                ];
            }
        }

        $scheduleStatus = $schedule['status'] ?? null;
        if ($scheduleStatus === 'locked') {
            $scheduleStatus = 'published';
        }

        return [
            'title' => 'SCHEDULE',
            'branch_id' => $branchId,
            'branch_name' => $branchName,
            'schedule_id' => $schedule['id'] ?? null,
            'schedule_status' => $scheduleStatus,
            'editable' => true,
            'current_date' => $today,
            'week_start' => $weekStart,
            'week_end' => $weekEnd,
            'is_current_week' => $today >= $weekStart && $today <= $weekEnd,
            'days' => $days,
            'footnotes' => $footnotes,
            'rows' => $rows,
        ];
    }

    private function assertScheduleEditable(string $scheduleId): void
    {
        $stmt = Database::connection()->prepare('SELECT status FROM schedules WHERE id = :id LIMIT 1');
        $stmt->execute(['id' => $scheduleId]);
        if (!$stmt->fetch()) {
            throw new \RuntimeException('Schedule not found');
        }
    }

    private function normalizeWeekStartSunday(?string $weekStart): string
    {
        $base = $weekStart !== null && $weekStart !== ''
            ? $weekStart
            : date('Y-m-d', strtotime('sunday this week'));
        $ts = strtotime($base);
        if ($ts === false) {
            return date('Y-m-d', strtotime('sunday this week'));
        }
        $dow = (int) date('w', $ts);
        if ($dow !== 0) {
            return date('Y-m-d', $ts - ($dow * 86400));
        }
        return date('Y-m-d', $ts);
    }

    private function formatShiftLabel(string $start, string $end): string
    {
        $sh = (int) substr($start, 0, 2);
        $eh = (int) substr($end, 0, 2);
        return $this->hour12($sh) . '-' . $this->hour12($eh);
    }

    private function hour12(int $h): string
    {
        if ($h === 0 || $h === 12) {
            return '12';
        }
        if ($h > 12) {
            return (string) ($h - 12);
        }
        return (string) $h;
    }

    /** Active branch coworkers for shift swap (no employees.view required). */
    public function coworkers(string $employeeId): array
    {
        $stmt = Database::connection()->prepare(
            'SELECT e.id, e.emp_number, e.first_name, e.last_name, e.branch_id, e.status
             FROM employees e
             INNER JOIN employees self ON self.branch_id = e.branch_id AND self.id = :eid
             WHERE e.id != :eid2 AND e.status = \'active\'
             ORDER BY e.last_name, e.first_name'
        );
        $stmt->execute(['eid' => $employeeId, 'eid2' => $employeeId]);
        return $stmt->fetchAll();
    }
}
