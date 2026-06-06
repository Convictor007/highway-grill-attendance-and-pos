<?php

declare(strict_types=1);

namespace Hg\Api\Modules\Users;

use Hg\Api\Core\Auth;
use Hg\Api\Core\Database;

final class UserService
{
    public function list(): array
    {
        $stmt = Database::connection()->query(
            'SELECT u.id, u.email, u.is_active, u.employee_id, u.role_id, u.last_login_at,
                    r.role_slug, r.role_name,
                    e.emp_number, e.first_name, e.last_name
             FROM users u
             INNER JOIN roles r ON r.role_id = u.role_id
             LEFT JOIN employees e ON e.id = u.employee_id
             ORDER BY u.email'
        );
        return $stmt->fetchAll();
    }

    public function create(array $data): array
    {
        $pdo = Database::connection();
        $email = trim((string) ($data['email'] ?? ''));
        $password = (string) ($data['password'] ?? '');
        $roleId = (int) ($data['role_id'] ?? 0);
        if ($email === '' || $password === '' || $roleId < 1) {
            throw new \InvalidArgumentException('email, password, and role_id required');
        }

        $exists = $pdo->prepare('SELECT id FROM users WHERE email = :email LIMIT 1');
        $exists->execute(['email' => $email]);
        if ($exists->fetch()) {
            throw new \RuntimeException('Email already registered');
        }

        $id = Database::uuid();
        $pdo->prepare(
            'INSERT INTO users (id, email, password_hash, role_id, employee_id, is_active)
             VALUES (:id, :email, :pass, :rid, :eid, 1)'
        )->execute([
            'id' => $id,
            'email' => $email,
            'pass' => Auth::hashPassword($password),
            'rid' => $roleId,
            'eid' => $data['employee_id'] ?? null,
        ]);

        return $this->get($id);
    }

    public function get(string $id): array
    {
        $stmt = Database::connection()->prepare(
            'SELECT u.id, u.email, u.is_active, u.employee_id, u.role_id,
                    r.role_slug, r.role_name,
                    e.emp_number, e.first_name, e.last_name
             FROM users u
             INNER JOIN roles r ON r.role_id = u.role_id
             LEFT JOIN employees e ON e.id = u.employee_id
             WHERE u.id = :id LIMIT 1'
        );
        $stmt->execute(['id' => $id]);
        $row = $stmt->fetch();
        if (!$row) {
            throw new \RuntimeException('User not found');
        }
        return $row;
    }

    public function update(string $id, array $data): array
    {
        $pdo = Database::connection();
        if (!empty($data['password'])) {
            $pdo->prepare('UPDATE users SET password_hash = :p WHERE id = :id')
                ->execute(['p' => Auth::hashPassword((string) $data['password']), 'id' => $id]);
        }
        if (isset($data['role_id'])) {
            $pdo->prepare('UPDATE users SET role_id = :r WHERE id = :id')
                ->execute(['r' => (int) $data['role_id'], 'id' => $id]);
        }
        if (array_key_exists('employee_id', $data)) {
            $eid = $data['employee_id'];
            $eid = ($eid === '' || $eid === null) ? null : (string) $eid;
            $pdo->prepare('UPDATE users SET employee_id = :e WHERE id = :id')
                ->execute(['e' => $eid, 'id' => $id]);
        }
        if (isset($data['is_active'])) {
            $pdo->prepare('UPDATE users SET is_active = :a WHERE id = :id')
                ->execute(['a' => $data['is_active'] ? 1 : 0, 'id' => $id]);
        }
        return $this->get($id);
    }
}
