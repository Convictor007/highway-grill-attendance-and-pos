<?php

declare(strict_types=1);

namespace Hg\Api\Modules\Reference;

use Hg\Api\Core\Auth;
use Hg\Api\Core\Database;
use Hg\Api\Core\Request;
use Hg\Api\Core\Response;
use Hg\Api\Core\Schema;
use Throwable;

final class ReferenceController
{
    public function handle(string $resource, string $method): void
    {
        try {
            $user = Auth::requireUser();
            Auth::requirePermission($user, 'employees.view');

            $pdo = Database::connection();
            $branchId = Request::query('branch_id');

            match ($resource) {
                'branches' => (function () use ($pdo) {
                    $cols = 'id, name, address, phone, is_active';
                    if (Schema::hasColumn('branches', 'default_latitude')) {
                        $cols .= ', default_latitude, default_longitude';
                    }
                    Response::json([
                        'success' => true,
                        'data' => $pdo->query(
                            "SELECT {$cols} FROM branches WHERE is_active = 1 ORDER BY name"
                        )->fetchAll(),
                    ]);
                })(),
                'departments' => (function () use ($pdo, $branchId) {
                    $sql = 'SELECT id, branch_id, name, cost_center FROM departments';
                    if ($branchId) {
                        $stmt = $pdo->prepare($sql . ' WHERE branch_id = :b ORDER BY name');
                        $stmt->execute(['b' => $branchId]);
                        $rows = $stmt->fetchAll();
                    } else {
                        $rows = $pdo->query($sql . ' ORDER BY name')->fetchAll();
                    }
                    Response::json(['success' => true, 'data' => $rows]);
                })(),
                'positions' => (function () use ($pdo, $branchId) {
                    $sql = 'SELECT p.id, p.department_id, p.title, p.pay_grade, p.min_hourly, p.max_hourly, p.is_tipped
                            FROM positions p';
                    if ($branchId) {
                        $sql .= ' INNER JOIN departments d ON d.id = p.department_id WHERE d.branch_id = :b';
                        $stmt = $pdo->prepare($sql . ' ORDER BY p.title');
                        $stmt->execute(['b' => $branchId]);
                        $rows = $stmt->fetchAll();
                    } else {
                        $rows = $pdo->query($sql . ' ORDER BY p.title')->fetchAll();
                    }
                    Response::json(['success' => true, 'data' => $rows]);
                })(),
                default => Response::error('Unknown reference', 404),
            };
        } catch (Throwable $e) {
            Response::error($e->getMessage(), 500);
        }
    }
}
