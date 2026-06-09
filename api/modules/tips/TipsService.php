<?php

declare(strict_types=1);

namespace Hg\Api\Modules\Tips;

use Hg\Api\Core\Database;

final class TipsService
{
    public function listPools(?string $branchId = null, ?int $limit = 50): array
    {
        $sql = 'SELECT tp.*, b.name AS branch_name FROM tips_pool tp
                INNER JOIN branches b ON b.id = tp.branch_id WHERE 1=1';
        $params = [];
        if ($branchId) {
            $sql .= ' AND tp.branch_id = :bid';
            $params['bid'] = $branchId;
        }
        $sql .= ' ORDER BY tp.pool_date DESC LIMIT ' . max(1, min((int) $limit, 100));
        $stmt = Database::connection()->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll();
    }

    public function getPool(string $id): ?array
    {
        $stmt = Database::connection()->prepare(
            'SELECT tp.*, b.name AS branch_name FROM tips_pool tp
             INNER JOIN branches b ON b.id = tp.branch_id WHERE tp.id = :id LIMIT 1'
        );
        $stmt->execute(['id' => $id]);
        return $stmt->fetch() ?: null;
    }

    public function createPool(array $data): array
    {
        $id = Database::uuid();
        Database::connection()->prepare(
            'INSERT INTO tips_pool (id, branch_id, pool_date, total_tips, shift_type, status)
             VALUES (:id, :bid, :dt, :total, :shift, :st)'
        )->execute([
            'id' => $id,
            'bid' => $data['branch_id'],
            'dt' => $data['pool_date'],
            'total' => $data['total_tips'],
            'shift' => $data['shift_type'] ?? 'all_day',
            'st' => 'pending',
        ]);
        return $this->getPool($id) ?? [];
    }

    public function distribute(string $poolId, array $allocations): array
    {
        $pool = $this->getPool($poolId);
        if (!$pool || $pool['status'] !== 'pending') {
            throw new \RuntimeException('Tips pool not found or already distributed');
        }
        $pdo = Database::connection();
        $pdo->beginTransaction();
        try {
            $pdo->prepare('DELETE FROM tips_distribution WHERE tips_pool_id = :id')->execute(['id' => $poolId]);
            $sumPct = 0.0;
            foreach ($allocations as $row) {
                $sumPct += (float) ($row['percentage'] ?? 0);
            }
            if (abs($sumPct - 100.0) > 0.5 && $sumPct > 0) {
                // normalize if close
            }
            $total = (float) $pool['total_tips'];
            foreach ($allocations as $row) {
                $pct = (float) $row['percentage'];
                $amt = round($total * ($pct / 100), 2);
                $pdo->prepare(
                    'INSERT INTO tips_distribution (id, tips_pool_id, employee_id, percentage, amount)
                     VALUES (:id, :pid, :eid, :pct, :amt)'
                )->execute([
                    'id' => Database::uuid(),
                    'pid' => $poolId,
                    'eid' => $row['employee_id'],
                    'pct' => $pct,
                    'amt' => $amt,
                ]);
            }
            $pdo->prepare("UPDATE tips_pool SET status = 'distributed' WHERE id = :id")->execute(['id' => $poolId]);
            $pdo->commit();
        } catch (\Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }
        return $this->distributions($poolId);
    }

    public function distributions(string $poolId): array
    {
        $stmt = Database::connection()->prepare(
            'SELECT td.*, e.first_name, e.last_name, e.emp_number
             FROM tips_distribution td
             INNER JOIN employees e ON e.id = td.employee_id
             WHERE td.tips_pool_id = :pid'
        );
        $stmt->execute(['pid' => $poolId]);
        return $stmt->fetchAll();
    }

    public function distributeEqualAmongTipped(string $poolId): array
    {
        $pool = $this->getPool($poolId);
        if (!$pool) {
            throw new \RuntimeException('Tips pool not found');
        }
        $stmt = Database::connection()->prepare(
            "SELECT e.id FROM employees e
             INNER JOIN positions p ON p.id = e.position_id
             WHERE e.branch_id = :bid AND e.status = 'active' AND p.is_tipped = 1
             ORDER BY e.last_name, e.first_name"
        );
        $stmt->execute(['bid' => $pool['branch_id']]);
        $employees = $stmt->fetchAll();
        if ($employees === []) {
            throw new \RuntimeException('No tipped employees in this branch');
        }
        $count = count($employees);
        $pctEach = round(100 / $count, 4);
        $allocations = [];
        foreach ($employees as $i => $emp) {
            $pct = $i === $count - 1 ? round(100 - ($pctEach * ($count - 1)), 4) : $pctEach;
            $allocations[] = ['employee_id' => $emp['id'], 'percentage' => $pct];
        }

        return $this->distribute($poolId, $allocations);
    }

    public function tipsForEmployeeInPeriod(string $employeeId, string $from, string $to): float
    {
        $stmt = Database::connection()->prepare(
            'SELECT COALESCE(SUM(td.amount), 0)
             FROM tips_distribution td
             INNER JOIN tips_pool tp ON tp.id = td.tips_pool_id
             WHERE td.employee_id = :eid AND tp.pool_date BETWEEN :f AND :t'
        );
        $stmt->execute(['eid' => $employeeId, 'f' => $from, 't' => $to]);
        return round((float) $stmt->fetchColumn(), 2);
    }
}
