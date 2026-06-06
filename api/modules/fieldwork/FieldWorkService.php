<?php

declare(strict_types=1);

namespace Hg\Api\Modules\Fieldwork;

use Hg\Api\Core\Database;
use Hg\Api\Core\Schema;
use Hg\Api\Modules\Attendance\AttendanceService;
use Hg\Api\Modules\Geocode\GeocodeService;

final class FieldWorkService
{
    public function branchHasActiveZones(?string $branchId): bool
    {
        if ($branchId === null || $branchId === '') {
            $stmt = Database::connection()->query(
                'SELECT COUNT(*) FROM field_work_sites WHERE is_active = 1 AND branch_id IS NULL'
            );

            return (int) $stmt->fetchColumn() > 0;
        }

        $stmt = Database::connection()->prepare(
            'SELECT COUNT(*) FROM field_work_sites
             WHERE is_active = 1 AND (branch_id = :b OR branch_id IS NULL)'
        );
        $stmt->execute(['b' => $branchId]);

        return (int) $stmt->fetchColumn() > 0;
    }

    public function listSites(?string $branchId = null): array
    {
        $sql = 'SELECT id, branch_id, name, address, latitude, longitude, radius_m, is_active
                FROM field_work_sites WHERE is_active = 1';
        $params = [];
        if ($branchId) {
            $sql .= ' AND (branch_id = :b OR branch_id IS NULL)';
            $params['b'] = $branchId;
        }
        $sql .= ' ORDER BY name';
        $stmt = Database::connection()->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll();
    }

