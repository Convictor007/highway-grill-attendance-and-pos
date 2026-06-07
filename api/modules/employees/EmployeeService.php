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
             email, phone, hire_date, employment_type, status, date_of_birth, gender, nationality, national_id,
             address, emergency_name, emergency_phone, photo_url)
             VALUES (:id, :branch_id, :department_id, :position_id, :emp_number, :first_name, :last_name,
             :email, :phone, :hire_date, :employment_type, :status, :dob, :gender, :nationality, :national_id,
             :address, :emergency_name, :emergency_phone, :photo_url)'
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
            'employment_type' => $this->normalizeEmploymentType($data['employment_type'] ?? 'full_time'),
            'status' => $data['status'] ?? 'active',
            'dob' => $this->nullableDate($data['date_of_birth'] ?? null),
            'gender' => $this->normalizeGender($data['gender'] ?? null),
            'nationality' => $this->nullableString($data['nationality'] ?? null),
            'national_id' => $this->nullableString($data['national_id'] ?? null),
            'address' => $this->nullableString($data['address'] ?? null),
            'emergency_name' => $this->nullableString($data['emergency_name'] ?? null),
            'emergency_phone' => $this->nullableString($data['emergency_phone'] ?? null),
            'photo_url' => $this->nullableString($data['photo_url'] ?? null),
        ]);
        if (($data['status'] ?? 'active') === 'active') {
            (new LeaveService())->ensureBalancesForEmployee($id, (int) date('Y'));
        }
        return $this->get($id) ?? [];
    }

    public function update(string $id, array $data): ?array
    {
        $fields = [
            'first_name', 'last_name', 'email', 'phone', 'branch_id', 'department_id', 'position_id',
            'employment_type', 'status', 'address', 'date_of_birth', 'gender', 'nationality', 'national_id',
            'emergency_name', 'emergency_phone', 'photo_url', 'hire_date',
        ];
        $sets = [];
        $params = ['id' => $id];
        foreach ($fields as $f) {
            if (!array_key_exists($f, $data)) {
                continue;
            }
            $val = $data[$f];
            if ($f === 'date_of_birth') {
                $val = $this->nullableDate($val);
            } elseif ($f === 'gender') {
                $val = $this->normalizeGender($val);
            } elseif ($f === 'employment_type') {
                $val = $this->normalizeEmploymentType((string) $val);
            } elseif (in_array($f, ['department_id', 'position_id'], true)) {
                $val = ($val === '' || $val === null) ? null : $val;
            } elseif (in_array($f, ['address', 'nationality', 'national_id', 'emergency_name', 'emergency_phone', 'photo_url'], true)) {
                $val = $this->nullableString($val);
            }
            $sets[] = "$f = :$f";
            $params[$f] = $val;
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
        $allowed = [
            'phone', 'email', 'address', 'emergency_name', 'emergency_phone',
            'date_of_birth', 'gender', 'nationality',
        ];
        $sets = [];
        $params = ['id' => $id];
        foreach ($allowed as $f) {
            if (!array_key_exists($f, $data)) {
                continue;
            }
            $val = $data[$f];
            if ($f === 'date_of_birth') {
                $val = $this->nullableDate($val);
            } elseif ($f === 'gender') {
                $val = $this->normalizeGender($val);
            } elseif (in_array($f, ['address', 'nationality', 'national_id', 'emergency_name', 'emergency_phone'], true)) {
                $val = $this->nullableString($val);
            }
            $sets[] = "$f = :$f";
            $params[$f] = $val;
        }
        if ($sets === []) {
            return $this->get($id);
        }
        Database::connection()->prepare('UPDATE employees SET ' . implode(', ', $sets) . ' WHERE id = :id')
            ->execute($params);
        return $this->get($id);
    }

    public function uploadPhoto(string $employeeId, array $file): array
    {
        if (empty($file['tmp_name']) || !is_uploaded_file($file['tmp_name'])) {
            throw new \InvalidArgumentException('photo file is required');
        }
        $maxBytes = 3 * 1024 * 1024;
        if (($file['size'] ?? 0) > $maxBytes) {
            throw new \InvalidArgumentException('Photo too large (max 3 MB)');
        }

        $ext = strtolower(pathinfo((string) ($file['name'] ?? ''), PATHINFO_EXTENSION));
        $allowed = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
        if (!in_array($ext, $allowed, true)) {
            throw new \InvalidArgumentException('Photo must be JPG, PNG, WebP, or GIF');
        }

        $dir = dirname(__DIR__, 2) . '/uploads/photos';
        if (!is_dir($dir) && !mkdir($dir, 0755, true) && !is_dir($dir)) {
            throw new \RuntimeException('Upload directory unavailable');
        }

        $filename = $employeeId . '.' . ($ext === 'jpeg' ? 'jpg' : $ext);
        $dest = $dir . '/' . $filename;
        if (!move_uploaded_file($file['tmp_name'], $dest)) {
            throw new \RuntimeException('Could not save photo');
        }

        $url = '/api/uploads/photos/' . $filename;
        Database::connection()->prepare('UPDATE employees SET photo_url = :url WHERE id = :id')
            ->execute(['url' => $url, 'id' => $employeeId]);

        $row = $this->get($employeeId);
        return $row ?? [];
    }

    public function delete(string $id): bool
    {
        $stmt = Database::connection()->prepare(
            'UPDATE employees SET status = :status WHERE id = :id'
        );
        $stmt->execute(['id' => $id, 'status' => 'terminated']);
        return $stmt->rowCount() > 0;
    }

    public function validatePositionForBranch(string $branchId, ?string $departmentId, ?string $positionId): void
    {
        if ($positionId === null || $positionId === '') {
            return;
        }
        $stmt = Database::connection()->prepare(
            'SELECT d.branch_id FROM positions p
             INNER JOIN departments d ON d.id = p.department_id
             WHERE p.id = :pid LIMIT 1'
        );
        $stmt->execute(['pid' => $positionId]);
        $row = $stmt->fetch();
        if (!$row || (string) $row['branch_id'] !== $branchId) {
            throw new \InvalidArgumentException('Invalid position for branch');
        }
        if ($departmentId !== null && $departmentId !== '') {
            $check = Database::connection()->prepare(
                'SELECT id FROM positions WHERE id = :pid AND department_id = :did LIMIT 1'
            );
            $check->execute(['pid' => $positionId, 'did' => $departmentId]);
            if (!$check->fetch()) {
                throw new \InvalidArgumentException('Position does not match department');
            }
        }
    }

    private function normalizeGender(mixed $value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }
        $g = (string) $value;
        if (!in_array($g, ['male', 'female', 'other', 'prefer_not'], true)) {
            throw new \InvalidArgumentException('Invalid gender');
        }
        return $g;
    }

    private function normalizeEmploymentType(string $value): string
    {
        if (!in_array($value, ['full_time', 'part_time', 'casual', 'seasonal'], true)) {
            return 'full_time';
        }
        return $value;
    }

    private function nullableString(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }
        $s = trim((string) $value);
        return $s === '' ? null : $s;
    }

    private function nullableDate(mixed $value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }
        $s = (string) $value;
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $s)) {
            throw new \InvalidArgumentException('date_of_birth must be YYYY-MM-DD');
        }
        return $s;
    }
}
