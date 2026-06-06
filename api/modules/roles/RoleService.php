<?php

declare(strict_types=1);

namespace Hg\Api\Modules\Roles;

use Hg\Api\Core\Database;
use PDO;

final class RoleService
{
    public function listRoles(?string $roleType = null): array
    {
        $sql = 'SELECT role_id, role_slug, role_name, description, role_type, is_system, display_order
                FROM roles';
        $params = [];

        if ($roleType !== null && in_array($roleType, ['staff', 'customer', 'system'], true)) {
            $sql .= ' WHERE role_type = :role_type';
            $params['role_type'] = $roleType;
        }

        $sql .= ' ORDER BY display_order ASC, role_name ASC';

        $stmt = Database::connection()->prepare($sql);
        $stmt->execute($params);

        return $stmt->fetchAll();
    }

    public function getRoleBySlug(string $slug): ?array
    {
        $stmt = Database::connection()->prepare(
            'SELECT role_id, role_slug, role_name, description, role_type, is_system, display_order
             FROM roles WHERE role_slug = :slug LIMIT 1'
        );
        $stmt->execute(['slug' => $slug]);
        $row = $stmt->fetch();

        return $row ?: null;
    }

    public function getPermissionsForRole(int $roleId): array
    {
        $stmt = Database::connection()->prepare(
            'SELECT p.permission_id, p.permission_key, p.permission_name, p.module, p.description
             FROM permissions p
             INNER JOIN role_permissions rp ON rp.permission_id = p.permission_id
             WHERE rp.role_id = :role_id
             ORDER BY p.module, p.permission_key'
        );
        $stmt->execute(['role_id' => $roleId]);

        return $stmt->fetchAll();
    }

    public function getEffectivePermissionsForUser(int $userId): array
    {
        $pdo = Database::connection();

        $roleStmt = $pdo->prepare(
            'SELECT u.role_id FROM user_login u WHERE u.user_id = :user_id AND u.status = TRUE LIMIT 1'
        );
        $roleStmt->execute(['user_id' => $userId]);
        $user = $roleStmt->fetch();

        if (!$user) {
            return [];
        }

        $base = $this->getPermissionsForRole((int) $user['role_id']);
        $keys = array_column($base, 'permission_key');

        $overrideStmt = $pdo->prepare(
            'SELECT p.permission_key, up.grant_type
             FROM user_permissions up
             INNER JOIN permissions p ON p.permission_id = up.permission_id
             WHERE up.user_id = :user_id'
        );
        $overrideStmt->execute(['user_id' => $userId]);

        foreach ($overrideStmt->fetchAll() as $row) {
            $key = $row['permission_key'];
            if ($row['grant_type'] === 'deny') {
                $keys = array_values(array_filter($keys, fn ($k) => $k !== $key));
            } elseif (!in_array($key, $keys, true)) {
                $keys[] = $key;
            }
        }

        return array_values(array_unique($keys));
    }

    public function listAllPermissions(): array
    {
        return Database::connection()->query(
            'SELECT permission_id, permission_key, permission_name, module, description
             FROM permissions ORDER BY module, permission_key'
        )->fetchAll();
    }

    public function setPermissionsForRole(int $roleId, array $permissionIds): void
    {
        $pdo = Database::connection();
        $pdo->prepare('DELETE FROM role_permissions WHERE role_id = :rid')->execute(['rid' => $roleId]);
        $stmt = $pdo->prepare(
            'INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES (:rid, :pid)'
        );
        foreach ($permissionIds as $pid) {
            $id = (int) $pid;
            if ($id > 0) {
                $stmt->execute(['rid' => $roleId, 'pid' => $id]);
            }
        }
    }
}
