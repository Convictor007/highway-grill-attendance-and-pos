<?php

declare(strict_types=1);

namespace Hg\Api\Modules\Contracts;

use Hg\Api\Core\Database;

final class ContractService
{
    public function contractsForEmployee(string $employeeId): array
    {
        $stmt = Database::connection()->prepare(
            'SELECT ec.*, d.title AS document_title
             FROM employee_contracts ec
             LEFT JOIN documents d ON d.id = ec.document_id
             WHERE ec.employee_id = :eid ORDER BY ec.start_date DESC'
        );
        $stmt->execute(['eid' => $employeeId]);
        return $stmt->fetchAll();
    }

    public function createContract(array $data): array
    {
        $id = Database::uuid();
        Database::connection()->prepare(
            'INSERT INTO employee_contracts (id, employee_id, contract_type, start_date, end_date, hourly_rate, weekly_hours, document_id)
             VALUES (:id, :eid, :type, :start, :end, :rate, :hrs, :doc)'
        )->execute([
            'id' => $id,
            'eid' => $data['employee_id'],
            'type' => $data['contract_type'] ?? 'permanent',
            'start' => $data['start_date'],
            'end' => $data['end_date'] ?? null,
            'rate' => $data['hourly_rate'] ?? null,
            'hrs' => $data['weekly_hours'] ?? null,
            'doc' => $data['document_id'] ?? null,
        ]);
        $stmt = Database::connection()->prepare('SELECT * FROM employee_contracts WHERE id = :id');
        $stmt->execute(['id' => $id]);
        return $stmt->fetch() ?: [];
    }

    public function deleteContract(string $id): bool
    {
        $stmt = Database::connection()->prepare('DELETE FROM employee_contracts WHERE id = :id');
        $stmt->execute(['id' => $id]);
        return $stmt->rowCount() > 0;
    }

    public function bankAccountsForEmployee(string $employeeId): array
    {
        $stmt = Database::connection()->prepare(
            'SELECT * FROM employee_bank_accounts WHERE employee_id = :eid ORDER BY is_primary DESC'
        );
        $stmt->execute(['eid' => $employeeId]);
        return $stmt->fetchAll();
    }

    public function createBankAccount(array $data): array
    {
        $id = Database::uuid();
        Database::connection()->prepare(
            'INSERT INTO employee_bank_accounts (id, employee_id, bank_name, account_name, account_no, routing_no, is_primary)
             VALUES (:id, :eid, :bank, :name, :no, :route, :pri)'
        )->execute([
            'id' => $id,
            'eid' => $data['employee_id'],
            'bank' => $data['bank_name'],
            'name' => $data['account_name'],
            'no' => $data['account_no'],
            'route' => $data['routing_no'] ?? null,
            'pri' => !empty($data['is_primary']) ? 1 : 0,
        ]);
        $stmt = Database::connection()->prepare('SELECT * FROM employee_bank_accounts WHERE id = :id');
        $stmt->execute(['id' => $id]);
        return $stmt->fetch() ?: [];
    }

    public function serviceRecord(string $employeeId): array
    {
        $pdo = Database::connection();
        $emp = $pdo->prepare(
            'SELECT e.*, b.name AS branch_name, d.name AS department_name, p.title AS position_title
             FROM employees e
             LEFT JOIN branches b ON b.id = e.branch_id
             LEFT JOIN departments d ON d.id = e.department_id
             LEFT JOIN positions p ON p.id = e.position_id
             WHERE e.id = :id LIMIT 1'
        );
        $emp->execute(['id' => $employeeId]);
        $employee = $emp->fetch();
        if (!$employee) {
            throw new \RuntimeException('Employee not found');
        }
        return [
            'employee' => $employee,
            'contracts' => $this->contractsForEmployee($employeeId),
            'bank_accounts' => $this->bankAccountsForEmployee($employeeId),
        ];
    }
}
