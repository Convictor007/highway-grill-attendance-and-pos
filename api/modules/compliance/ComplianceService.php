<?php

declare(strict_types=1);

namespace Hg\Api\Modules\Compliance;

use Hg\Api\Core\Database;

final class ComplianceService
{
    public function checklists(): array
    {
        return Database::connection()->query(
            'SELECT * FROM compliance_checklists ORDER BY checklist_type, name'
        )->fetchAll();
    }

    public function logs(?string $branchId = null, ?int $limit = 50): array
    {
        $sql = 'SELECT cl.*, cc.name AS checklist_name, cc.checklist_type, cc.frequency,
                       b.name AS branch_name,
                       e.first_name, e.last_name, e.emp_number
                FROM compliance_logs cl
                INNER JOIN compliance_checklists cc ON cc.id = cl.checklist_id
                INNER JOIN branches b ON b.id = cl.branch_id
                LEFT JOIN employees e ON e.id = cl.completed_by
                WHERE 1=1';
        $params = [];
        if ($branchId) {
            $sql .= ' AND cl.branch_id = :b';
            $params['b'] = $branchId;
        }
        $sql .= ' ORDER BY cl.completed_at DESC LIMIT ' . max(1, min((int) $limit, 200));
        $stmt = Database::connection()->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll();
    }

    public function createLog(array $data, ?string $employeeId): array
    {
        $id = Database::uuid();
        Database::connection()->prepare(
            'INSERT INTO compliance_logs (id, checklist_id, branch_id, completed_by, completed_at, status, notes)
             VALUES (:id, :cid, :bid, :by, :at, :st, :notes)'
        )->execute([
            'id' => $id,
            'cid' => $data['checklist_id'],
            'bid' => $data['branch_id'],
            'by' => $employeeId,
            'at' => $data['completed_at'] ?? date('Y-m-d H:i:s'),
            'st' => $data['status'],
            'notes' => $data['notes'] ?? null,
        ]);
        $stmt = Database::connection()->prepare(
            'SELECT cl.*, cc.name AS checklist_name FROM compliance_logs cl
             INNER JOIN compliance_checklists cc ON cc.id = cl.checklist_id
             WHERE cl.id = :id'
        );
        $stmt->execute(['id' => $id]);
        return $stmt->fetch();
    }

    public function auditLogs(?int $limit = 100): array
    {
        $lim = max(1, min((int) $limit, 500));
        return Database::connection()->query(
            "SELECT al.*, u.email AS user_email
             FROM audit_logs al
             LEFT JOIN users u ON u.id = al.user_id
             ORDER BY al.created_at DESC
             LIMIT $lim"
        )->fetchAll();
    }

    public function createChecklist(array $data): array
    {
        $name = trim((string) ($data['name'] ?? ''));
        if ($name === '') {
            throw new \InvalidArgumentException('name is required');
        }
        $type = (string) ($data['checklist_type'] ?? 'labor');
        $allowedTypes = ['food_safety', 'labor', 'fire_safety', 'health_permit'];
        if (!in_array($type, $allowedTypes, true)) {
            throw new \InvalidArgumentException('Invalid checklist_type');
        }
        $frequency = (string) ($data['frequency'] ?? 'monthly');
        $allowedFreq = ['daily', 'weekly', 'monthly', 'annual'];
        if (!in_array($frequency, $allowedFreq, true)) {
            throw new \InvalidArgumentException('Invalid frequency');
        }
        $id = Database::uuid();
        Database::connection()->prepare(
            'INSERT INTO compliance_checklists (id, name, checklist_type, frequency, due_day)
             VALUES (:id, :name, :type, :freq, :due)'
        )->execute([
            'id' => $id,
            'name' => $name,
            'type' => $type,
            'freq' => $frequency,
            'due' => isset($data['due_day']) ? (int) $data['due_day'] : null,
        ]);
        $stmt = Database::connection()->prepare('SELECT * FROM compliance_checklists WHERE id = :id');
        $stmt->execute(['id' => $id]);
        return $stmt->fetch();
    }

    public function updateChecklist(string $id, array $data): ?array
    {
        $stmt = Database::connection()->prepare('SELECT id FROM compliance_checklists WHERE id = :id LIMIT 1');
        $stmt->execute(['id' => $id]);
        if (!$stmt->fetch()) {
            return null;
        }
        $sets = [];
        $params = ['id' => $id];
        if (isset($data['name']) && trim((string) $data['name']) !== '') {
            $sets[] = 'name = :name';
            $params['name'] = trim((string) $data['name']);
        }
        if (isset($data['checklist_type'])) {
            $sets[] = 'checklist_type = :type';
            $params['type'] = $data['checklist_type'];
        }
        if (isset($data['frequency'])) {
            $sets[] = 'frequency = :freq';
            $params['freq'] = $data['frequency'];
        }
        if (array_key_exists('due_day', $data)) {
            $sets[] = 'due_day = :due';
            $params['due'] = $data['due_day'] !== null && $data['due_day'] !== '' ? (int) $data['due_day'] : null;
        }
        if ($sets !== []) {
            Database::connection()->prepare(
                'UPDATE compliance_checklists SET ' . implode(', ', $sets) . ' WHERE id = :id'
            )->execute($params);
        }
        $out = Database::connection()->prepare('SELECT * FROM compliance_checklists WHERE id = :id');
        $out->execute(['id' => $id]);
        return $out->fetch() ?: null;
    }

    public function deleteChecklist(string $id): bool
    {
        $stmt = Database::connection()->prepare('DELETE FROM compliance_checklists WHERE id = :id');
        $stmt->execute(['id' => $id]);
        return $stmt->rowCount() > 0;
    }
}