    public function getSite(string $id): ?array
    {
        $stmt = Database::connection()->prepare(
            'SELECT id, branch_id, name, address, latitude, longitude, radius_m, is_active, created_at
             FROM field_work_sites WHERE id = :id LIMIT 1'
        );
        $stmt->execute(['id' => $id]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public function createSite(array $data): array
    {
        $name = trim((string) ($data['name'] ?? ''));
        if ($name === '') {
            throw new \InvalidArgumentException('Zone name is required');
        }
        $lat = (float) ($data['latitude'] ?? 0);
        $lng = (float) ($data['longitude'] ?? 0);
        $this->assertCoords($lat, $lng);
        $radius = $this->normalizeRadius((int) ($data['radius_m'] ?? 150));
        $id = Database::uuid();
        $branchId = isset($data['branch_id']) && $data['branch_id'] !== ''
            ? (string) $data['branch_id']
            : null;
        $address = $this->resolveAddressFromCoords($lat, $lng, isset($data['address']) ? trim((string) $data['address']) : null);

        Database::connection()->prepare(
            'INSERT INTO field_work_sites (id, branch_id, name, address, latitude, longitude, radius_m, is_active)
             VALUES (:id, :bid, :name, :addr, :lat, :lng, :radius, 1)'
        )->execute([
            'id' => $id,
            'bid' => $branchId,
            'name' => $name,
            'addr' => $address,
            'lat' => $lat,
            'lng' => $lng,
            'radius' => $radius,
        ]);

        $this->persistBranchMapCenter($branchId, $lat, $lng);

        return $this->getSite($id) ?? [];
    }

    public function updateSite(string $id, array $data): array
    {
        $existing = $this->getSite($id);
        if (!$existing || !(int) ($existing['is_active'] ?? 0)) {
            throw new \InvalidArgumentException('Work zone not found');
        }

        $name = array_key_exists('name', $data) ? trim((string) $data['name']) : (string) $existing['name'];
        if ($name === '') {
            throw new \InvalidArgumentException('Zone name is required');
        }
        $lat = array_key_exists('latitude', $data) ? (float) $data['latitude'] : (float) $existing['latitude'];
        $lng = array_key_exists('longitude', $data) ? (float) $data['longitude'] : (float) $existing['longitude'];
        $this->assertCoords($lat, $lng);
        $radius = array_key_exists('radius_m', $data)
            ? $this->normalizeRadius((int) $data['radius_m'])
            : (int) $existing['radius_m'];
        $branchId = array_key_exists('branch_id', $data)
            ? ($data['branch_id'] !== '' && $data['branch_id'] !== null ? (string) $data['branch_id'] : null)
            : $existing['branch_id'];
        $clientAddress = array_key_exists('address', $data)
            ? (trim((string) $data['address']) ?: null)
            : ($existing['address'] ?? null);
        $address = $this->resolveAddressFromCoords($lat, $lng, $clientAddress);

        Database::connection()->prepare(
            'UPDATE field_work_sites
             SET branch_id = :bid, name = :name, address = :addr, latitude = :lat, longitude = :lng, radius_m = :radius
             WHERE id = :id'
        )->execute([
            'id' => $id,
            'bid' => $branchId,
            'name' => $name,
            'addr' => $address,
            'lat' => $lat,
            'lng' => $lng,
            'radius' => $radius,
        ]);

        $this->persistBranchMapCenter($branchId, $lat, $lng);

        return $this->getSite($id) ?? [];
    }

    public function deleteSite(string $id): void
    {
        $existing = $this->getSite($id);
        if (!$existing) {
            throw new \InvalidArgumentException('Work zone not found');
        }
        Database::connection()->prepare('UPDATE field_work_sites SET is_active = 0 WHERE id = :id')->execute(['id' => $id]);
    }

    /** @return array{inside: bool, site: ?array, distance_m: ?float} */
    public function zoneStatus(float $lat, float $lng, ?string $branchId): array
    {
        $this->assertCoords($lat, $lng);
        $match = $this->matchSite($lat, $lng, $branchId);
        if ($match) {
            return [
                'inside' => true,
                'site' => $match,
                'distance_m' => round(
                    $this->distanceMeters($lat, $lng, (float) $match['latitude'], (float) $match['longitude']),
                    1
                ),
            ];
        }
        return ['inside' => false, 'site' => null, 'distance_m' => null];
    }

    public function matchSite(float $lat, float $lng, ?string $branchId): ?array
    {
        $best = null;
        $bestDist = PHP_FLOAT_MAX;
        foreach ($this->listSites($branchId) as $site) {
            $dist = $this->distanceMeters(
                $lat,
                $lng,
                (float) $site['latitude'],
                (float) $site['longitude']
            );
            $radius = (int) ($site['radius_m'] ?? 150);
            if ($dist <= $radius && $dist < $bestDist) {
                $bestDist = $dist;
                $best = $site;
            }
        }
        return $best;
    }

    public function branchCheckins(?string $branchId, int $limit = 100, ?string $date = null): array
    {
        $addrCol = Schema::hasColumn('field_work_checkins', 'address') ? ', c.address' : '';
        $attCol = Schema::hasColumn('field_work_checkins', 'attendance_id') ? ', c.attendance_id' : '';
        $sql = 'SELECT c.id, c.employee_id, c.site_id, c.latitude, c.longitude' . $addrCol . $attCol . ', c.notes, c.checked_in_at,
                       s.name AS site_name, e.emp_number, e.first_name, e.last_name
                FROM field_work_checkins c
                INNER JOIN employees e ON e.id = c.employee_id
                LEFT JOIN field_work_sites s ON s.id = c.site_id
                WHERE 1=1';
        $params = [];
        if ($branchId) {
            $sql .= ' AND e.branch_id = :bid';
            $params['bid'] = $branchId;
        }
        if ($date !== null && $date !== '') {
            $sql .= ' AND DATE(c.checked_in_at) = :d';
            $params['d'] = $date;
        }
        $sql .= ' ORDER BY c.checked_in_at DESC LIMIT ' . max(1, min($limit, 200));
        $stmt = Database::connection()->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll();
    }

    public function myCheckins(string $employeeId, int $limit = 30): array
    {
        $addrCol = Schema::hasColumn('field_work_checkins', 'address') ? ', c.address' : '';
        $attCol = Schema::hasColumn('field_work_checkins', 'attendance_id') ? ', c.attendance_id' : '';
        $stmt = Database::connection()->prepare(
            'SELECT c.id, c.employee_id, c.site_id, c.latitude, c.longitude' . $addrCol . $attCol . ', c.notes, c.checked_in_at,
                    s.name AS site_name
             FROM field_work_checkins c
             LEFT JOIN field_work_sites s ON s.id = c.site_id
             WHERE c.employee_id = :eid
             ORDER BY c.checked_in_at DESC
             LIMIT ' . max(1, min($limit, 100))
        );
        $stmt->execute(['eid' => $employeeId]);
        return $stmt->fetchAll();
    }

    public function checkIn(
        string $employeeId,
        float $lat,
        float $lng,
        ?string $siteId = null,
        ?string $notes = null,
        ?string $address = null
    ): array {
        $branchId = $this->employeeBranchId($employeeId);
        $site = $this->matchSite($lat, $lng, $branchId);
        if (!$site) {
            throw new \InvalidArgumentException(
                'You must be inside a registered work zone to check in. Ask HR to register your branch area on the field map.'
            );
        }
        if ($siteId !== null && $siteId !== '' && $siteId !== $site['id']) {
            throw new \InvalidArgumentException('Your location is outside the selected work zone.');
        }
        $matchedSite = $site['id'];
        [$attendanceId, $attendanceAction] = $this->resolveAttendanceForFieldCheckIn($employeeId, $lat, $lng, $address);

        $id = Database::uuid();
        $pdo = Database::connection();
        $hasAddr = Schema::hasColumn('field_work_checkins', 'address');
        $hasAtt = Schema::hasColumn('field_work_checkins', 'attendance_id');

        if ($hasAddr && $hasAtt) {
            $pdo->prepare(
                'INSERT INTO field_work_checkins (id, employee_id, site_id, attendance_id, latitude, longitude, address, notes)
                 VALUES (:id, :eid, :sid, :aid, :lat, :lng, :addr, :notes)'
            )->execute([
                'id' => $id,
                'eid' => $employeeId,
                'sid' => $matchedSite,
                'aid' => $attendanceId,
                'lat' => $lat,
                'lng' => $lng,
                'addr' => $address,
                'notes' => $notes,
            ]);
        } elseif ($hasAddr) {
            $pdo->prepare(
                'INSERT INTO field_work_checkins (id, employee_id, site_id, latitude, longitude, address, notes)
                 VALUES (:id, :eid, :sid, :lat, :lng, :addr, :notes)'
            )->execute([
                'id' => $id,
                'eid' => $employeeId,
                'sid' => $matchedSite,
                'lat' => $lat,
                'lng' => $lng,
                'addr' => $address,
                'notes' => $notes,
            ]);
        } elseif ($hasAtt) {
            $pdo->prepare(
                'INSERT INTO field_work_checkins (id, employee_id, site_id, attendance_id, latitude, longitude, notes)
                 VALUES (:id, :eid, :sid, :aid, :lat, :lng, :notes)'
            )->execute([
                'id' => $id,
                'eid' => $employeeId,
                'sid' => $matchedSite,
                'aid' => $attendanceId,
                'lat' => $lat,
                'lng' => $lng,
                'notes' => $notes,
            ]);
        } else {
            $pdo->prepare(
                'INSERT INTO field_work_checkins (id, employee_id, site_id, latitude, longitude, notes)
                 VALUES (:id, :eid, :sid, :lat, :lng, :notes)'
            )->execute([
                'id' => $id,
                'eid' => $employeeId,
                'sid' => $matchedSite,
                'lat' => $lat,
                'lng' => $lng,
                'notes' => $notes,
            ]);
        }

        $stmt = Database::connection()->prepare(
            'SELECT c.*, s.name AS site_name
             FROM field_work_checkins c
             LEFT JOIN field_work_sites s ON s.id = c.site_id
             WHERE c.id = :id'
        );
        $stmt->execute(['id' => $id]);
        $row = $stmt->fetch() ?: [];
        if ($row !== []) {
            $row['attendance_action'] = $attendanceAction;
        }

        return $row;
    }

    /** @return array{0: ?string, 1: ?string} */
    private function resolveAttendanceForFieldCheckIn(
        string $employeeId,
        float $lat,
        float $lng,
        ?string $address
    ): array {
        $attendance = new AttendanceService();
        $open = $attendance->openSession($employeeId);
        if ($open) {
            return [(string) $open['id'], 'linked'];
        }

        try {
            $row = $attendance->clockIn($employeeId, 'app', $lat, $lng, $address);
            $id = $row['id'] ?? null;

            return $id ? [(string) $id, 'clocked_in'] : [null, null];
        } catch (\RuntimeException) {
            $open = $attendance->openSession($employeeId);

            return $open ? [(string) $open['id'], 'linked'] : [null, null];
        }
    }

    private function employeeBranchId(string $employeeId): ?string
    {
        $stmt = Database::connection()->prepare('SELECT branch_id FROM employees WHERE id = :id LIMIT 1');
        $stmt->execute(['id' => $employeeId]);
        $emp = $stmt->fetch();
        return $emp['branch_id'] ?? null;
    }

    private function normalizeRadius(int $radius): int
    {
        return max(25, min(2000, $radius));
    }

    private function assertCoords(float $lat, float $lng): void
    {
        if ($lat < -90 || $lat > 90 || $lng < -180 || $lng > 180) {
            throw new \InvalidArgumentException('Invalid coordinates');
        }
    }

    private function distanceMeters(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        $r = 6371000;
        $dLat = deg2rad($lat2 - $lat1);
        $dLng = deg2rad($lng2 - $lng1);
        $a = sin($dLat / 2) ** 2
            + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLng / 2) ** 2;
        return $r * 2 * atan2(sqrt($a), sqrt(1 - $a));
    }

    private function resolveAddressFromCoords(float $lat, float $lng, ?string $fallback): ?string
    {
        try {
            $geo = (new GeocodeService())->reverse($lat, $lng);
            $formatted = trim((string) ($geo['formatted'] ?? ''));
            if ($formatted !== '') {
                return $formatted;
            }
        } catch (\Throwable) {
        }

        $fallback = $fallback !== null ? trim($fallback) : '';
        return $fallback !== '' ? $fallback : null;
    }

    private function persistBranchMapCenter(?string $branchId, float $lat, float $lng): void
    {
        if ($branchId === null || $branchId === '') {
            return;
        }
        if (!Schema::hasColumn('branches', 'default_latitude')) {
            return;
        }
        Database::connection()->prepare(
            'UPDATE branches SET default_latitude = :lat, default_longitude = :lng WHERE id = :id'
        )->execute(['lat' => $lat, 'lng' => $lng, 'id' => $branchId]);
    }
}
