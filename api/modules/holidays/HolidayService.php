<?php

declare(strict_types=1);

namespace Hg\Api\Modules\Holidays;

use Hg\Api\Core\Database;

final class HolidayService
{
    public function list(?string $branchId = null, ?int $year = null): array
    {
        $sql = 'SELECT h.*, b.name AS branch_name FROM holidays h
                LEFT JOIN branches b ON b.id = h.branch_id WHERE 1=1';
        $params = [];
        if ($branchId) {
            $sql .= ' AND (h.branch_id = :bid OR h.branch_id IS NULL)';
            $params['bid'] = $branchId;
        }
        if ($year) {
            $sql .= ' AND YEAR(h.holiday_date) = :yr';
            $params['yr'] = $year;
        }
        $sql .= ' ORDER BY h.holiday_date';
        $stmt = Database::connection()->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll();
    }

    public function get(string $id): ?array
    {
        $stmt = Database::connection()->prepare('SELECT * FROM holidays WHERE id = :id LIMIT 1');
        $stmt->execute(['id' => $id]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public function create(array $data): array
    {
        $id = Database::uuid();
        Database::connection()->prepare(
            'INSERT INTO holidays (id, branch_id, holiday_date, name, holiday_type, pay_multiplier)
             VALUES (:id, :bid, :dt, :name, :type, :mult)'
        )->execute([
            'id' => $id,
            'bid' => $data['branch_id'] ?? null,
            'dt' => $data['holiday_date'],
            'name' => $data['name'],
            'type' => $data['holiday_type'] ?? 'national',
            'mult' => $data['pay_multiplier'] ?? 1.30,
        ]);
        return $this->get($id) ?? [];
    }

    public function update(string $id, array $data): ?array
    {
        if (!$this->get($id)) {
            return null;
        }
        $map = [
            'branch_id' => 'branch_id',
            'holiday_date' => 'holiday_date',
            'name' => 'name',
            'holiday_type' => 'holiday_type',
            'pay_multiplier' => 'pay_multiplier',
        ];
        $sets = [];
        $params = ['id' => $id];
        foreach ($map as $key => $col) {
            if (array_key_exists($key, $data)) {
                $sets[] = "{$col} = :{$key}";
                $params[$key] = $data[$key];
            }
        }
        if ($sets === []) {
            return $this->get($id);
        }
        Database::connection()->prepare(
            'UPDATE holidays SET ' . implode(', ', $sets) . ' WHERE id = :id'
        )->execute($params);
        return $this->get($id);
    }

    public function delete(string $id): bool
    {
        $stmt = Database::connection()->prepare('DELETE FROM holidays WHERE id = :id');
        $stmt->execute(['id' => $id]);
        return $stmt->rowCount() > 0;
    }

    /** Holidays on date for branch (national + branch-specific). */
    public function forDate(string $date, ?string $branchId): array
    {
        $sql = 'SELECT * FROM holidays WHERE holiday_date = :d AND (branch_id IS NULL';
        $params = ['d' => $date];
        if ($branchId) {
            $sql .= ' OR branch_id = :bid';
            $params['bid'] = $branchId;
        }
        $sql .= ')';
        $stmt = Database::connection()->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll();
    }

    public function holidayHoursInPeriod(string $employeeId, string $from, string $to, ?string $branchId): float
    {
        $pdo = Database::connection();
        $stmt = $pdo->prepare(
            'SELECT COALESCE(SUM(a.actual_hours), 0)
             FROM attendance a
             WHERE a.employee_id = :eid AND DATE(a.clock_in) BETWEEN :f AND :t
               AND EXISTS (
                 SELECT 1 FROM holidays h
                 WHERE h.holiday_date = DATE(a.clock_in)
                   AND (h.branch_id IS NULL OR h.branch_id = :bid)
               )'
        );
        $stmt->execute(['eid' => $employeeId, 'f' => $from, 't' => $to, 'bid' => $branchId]);
        return round((float) $stmt->fetchColumn(), 2);
    }

    public function holidayPremiumPay(string $employeeId, string $from, string $to, ?string $branchId, float $hourly): float
    {
        $pdo = Database::connection();
        $stmt = $pdo->prepare(
            'SELECT a.actual_hours, h.pay_multiplier
             FROM attendance a
             INNER JOIN holidays h ON h.holiday_date = DATE(a.clock_in)
               AND (h.branch_id IS NULL OR h.branch_id = :bid)
             WHERE a.employee_id = :eid AND DATE(a.clock_in) BETWEEN :f AND :t'
        );
        $stmt->execute(['eid' => $employeeId, 'f' => $from, 't' => $to, 'bid' => $branchId]);
        $premium = 0.0;
        foreach ($stmt->fetchAll() as $row) {
            $hrs = (float) $row['actual_hours'];
            $mult = (float) $row['pay_multiplier'];
            $premium += $hrs * $hourly * max(0, $mult - 1.0);
        }
        return round($premium, 2);
    }
}
