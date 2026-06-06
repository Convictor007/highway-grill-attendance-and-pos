<?php

declare(strict_types=1);

namespace Hg\Api\Modules\Settings;

use Hg\Api\Core\Database;
use Hg\Api\Core\Schema;

final class SettingsService
{
    public function listBranches(): array
    {
        return Database::connection()->query(
            'SELECT ' . $this->branchSelectColumns() . ' FROM branches ORDER BY name'
        )->fetchAll();
    }

    public function getBranch(string $id): ?array
    {
        $stmt = Database::connection()->prepare(
            'SELECT ' . $this->branchSelectColumns() . ' FROM branches WHERE id = :id LIMIT 1'
        );
        $stmt->execute(['id' => $id]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public function createBranch(array $data): array
    {
        $id = Database::uuid();
        Database::connection()->prepare(
            'INSERT INTO branches (id, name, address, phone, timezone, is_active, manager_id)
             VALUES (:id, :name, :addr, :phone, :tz, :active, :mgr)'
        )->execute([
            'id' => $id,
            'name' => $data['name'],
            'addr' => $data['address'] ?? null,
            'phone' => $data['phone'] ?? null,
            'tz' => $data['timezone'] ?? 'Asia/Manila',
            'active' => isset($data['is_active']) ? ($data['is_active'] ? 1 : 0) : 1,
            'mgr' => $data['manager_id'] ?? null,
        ]);
        return $this->getBranch($id) ?? [];
    }

    public function updateBranch(string $id, array $data): ?array
    {
        $fields = ['name', 'address', 'phone', 'timezone', 'manager_id'];
        if (Schema::hasColumn('branches', 'default_latitude')) {
            $fields[] = 'default_latitude';
            $fields[] = 'default_longitude';
        }
        $sets = [];
        $params = ['id' => $id];
        foreach ($fields as $f) {
            if (array_key_exists($f, $data)) {
                $sets[] = "$f = :$f";
                $params[$f] = $data[$f];
            }
        }
        if (array_key_exists('is_active', $data)) {
            $sets[] = 'is_active = :is_active';
            $params['is_active'] = $data['is_active'] ? 1 : 0;
        }
        if ($sets === []) {
            return $this->getBranch($id);
        }
        Database::connection()->prepare('UPDATE branches SET ' . implode(', ', $sets) . ' WHERE id = :id')
            ->execute($params);
        return $this->getBranch($id);
    }

    public function listDepartments(?string $branchId = null): array
    {
        $sql = 'SELECT d.id, d.branch_id, d.name, d.cost_center, d.head_id, b.name AS branch_name
                FROM departments d
                INNER JOIN branches b ON b.id = d.branch_id WHERE 1=1';
        $params = [];
        if ($branchId) {
            $sql .= ' AND d.branch_id = :b';
            $params['b'] = $branchId;
        }
        $sql .= ' ORDER BY b.name, d.name';
        $stmt = Database::connection()->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll();
    }

    public function createDepartment(array $data): array
    {
        $id = Database::uuid();
        Database::connection()->prepare(
            'INSERT INTO departments (id, branch_id, name, cost_center, head_id)
             VALUES (:id, :bid, :name, :cc, :head)'
        )->execute([
            'id' => $id,
            'bid' => $data['branch_id'],
            'name' => $data['name'],
            'cc' => $data['cost_center'] ?? null,
            'head' => $data['head_id'] ?? null,
        ]);
        $stmt = Database::connection()->prepare(
            'SELECT d.*, b.name AS branch_name FROM departments d
             INNER JOIN branches b ON b.id = d.branch_id WHERE d.id = :id'
        );
        $stmt->execute(['id' => $id]);
        return $stmt->fetch();
    }

    public function updateDepartment(string $id, array $data): ?array
    {
        $fields = ['name', 'cost_center', 'head_id', 'branch_id'];
        $sets = [];
        $params = ['id' => $id];
        foreach ($fields as $f) {
            if (array_key_exists($f, $data)) {
                $sets[] = "$f = :$f";
                $params[$f] = $data[$f];
            }
        }
        if ($sets === []) {
            return null;
        }
        Database::connection()->prepare('UPDATE departments SET ' . implode(', ', $sets) . ' WHERE id = :id')
            ->execute($params);
        $stmt = Database::connection()->prepare(
            'SELECT d.*, b.name AS branch_name FROM departments d
             INNER JOIN branches b ON b.id = d.branch_id WHERE d.id = :id'
        );
        $stmt->execute(['id' => $id]);
        return $stmt->fetch() ?: null;
    }

    public function listPositions(?string $departmentId = null, ?string $branchId = null): array
    {
        $sql = 'SELECT p.id, p.department_id, p.title, p.pay_grade, p.min_hourly, p.max_hourly, p.is_tipped,
                       d.name AS department_name, d.branch_id, b.name AS branch_name
                FROM positions p
                INNER JOIN departments d ON d.id = p.department_id
                INNER JOIN branches b ON b.id = d.branch_id WHERE 1=1';
        $params = [];
        if ($departmentId) {
            $sql .= ' AND p.department_id = :did';
            $params['did'] = $departmentId;
        }
        if ($branchId) {
            $sql .= ' AND d.branch_id = :bid';
            $params['bid'] = $branchId;
        }
        $sql .= ' ORDER BY b.name, d.name, p.title';
        $stmt = Database::connection()->prepare($sql);
        $stmt->execute($params);

        return $stmt->fetchAll();
    }

    public function createPosition(array $data): array
    {
        $id = Database::uuid();
        Database::connection()->prepare(
            'INSERT INTO positions (id, department_id, title, pay_grade, min_hourly, max_hourly, is_tipped)
             VALUES (:id, :did, :title, :pg, :minh, :maxh, :tip)'
        )->execute([
            'id' => $id,
            'did' => $data['department_id'],
            'title' => $data['title'],
            'pg' => $data['pay_grade'] ?? null,
            'minh' => $data['min_hourly'] ?? null,
            'maxh' => $data['max_hourly'] ?? null,
            'tip' => !empty($data['is_tipped']) ? 1 : 0,
        ]);
        return $this->getPosition($id) ?? [];
    }

    public function getPosition(string $id): ?array
    {
        $stmt = Database::connection()->prepare(
            'SELECT p.id, p.department_id, p.title, p.pay_grade, p.min_hourly, p.max_hourly, p.is_tipped,
                    d.name AS department_name, d.branch_id, b.name AS branch_name
             FROM positions p
             INNER JOIN departments d ON d.id = p.department_id
             INNER JOIN branches b ON b.id = d.branch_id
             WHERE p.id = :id LIMIT 1'
        );
        $stmt->execute(['id' => $id]);

        return $stmt->fetch() ?: null;
    }

    public function updatePosition(string $id, array $data): ?array
    {
        $map = [
            'department_id' => 'department_id',
            'title' => 'title',
            'pay_grade' => 'pay_grade',
            'min_hourly' => 'min_hourly',
            'max_hourly' => 'max_hourly',
        ];
        $sets = [];
        $params = ['id' => $id];
        foreach ($map as $key => $col) {
            if (array_key_exists($key, $data)) {
                $sets[] = "$col = :$key";
                $params[$key] = $data[$key];
            }
        }
        if (array_key_exists('is_tipped', $data)) {
            $sets[] = 'is_tipped = :is_tipped';
            $params['is_tipped'] = $data['is_tipped'] ? 1 : 0;
        }
        if ($sets === []) {
            return $this->getPosition($id);
        }
        Database::connection()->prepare('UPDATE positions SET ' . implode(', ', $sets) . ' WHERE id = :id')
            ->execute($params);

        return $this->getPosition($id);
    }

    private function branchSelectColumns(): string
    {
        $cols = 'id, name, address, phone, timezone, is_active, manager_id, created_at';
        if (Schema::hasColumn('branches', 'default_latitude')) {
            $cols .= ', default_latitude, default_longitude';
        }

        return $cols;
    }
}
