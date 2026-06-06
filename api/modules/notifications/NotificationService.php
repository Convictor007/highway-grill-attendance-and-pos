<?php

declare(strict_types=1);

namespace Hg\Api\Modules\Notifications;

use Hg\Api\Core\Database;

final class NotificationService
{
    public function listForUser(string $userId, ?bool $unreadOnly = null, int $limit = 50): array
    {
        $sql = 'SELECT * FROM notifications WHERE user_id = :uid';
        $params = ['uid' => $userId];
        if ($unreadOnly === true) {
            $sql .= ' AND is_read = 0';
        }
        $sql .= ' ORDER BY created_at DESC LIMIT ' . max(1, min($limit, 100));
        $stmt = Database::connection()->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll();
    }

    public function unreadCount(string $userId): int
    {
        $stmt = Database::connection()->prepare(
            'SELECT COUNT(*) FROM notifications WHERE user_id = :uid AND is_read = 0'
        );
        $stmt->execute(['uid' => $userId]);
        return (int) $stmt->fetchColumn();
    }

    public function create(
        string $userId,
        string $type,
        string $title,
        ?string $body = null,
        ?string $relatedId = null,
        ?string $link = null
    ): array {
        $id = Database::uuid();
        Database::connection()->prepare(
            'INSERT INTO notifications (id, user_id, type, title, body, link, related_id)
             VALUES (:id, :uid, :type, :title, :body, :link, :rid)'
        )->execute([
            'id' => $id,
            'uid' => $userId,
            'type' => $type,
            'title' => $title,
            'body' => $body,
            'link' => $link,
            'rid' => $relatedId,
        ]);
        $stmt = Database::connection()->prepare('SELECT * FROM notifications WHERE id = :id');
        $stmt->execute(['id' => $id]);
        return $stmt->fetch() ?: [];
    }

    public function markRead(string $id, string $userId): bool
    {
        $stmt = Database::connection()->prepare(
            'UPDATE notifications SET is_read = 1 WHERE id = :id AND user_id = :uid'
        );
        $stmt->execute(['id' => $id, 'uid' => $userId]);
        return $stmt->rowCount() > 0;
    }

    public function markAllRead(string $userId): void
    {
        Database::connection()->prepare(
            'UPDATE notifications SET is_read = 1 WHERE user_id = :uid AND is_read = 0'
        )->execute(['uid' => $userId]);
    }

    public function notifyUserIds(array $userIds, string $type, string $title, ?string $body, ?string $relatedId, ?string $link): void
    {
        foreach (array_unique($userIds) as $uid) {
            if ($uid !== '') {
                $this->create((string) $uid, $type, $title, $body, $relatedId, $link);
            }
        }
    }

    /** Users with shifts.manage (HR schedule admins). */
    public function hrSchedulerUserIds(): array
    {
        $stmt = Database::connection()->query(
            'SELECT DISTINCT u.id
             FROM users u
             INNER JOIN role_permissions rp ON rp.role_id = u.role_id
             INNER JOIN permissions p ON p.permission_id = rp.permission_id
             WHERE p.permission_key = \'shifts.manage\' AND u.is_active = 1'
        );
        return array_column($stmt->fetchAll(), 'id');
    }

    public function userIdForEmployee(string $employeeId): ?string
    {
        $stmt = Database::connection()->prepare(
            'SELECT id FROM users WHERE employee_id = :eid AND is_active = 1 LIMIT 1'
        );
        $stmt->execute(['eid' => $employeeId]);
        $row = $stmt->fetch();
        return $row ? (string) $row['id'] : null;
    }

    public function existsForRelated(string $userId, string $type, string $relatedId): bool
    {
        $stmt = Database::connection()->prepare(
            'SELECT id FROM notifications WHERE user_id = :uid AND type = :type AND related_id = :rid LIMIT 1'
        );
        $stmt->execute(['uid' => $userId, 'type' => $type, 'rid' => $relatedId]);
        return (bool) $stmt->fetch();
    }
}
