<?php

declare(strict_types=1);

namespace Hg\Api\Core;

final class AuditLog
{
    public static function write(
        ?string $userId,
        string $action,
        ?string $tableName = null,
        ?string $recordId = null,
        ?array $oldData = null,
        ?array $newData = null
    ): void {
        if (!in_array($action, ['create', 'update', 'delete', 'login', 'logout', 'export'], true)) {
            return;
        }
        Database::connection()->prepare(
            'INSERT INTO audit_logs (id, user_id, action, table_name, record_id, old_data, new_data, ip_address)
             VALUES (UUID(), :uid, :act, :tbl, :rid, :old, :new, :ip)'
        )->execute([
            'uid' => $userId,
            'act' => $action,
            'tbl' => $tableName,
            'rid' => $recordId,
            'old' => $oldData !== null ? json_encode($oldData) : null,
            'new' => $newData !== null ? json_encode($newData) : null,
            'ip' => $_SERVER['REMOTE_ADDR'] ?? null,
        ]);
    }
}
