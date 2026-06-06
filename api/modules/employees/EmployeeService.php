<?php

declare(strict_types=1);

namespace Hg\Api\Modules\Employees;

use Hg\Api\Core\Database;
use Hg\Api\Modules\Leave\LeaveService;

final class EmployeeService
{
    public function list(?string $branchId = null, ?string $status = null): array
    {
        $sql = 'SELECT e.*, b.name AS branch_name, d.name AS department_name, p.title AS position_title
                FROM employees e
                LEFT JOIN branches b ON b.id = e.branch_id
                LEFT JOIN departments d ON d.id = e.department_id
                LEFT JOIN positions p ON p.id = e.position_id
                WHERE 1=1';
        $params = [];
        if ($branchId) {
            $sql .= ' AND e.branch_id = :branch';
            $params['branch'] = $branchId;
        }
        if ($status) {
            $sql .= ' AND e.status = :status';
            $params['status'] = $status;
        }
        $sql .= ' ORDER BY e.last_name, e.first_name';
        $stmt = Database::connection()->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll();
    }

    public function get(string $id): ?array
    {
        $stmt = Database::connection()->prepare(
            'SELECT e.*, b.name AS branch_name, d.name AS department_name, p.title AS position_title
             FROM employees e
             LEFT JOIN branches b ON b.id = e.branch_id
             LEFT JOIN departments d ON d.id = e.department_id
             LEFT JOIN positions p ON p.id = e.position_id
             WHERE e.id = :id LIMIT 1'
        );
        $stmt->execute(['id' => $id]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public function create(array $data): array
    {
        $id = Database::uuid();
        $pdo = Database::connection();
        $pdo->prepare(
            'INSERT INTO employees (id, branch_id, department_id, position_id, emp_number, first_name, last_name,
             email, phone, hire_date, employment_type, status, date_of_birth, address)
             VALUES (:id, :branch_id, :department_id, :position_id, :emp_number, :first_name, :last_name,
             :email, :phone, :hire_date, :employment_type, :status, :dob, :address)'
        )->execute([
            'id' => $id,
            'branch_id' => $data['branch_id'],
            'department_id' => $data['department_id'] ?? null,
            'position_id' => $data['position_id'] ?? null,
            'emp_number' => $data['emp_number'],
            'first_name' => $data['first_name'],
            'last_name' => $data['last_name'],
            'email' => $data['email'] ?? null,
            'phone' => $data['phone'] ?? null,
            'hire_date' => $data['hire_date'] ?? date('Y-m-d'),
            'employment_type' => $data['employment_type'] ?? 'full_time',
            'status' => $data['status'] ?? 'active',
            'dob' => $data['date_of_birth'] ?? null,
            'address' => $data['address'] ?? null,
        ]);
        (new LeaveService())->ensureBalancesForEmployee($id, (int) date('Y'));
        return $this->get($id) ?? [];
    }

    public function update(string $id, array $data): ?array
    {
        $fields = ['first_name', 'last_name', 'email', 'phone', 'branch_id', 'department_id', 'position_id',
            'employment_type', 'status', 'address'];
        $sets = [];
        $params = ['id' => $id];
        foreach ($fields as $f) {
            if (array_key_exists($f, $data)) {
                $sets[] = "$f = :$f";
                $params[$f] = $data[$f];
            }
        }
        if ($sets === []) {
            return $this->get($id);
        }
        Database::connection()->prepare('UPDATE employees SET ' . implode(', ', $sets) . ' WHERE id = :id')
            ->execute($params);
        return $this->get($id);
    }

    public function updateSelf(string $id, array $data): ?array
    {
        $allowed = ['phone', 'email', 'address', 'emergency_name', 'emergency_phone'];
        $sets = [];
        $params = ['id' => $id];
        foreach ($allowed as $f) {
            if (array_key_exists($f, $data)) {
                $sets[] = "$f = :$f";
                $params[$f] = $data[$f];
            }
        }
        if ($sets === []) {
            return $this->get($id);
        }
        Database::connection()->prepare('UPDATE employees SET ' . implode(', ', $sets) . ' WHERE id = :id')
            ->execute($params);
        return $this->get($id);
    }

    public function delete(string $id): bool
    {
        $stmt = Database::connection()->prepare(
            'UPDATE employees SET status = :status WHERE id = :id'
        );
        $stmt->execute(['id' => $id, 'status' => 'terminated']);
        return $stmt->rowCount() > 0;
    }
}
