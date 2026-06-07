<?php

declare(strict_types=1);

namespace Hg\Api\Modules\Fieldwork;

use Hg\Api\Core\Auth;
use Hg\Api\Core\Database;
use Hg\Api\Core\Request;
use Hg\Api\Core\Response;
use InvalidArgumentException;
use Throwable;

final class FieldWorkController
{
    public function __construct(private readonly FieldWorkService $service = new FieldWorkService()) {}

    public function handle(string $method, ?string $action, ?string $id = null): void
    {
        try {
            $user = Auth::requireUser();

            if ($method === 'GET' && $action === 'zone-status') {
                Auth::requirePermission($user, 'attendance.self');
                $lat = Request::query('latitude');
                $lng = Request::query('longitude');
                if ($lat === null || $lng === null) {
                    Response::error('latitude and longitude are required', 422);
                    return;
                }
                $branchId = $this->resolveBranchId($user, Request::query('branch_id'));
                $clockInOnly = Request::query('clock_in_only') === '1';
                $accuracy = Request::query('accuracy_m') ?? Request::query('accuracy');
                $accuracyM = $accuracy !== null && $accuracy !== '' ? (float) $accuracy : null;
                Response::json([
                    'success' => true,
                    'data' => $this->service->zoneStatus(
                        (float) $lat,
                        (float) $lng,
                        $branchId,
                        $clockInOnly,
                        $accuracyM
                    ),
                ]);
                return;
            }

            if ($method === 'GET' && ($action === null || $action === 'sites')) {
                $branchId = $this->resolveBranchId($user, Request::query('branch_id'));
                if (!Auth::hasPermission($user, 'attendance.self') && !Auth::hasPermission($user, 'attendance.view')) {
                    Response::error('Forbidden', 403);
                    return;
                }
                // HR/admin GIS page needs every active zone; employees only see branch clock-in zones.
                $sites = Auth::hasPermission($user, 'attendance.view')
                    ? $this->service->listSites($branchId)
                    : $this->service->listClockInSites($branchId);
                Response::json(['success' => true, 'data' => $sites]);
                return;
            }

            if ($method === 'POST' && $action === 'sites') {
                Auth::requirePermission($user, 'attendance.manage');
                $body = Request::jsonBody();
                $row = $this->service->createSite($body);
                Response::json(['success' => true, 'data' => $row], 201);
                return;
            }

            if ($method === 'PUT' && $action === 'sites' && $id) {
                Auth::requirePermission($user, 'attendance.manage');
                $row = $this->service->updateSite($id, Request::jsonBody());
                Response::json(['success' => true, 'data' => $row]);
                return;
            }

            if ($method === 'DELETE' && $action === 'sites' && $id) {
                Auth::requirePermission($user, 'attendance.manage');
                $this->service->deleteSite($id);
                Response::json(['success' => true, 'data' => ['deleted' => true]]);
                return;
            }

            if ($method === 'GET' && $action === 'checkins') {
                $limit = (int) (Request::query('limit') ?? 30);
                if (Auth::hasPermission($user, 'attendance.view')) {
                    $branchId = Request::query('branch_id');
                    $date = Request::query('date');
                    Response::json([
                        'success' => true,
                        'data' => $this->service->branchCheckins($branchId, $limit, $date),
                    ]);
                    return;
                }
                Auth::requirePermission($user, 'attendance.self');
                $employeeId = $user['employee_id'] ?? null;
                if (!$employeeId) {
                    Response::error('No employee linked', 422);
                    return;
                }
                Response::json(['success' => true, 'data' => $this->service->myCheckins($employeeId, $limit)]);
                return;
            }

            if ($method === 'POST' && $action === 'checkin') {
                Response::error(
                    'Off-site check-in is not available. Restaurant staff must clock in at the branch.',
                    422
                );
                return;
            }

            Response::error('Not found', 404);
        } catch (InvalidArgumentException $e) {
            Response::error($e->getMessage(), 422);
        } catch (Throwable $e) {
            Response::error($e->getMessage(), 500);
        }
    }

    private function resolveBranchId(array $user, ?string $queryBranch): ?string
    {
        if ($queryBranch) {
            return $queryBranch;
        }
        if (!empty($user['employee_id'])) {
            $stmt = Database::connection()->prepare('SELECT branch_id FROM employees WHERE id = :id');
            $stmt->execute(['id' => $user['employee_id']]);
            $emp = $stmt->fetch();
            return $emp['branch_id'] ?? null;
        }
        return null;
    }
}
