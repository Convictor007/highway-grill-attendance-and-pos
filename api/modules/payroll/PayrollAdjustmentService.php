<?php

declare(strict_types=1);

namespace Hg\Api\Modules\Payroll;

use Hg\Api\Core\Database;

final class PayrollAdjustmentService
{
    public function list(?string $employeeId = null, ?string $runId = null, ?bool $recurringOnly = null): array
    {
        $sql = 'SELECT pa.*, e.emp_number, e.first_name, e.last_name
                FROM payroll_adjustments pa
                INNER JOIN employees e ON e.id = pa.employee_id WHERE 1=1';
        $params = [];
        if ($employeeId) {
            $sql .= ' AND pa.employee_id = :eid';
            $params['eid'] = $employeeId;
        }
        if ($runId) {
            $sql .= ' AND pa.payroll_run_id = :rid';
            $params['rid'] = $runId;
        }
        if ($recurringOnly === true) {
            $sql .= ' AND pa.payroll_run_id IS NULL';
        }
        $sql .= ' ORDER BY pa.created_at DESC';
        $stmt = Database::connection()->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll();
    }

    public function create(array $data, string $userId): array
    {
        $amount = round((float) ($data['amount'] ?? 0), 2);
        if ($amount == 0.0) {
            throw new \InvalidArgumentException('amount required');
        }
        $type = (string) ($data['adj_type'] ?? 'allowance');
        $allowed = ['bonus', 'advance', 'loan_repay', 'penalty', 'allowance', 'meal', 'transport'];
        if (!in_array($type, $allowed, true)) {
            throw new \InvalidArgumentException('Invalid adj_type');
        }
        $id = Database::uuid();
        Database::connection()->prepare(
            'INSERT INTO payroll_adjustments (id, employee_id, payroll_run_id, adj_type, amount, description, approved_by)
             VALUES (:id, :eid, :rid, :type, :amt, :desc, :by)'
        )->execute([
            'id' => $id,
            'eid' => $data['employee_id'],
            'rid' => $data['payroll_run_id'] ?? null,
            'type' => $type,
            'amt' => $amount,
            'desc' => $data['description'] ?? null,
            'by' => $userId,
        ]);
        $stmt = Database::connection()->prepare('SELECT * FROM payroll_adjustments WHERE id = :id');
        $stmt->execute(['id' => $id]);
        return $stmt->fetch() ?: [];
    }

    public function delete(string $id): bool
    {
        $stmt = Database::connection()->prepare('DELETE FROM payroll_adjustments WHERE id = :id');
        $stmt->execute(['id' => $id]);
        return $stmt->rowCount() > 0;
    }

    /** Sum adjustments for employee in a payroll run (recurring + run-specific). */
    public function totalsForEmployee(string $employeeId, string $runId): array
    {
        $pdo = Database::connection();
        $recurring = $pdo->prepare(
            "SELECT adj_type, SUM(amount) AS total FROM payroll_adjustments
             WHERE employee_id = :eid AND payroll_run_id IS NULL
             GROUP BY adj_type"
        );
        $recurring->execute(['eid' => $employeeId]);
        $runSpecific = $pdo->prepare(
            'SELECT adj_type, SUM(amount) AS total FROM payroll_adjustments
             WHERE employee_id = :eid AND payroll_run_id = :rid
             GROUP BY adj_type'
        );
        $runSpecific->execute(['eid' => $employeeId, 'rid' => $runId]);

        $credits = 0.0;
        $debits = 0.0;
        $creditTypes = ['bonus', 'allowance', 'meal', 'transport'];
        $debitTypes = ['advance', 'loan_repay', 'penalty'];

        foreach (array_merge($recurring->fetchAll(), $runSpecific->fetchAll()) as $row) {
            $amt = (float) $row['total'];
            if (in_array($row['adj_type'], $creditTypes, true)) {
                $credits += $amt;
            } elseif (in_array($row['adj_type'], $debitTypes, true)) {
                $debits += $amt;
            }
        }

        return [
            'credits' => round($credits, 2),
            'debits' => round($debits, 2),
            'net' => round($credits - $debits, 2),
        ];
    }
}
