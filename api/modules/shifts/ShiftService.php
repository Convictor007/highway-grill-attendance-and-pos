<?php

declare(strict_types=1);

namespace Hg\Api\Modules\Shifts;

use Hg\Api\Core\Database;

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
                INNER JOIN branches b ON b.id = s.branch_id WHERE 1=1';
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
        $id = Database::uuid();
        Database::connection()->prepare(
            'INSERT INTO schedules (id, branch_id, week_start, status, published_by, published_at)
             VALUES (:id, :bid, :ws, :st, :uid, NOW())'
        )->execute([
            'id' => $id,
            'bid' => $data['branch_id'],
            'ws' => $data['week_start'],
            'st' => $data['status'] ?? 'published',
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
            'SELECT sa.*, st.name AS shift_name, st.color_hex
             FROM shift_assignments sa
             LEFT JOIN shift_templates st ON st.id = sa.shift_template_id
             WHERE sa.employee_id = :eid AND sa.shift_date BETWEEN :f AND :t
             ORDER BY sa.shift_date, sa.start_time'
        );
        $stmt->execute(['eid' => $employeeId, 'f' => $from, 't' => $to]);
        return $stmt->fetchAll();
    }

    public function deleteAssignment(string $id): bool
    {
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

        $dayDefs = [
            ['label' => 'SUN', 'highlight' => false],
            ['label' => 'MON', 'highlight' => true, 'footnote' => 'GENERAL CLEANING'],
            ['label' => 'TUE', 'highlight' => false],
            ['label' => 'WED', 'highlight' => false],
            ['label' => 'THU', 'highlight' => true, 'footnote' => 'GENERAL CLEANING'],
            ['label' => 'FRI', 'highlight' => false],
            ['label' => 'SAT', 'highlight' => false],
        ];

        $days = [];
        for ($i = 0; $i < 7; $i++) {
            $date = date('Y-m-d', strtotime($weekStart . " +$i days"));
            $days[] = array_merge($dayDefs[$i], [
                'date' => $date,
                'is_today' => $date === $today,
                'is_tomorrow' => $date === $tomorrow,
            ]);
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
            'SELECT sa.id, sa.employee_id, sa.shift_date, sa.start_time, sa.end_time
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
                    $cells[] = [
                        'date' => $day['date'],
                        'label' => $this->formatShiftLabel((string) $a['start_time'], (string) $a['end_time']),
                        'off' => false,
                        'assignment_id' => $a['id'],
                        'start_time' => $a['start_time'],
                        'end_time' => $a['end_time'],
                    ];
                } else {
                    $cells[] = [
                        'date' => $day['date'],
                        'label' => 'OFF',
                        'off' => true,
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

        return [
            'title' => 'SCHEDULE',
            'branch_id' => $branchId,
            'branch_name' => $branchName,
            'current_date' => $today,
            'week_start' => $weekStart,
            'week_end' => $weekEnd,
            'is_current_week' => $today >= $weekStart && $today <= $weekEnd,
            'days' => $days,
            'footnotes' => [
                ['day_label' => 'MON', 'text' => 'GENERAL CLEANING'],
                ['day_label' => 'THU', 'text' => 'GENERAL CLEANING'],
            ],
            'rows' => $rows,
        ];
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
