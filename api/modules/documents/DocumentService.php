<?php

declare(strict_types=1);

namespace Hg\Api\Modules\Documents;

use Hg\Api\Core\Database;

final class DocumentService
{
    public function forEmployee(string $employeeId): array
    {
        $stmt = Database::connection()->prepare(
            'SELECT id, category, title, file_url, file_type, expires_at, created_at, is_confidential
             FROM documents
             WHERE employee_id = :eid AND is_confidential = 0
             ORDER BY created_at DESC'
        );
        $stmt->execute(['eid' => $employeeId]);
        return $stmt->fetchAll();
    }

    public function forEmployeeHr(string $employeeId): array
    {
        $stmt = Database::connection()->prepare(
            'SELECT d.id, d.employee_id, d.category, d.title, d.file_url, d.file_type, d.expires_at,
                    d.created_at, d.is_confidential, e.first_name, e.last_name, e.emp_number
             FROM documents d
             INNER JOIN employees e ON e.id = d.employee_id
             WHERE d.employee_id = :eid
             ORDER BY d.created_at DESC'
        );
        $stmt->execute(['eid' => $employeeId]);
        return $stmt->fetchAll();
    }

    public function create(array $data, string $userId): array
    {
        $employeeId = (string) ($data['employee_id'] ?? '');
        if ($employeeId === '') {
            throw new \InvalidArgumentException('employee_id is required');
        }
        $title = trim((string) ($data['title'] ?? ''));
        if ($title === '') {
            throw new \InvalidArgumentException('title is required');
        }
        $category = (string) ($data['category'] ?? 'other');
        $allowed = ['contract', 'id', 'certificate', 'payslip', 'memo', 'other'];
        if (!in_array($category, $allowed, true)) {
            $category = 'other';
        }

        $id = Database::uuid();
        Database::connection()->prepare(
            'INSERT INTO documents (id, employee_id, category, title, file_url, file_type, is_confidential, expires_at, uploaded_by)
             VALUES (:id, :eid, :cat, :title, :url, :ftype, :conf, :exp, :by)'
        )->execute([
            'id' => $id,
            'eid' => $employeeId,
            'cat' => $category,
            'title' => $title,
            'url' => isset($data['file_url']) ? trim((string) $data['file_url']) : null,
            'ftype' => $data['file_type'] ?? null,
            'conf' => !empty($data['is_confidential']) ? 1 : 0,
            'exp' => $data['expires_at'] ?? null,
            'by' => $userId,
        ]);

        $stmt = Database::connection()->prepare(
            'SELECT d.*, e.first_name, e.last_name, e.emp_number
             FROM documents d
             INNER JOIN employees e ON e.id = d.employee_id
             WHERE d.id = :id'
        );
        $stmt->execute(['id' => $id]);

        return $stmt->fetch();
    }

    public function upload(array $fields, array $file, string $userId): array
    {
        $employeeId = (string) ($fields['employee_id'] ?? '');
        if ($employeeId === '') {
            throw new \InvalidArgumentException('employee_id is required');
        }
        $title = trim((string) ($fields['title'] ?? ''));
        if ($title === '') {
            throw new \InvalidArgumentException('title is required');
        }
        if (empty($file['tmp_name']) || !is_uploaded_file($file['tmp_name'])) {
            throw new \InvalidArgumentException('file is required');
        }
        $maxBytes = 10 * 1024 * 1024;
        if (($file['size'] ?? 0) > $maxBytes) {
            throw new \InvalidArgumentException('File too large (max 10 MB)');
        }

        $category = (string) ($fields['category'] ?? 'other');
        $allowed = ['contract', 'id', 'certificate', 'payslip', 'memo', 'other'];
        if (!in_array($category, $allowed, true)) {
            $category = 'other';
        }

        $ext = strtolower(pathinfo((string) ($file['name'] ?? ''), PATHINFO_EXTENSION));
        $safeExt = preg_match('/^[a-z0-9]{1,8}$/', $ext) ? $ext : 'bin';
        $mime = (string) ($file['type'] ?? '');
        $id = Database::uuid();
        $dir = dirname(__DIR__, 2) . '/uploads/documents';
        if (!is_dir($dir) && !mkdir($dir, 0755, true) && !is_dir($dir)) {
            throw new \RuntimeException('Upload directory unavailable');
        }
        $filename = $id . '.' . $safeExt;
        $dest = $dir . '/' . $filename;
        if (!move_uploaded_file($file['tmp_name'], $dest)) {
            throw new \RuntimeException('Could not save uploaded file');
        }

        $fileUrl = '/api/uploads/documents/' . $filename;
        $sizeKb = (int) ceil(((int) ($file['size'] ?? 0)) / 1024);

        Database::connection()->prepare(
            'INSERT INTO documents (id, employee_id, category, title, file_url, file_type, file_size_kb, is_confidential, expires_at, uploaded_by)
             VALUES (:id, :eid, :cat, :title, :url, :ftype, :size, :conf, :exp, :by)'
        )->execute([
            'id' => $id,
            'eid' => $employeeId,
            'cat' => $category,
            'title' => $title,
            'url' => $fileUrl,
            'ftype' => $mime !== '' ? $mime : $safeExt,
            'size' => $sizeKb,
            'conf' => !empty($fields['is_confidential']) ? 1 : 0,
            'exp' => $fields['expires_at'] ?? null,
            'by' => $userId,
        ]);

        $stmt = Database::connection()->prepare(
            'SELECT d.*, e.first_name, e.last_name, e.emp_number
             FROM documents d
             INNER JOIN employees e ON e.id = d.employee_id
             WHERE d.id = :id'
        );
        $stmt->execute(['id' => $id]);
        return $stmt->fetch();
    }

    public function delete(string $id): bool
    {
        $stmt = Database::connection()->prepare('SELECT id, file_url FROM documents WHERE id = :id LIMIT 1');
        $stmt->execute(['id' => $id]);
        $row = $stmt->fetch();
        if (!$row) {
            return false;
        }
        Database::connection()->prepare('DELETE FROM documents WHERE id = :id')->execute(['id' => $id]);
        $url = (string) ($row['file_url'] ?? '');
        if (str_starts_with($url, '/api/uploads/documents/')) {
            $filename = basename($url);
            $path = dirname(__DIR__, 2) . '/uploads/documents/' . $filename;
            if (is_file($path)) {
                @unlink($path);
            }
        }
        return true;
    }
}
