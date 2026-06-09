<?php

declare(strict_types=1);

namespace Hg\Api\Modules\Benefits;

use Hg\Api\Core\Database;
use Hg\Api\Core\Schema;

final class BenefitService
{
    public function list(?string $employeeId = null): array
    {
        if (!Schema::hasTable('employee_benefit_enrollments')) {
            return [];
        }
        $sql = 'SELECT be.*, e.emp_number, e.first_name, e.last_name
                FROM employee_benefit_enrollments be
                INNER JOIN employees e ON e.id = be.employee_id WHERE 1=1';
        $params = [];
        if ($employeeId) {
            $sql .= ' AND be.employee_id = :eid';
            $params['eid'] = $employeeId;
        }
        $sql .= ' ORDER BY e.last_name, be.benefit_name';
        $stmt = Database::connection()->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll();
    }

    public function create(array $data): array
    {
        if (!Schema::hasTable('employee_benefit_enrollments')) {
            throw new \RuntimeException('Run database patch: patch_juanhr_modules.sql');
        }
        $id = Database::uuid();
        Database::connection()->prepare(
            'INSERT INTO employee_benefit_enrollments (id, employee_id, benefit_code, benefit_name, amount, frequency, is_active, notes)
             VALUES (:id, :eid, :code, :name, :amt, :freq, :active, :notes)'
        )->execute([
            'id' => $id,
            'eid' => $data['employee_id'],
            'code' => $data['benefit_code'] ?? 'allowance',
            'name' => $data['benefit_name'],
            'amt' => $data['amount'] ?? 0,
            'freq' => $data['frequency'] ?? 'monthly',
            'active' => !isset($data['is_active']) || $data['is_active'] ? 1 : 0,
            'notes' => $data['notes'] ?? null,
        ]);
        $stmt = Database::connection()->prepare('SELECT * FROM employee_benefit_enrollments WHERE id = :id');
        $stmt->execute(['id' => $id]);
        return $stmt->fetch() ?: [];
    }

    public function update(string $id, array $data): ?array
    {
        if (!Schema::hasTable('employee_benefit_enrollments')) {
            return null;
        }
        $sets = [];
        $params = ['id' => $id];
        foreach (['benefit_name', 'amount', 'frequency', 'notes'] as $f) {
            if (array_key_exists($f, $data)) {
                $sets[] = "{$f} = :{$f}";
                $params[$f] = $data[$f];
            }
        }
        if (array_key_exists('is_active', $data)) {
            $sets[] = 'is_active = :is_active';
            $params['is_active'] = $data['is_active'] ? 1 : 0;
        }
        if ($sets === []) {
            return null;
        }
        Database::connection()->prepare(
            'UPDATE employee_benefit_enrollments SET ' . implode(', ', $sets) . ' WHERE id = :id'
        )->execute($params);
        $stmt = Database::connection()->prepare('SELECT * FROM employee_benefit_enrollments WHERE id = :id');
        $stmt->execute(['id' => $id]);
        return $stmt->fetch() ?: null;
    }

    public function monthlyTotalForEmployee(string $employeeId): float
    {
        return $this->periodTotalForEmployee($employeeId, 'monthly');
    }

    public function periodTotalForEmployee(string $employeeId, string $payFrequency = 'semi_monthly'): float
    {
        if (!Schema::hasTable('employee_benefit_enrollments')) {
            return 0.0;
        }
        $stmt = Database::connection()->prepare(
            "SELECT amount, frequency FROM employee_benefit_enrollments
             WHERE employee_id = :eid AND is_active = 1"
        );
        $stmt->execute(['eid' => $employeeId]);
        $total = 0.0;
        foreach ($stmt->fetchAll() as $row) {
            $amt = (float) $row['amount'];
            if (($row['frequency'] ?? 'monthly') === 'per_payroll') {
                $total += $amt;
                continue;
            }
            $total += $payFrequency === 'monthly' ? $amt : $amt / 2;
        }

        return round($total, 2);
    }
}
