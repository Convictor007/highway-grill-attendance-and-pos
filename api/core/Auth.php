<?php

declare(strict_types=1);

namespace Hg\Api\Core;

use PDO;

final class Auth
{
    private static ?array $user = null;

    public static function login(string $email, string $password): ?array
    {
        $pdo = Database::connection();
        $stmt = $pdo->prepare(
            'SELECT u.id, u.email, u.password_hash, u.role_id, u.employee_id, u.is_active, u.account_status,
                    r.role_slug, r.role_name, r.role_type
             FROM users u
             INNER JOIN roles r ON r.role_id = u.role_id
             WHERE u.email = :email LIMIT 1'
        );
        $stmt->execute(['email' => $email]);
        $row = $stmt->fetch();
        if (!$row || !self::verifyPassword($password, $row['password_hash'])) {
            return null;
        }

        $accountStatus = (string) ($row['account_status'] ?? 'active');
        if ($accountStatus === 'awaiting_hr') {
            throw new \RuntimeException('Your registration is pending HR review. You will receive an email when you can sign in.');
        }
        if ($accountStatus === 'rejected') {
            throw new \RuntimeException('Your registration was not approved. Contact HR if you have questions.');
        }
        if (!(bool) $row['is_active'] || !in_array($accountStatus, ['pending', 'active'], true)) {
            return null;
        }

        $token = bin2hex(random_bytes(32));
        $hash = hash('sha256', $token);
        $config = require dirname(__DIR__) . '/config/config.php';
        $hours = (int) ($config['session_ttl_hours'] ?? 24);
        $expires = date('Y-m-d H:i:s', time() + $hours * 3600);

        $pdo->prepare(
            'INSERT INTO user_sessions (id, user_id, token_hash, expires_at) VALUES (UUID(), :uid, :hash, :exp)'
        )->execute(['uid' => $row['id'], 'hash' => $hash, 'exp' => $expires]);

        $pdo->prepare('UPDATE users SET last_login_at = NOW() WHERE id = :id')->execute(['id' => $row['id']]);

        unset($row['password_hash']);
        $permissions = self::permissionsForRole((int) $row['role_id'], $row['id']);

        return [
            'token' => $token,
            'expires_at' => $expires,
            'user' => $row,
            'permissions' => $permissions,
        ];
    }

    public static function userFromToken(?string $token): ?array
    {
        if ($token === null || $token === '') {
            return null;
        }
        $hash = hash('sha256', $token);
        $pdo = Database::connection();
        $stmt = $pdo->prepare(
            'SELECT u.id, u.email, u.role_id, u.employee_id, u.is_active, u.account_status,
                    r.role_slug, r.role_name, r.role_type, s.expires_at
             FROM user_sessions s
             INNER JOIN users u ON u.id = s.user_id
             INNER JOIN roles r ON r.role_id = u.role_id
             WHERE s.token_hash = :hash AND s.expires_at > NOW() AND u.is_active = 1
               AND u.account_status IN (\'pending\', \'active\')
             LIMIT 1'
        );
        $stmt->execute(['hash' => $hash]);
        $row = $stmt->fetch();
        if (!$row) {
            return null;
        }
        $row['permissions'] = self::permissionsForRole((int) $row['role_id'], $row['id']);
        return $row;
    }

    public static function requireUser(): array
    {
        $user = self::userFromToken(Request::bearerToken());
        if ($user === null) {
            Response::error('Unauthorized', 401);
            exit;
        }
        self::$user = $user;
        return $user;
    }

    public static function current(): ?array
    {
        return self::$user;
    }

    public static function hasPermission(array $user, string $key): bool
    {
        return in_array($key, $user['permissions'] ?? [], true);
    }

    public static function requirePermission(array $user, string $key): void
    {
        if (!self::hasPermission($user, $key)) {
            Response::error('Forbidden', 403);
            exit;
        }
    }

    /** Employee self-service (clock in, schedules, loans) requires HR activation. */
    public static function requireActiveEmployeeAccount(array $user): void
    {
        if (($user['role_slug'] ?? '') !== 'employee') {
            return;
        }
        if (($user['account_status'] ?? 'active') !== 'active') {
            Response::error(
                'Your account must be activated by HR before using time clock, schedules, and payroll features.',
                403
            );
            exit;
        }
        if (empty($user['employee_id'])) {
            Response::error('No employee record linked to your account.', 422);
            exit;
        }
    }

    public static function logout(?string $token): void
    {
        if ($token === null) {
            return;
        }
        $hash = hash('sha256', $token);
        Database::connection()->prepare('DELETE FROM user_sessions WHERE token_hash = :hash')
            ->execute(['hash' => $hash]);
    }

    public static function hashPassword(string $plain): string
    {
        $config = require dirname(__DIR__) . '/config/config.php';
        if ((bool) ($config['auth_hash_passwords'] ?? false)) {
            return password_hash($plain, PASSWORD_BCRYPT);
        }
        return $plain;
    }

    /** Dev: plain text in password_hash when AUTH_HASH_PASSWORDS=false */
    private static function verifyPassword(string $plain, string $stored): bool
    {
        $config = require dirname(__DIR__) . '/config/config.php';
        $hashPasswords = (bool) ($config['auth_hash_passwords'] ?? false);

        if ($hashPasswords) {
            return password_verify($plain, $stored);
        }

        return hash_equals($stored, $plain);
    }

    private static function permissionsForRole(int $roleId, string $userId): array
    {
        $pdo = Database::connection();
        $stmt = $pdo->prepare(
            'SELECT p.permission_key FROM permissions p
             INNER JOIN role_permissions rp ON rp.permission_id = p.permission_id
             WHERE rp.role_id = :rid'
        );
        $stmt->execute(['rid' => $roleId]);
        $keys = array_column($stmt->fetchAll(), 'permission_key');

        $ov = $pdo->prepare(
            'SELECT p.permission_key, up.grant_type FROM user_permissions up
             INNER JOIN permissions p ON p.permission_id = up.permission_id
             WHERE up.user_id = :uid'
        );
        $ov->execute(['uid' => $userId]);
        foreach ($ov->fetchAll() as $row) {
            if ($row['grant_type'] === 'deny') {
                $keys = array_values(array_filter($keys, fn ($k) => $k !== $row['permission_key']));
            } elseif (!in_array($row['permission_key'], $keys, true)) {
                $keys[] = $row['permission_key'];
            }
        }
        return array_values(array_unique($keys));
    }
}
