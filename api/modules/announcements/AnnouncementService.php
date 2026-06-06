<?php

declare(strict_types=1);

namespace Hg\Api\Modules\Announcements;

use Hg\Api\Core\Database;

final class AnnouncementService
{
    public function forBranch(?string $branchId): array
    {
        $sql = 'SELECT a.* FROM announcements a
                WHERE (a.branch_id IS NULL OR a.branch_id = :b)
                  AND (a.publish_at IS NULL OR a.publish_at <= NOW())
                  AND (a.expires_at IS NULL OR a.expires_at >= NOW())
                ORDER BY FIELD(a.priority, \'urgent\', \'normal\', \'low\'), a.publish_at DESC
                LIMIT 20';
        $stmt = Database::connection()->prepare($sql);
        $stmt->execute(['b' => $branchId]);
        return $stmt->fetchAll();
    }

    public function listAll(): array
    {
        return Database::connection()->query(
            'SELECT a.*, b.name AS branch_name
             FROM announcements a
             LEFT JOIN branches b ON b.id = a.branch_id
             ORDER BY COALESCE(a.publish_at, a.id) DESC
             LIMIT 100'
        )->fetchAll();
    }

    public function create(array $data, string $userId): array
    {
        $id = Database::uuid();
        $branchId = isset($data['branch_id']) && $data['branch_id'] !== ''
            ? (string) $data['branch_id']
            : null;
        $priority = (string) ($data['priority'] ?? 'normal');
        if (!in_array($priority, ['low', 'normal', 'urgent'], true)) {
            $priority = 'normal';
        }

        Database::connection()->prepare(
            'INSERT INTO announcements (id, branch_id, title, body, priority, posted_by, publish_at, expires_at)
             VALUES (:id, :bid, :title, :body, :priority, :by, :pub, :exp)'
        )->execute([
            'id' => $id,
            'bid' => $branchId,
            'title' => trim((string) $data['title']),
            'body' => trim((string) ($data['body'] ?? '')),
            'priority' => $priority,
            'by' => $userId,
            'pub' => $data['publish_at'] ?? date('Y-m-d H:i:s'),
            'exp' => $data['expires_at'] ?? null,
        ]);

        $stmt = Database::connection()->prepare(
            'SELECT a.*, b.name AS branch_name FROM announcements a
             LEFT JOIN branches b ON b.id = a.branch_id WHERE a.id = :id'
        );
        $stmt->execute(['id' => $id]);

        return $stmt->fetch();
    }

    public function get(string $id): ?array
    {
        $stmt = Database::connection()->prepare(
            'SELECT a.*, b.name AS branch_name FROM announcements a
             LEFT JOIN branches b ON b.id = a.branch_id WHERE a.id = :id LIMIT 1'
        );
        $stmt->execute(['id' => $id]);
        $row = $stmt->fetch();

        return $row ?: null;
    }

    public function update(string $id, array $data): ?array
    {
        $existing = $this->get($id);
        if (!$existing) {
            return null;
        }

        $branchId = array_key_exists('branch_id', $data)
            ? ($data['branch_id'] !== '' && $data['branch_id'] !== null ? (string) $data['branch_id'] : null)
            : $existing['branch_id'];
        $priority = (string) ($data['priority'] ?? $existing['priority']);
        if (!in_array($priority, ['low', 'normal', 'urgent'], true)) {
            $priority = (string) $existing['priority'];
        }

        Database::connection()->prepare(
            'UPDATE announcements
             SET branch_id = :bid, title = :title, body = :body, priority = :priority,
                 publish_at = :pub, expires_at = :exp
             WHERE id = :id'
        )->execute([
            'id' => $id,
            'bid' => $branchId,
            'title' => trim((string) ($data['title'] ?? $existing['title'])),
            'body' => trim((string) ($data['body'] ?? $existing['body'])),
            'priority' => $priority,
            'pub' => $data['publish_at'] ?? $existing['publish_at'],
            'exp' => array_key_exists('expires_at', $data) ? $data['expires_at'] : $existing['expires_at'],
        ]);

        return $this->get($id);
    }

    public function delete(string $id): bool
    {
        $stmt = Database::connection()->prepare('DELETE FROM announcements WHERE id = :id');
        $stmt->execute(['id' => $id]);

        return $stmt->rowCount() > 0;
    }
}
