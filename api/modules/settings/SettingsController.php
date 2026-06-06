<?php

declare(strict_types=1);

namespace Hg\Api\Modules\Settings;

use Hg\Api\Core\AuditLog;
use Hg\Api\Core\Auth;
use Hg\Api\Core\Request;
use Hg\Api\Core\Response;
use Throwable;

final class SettingsController
{
    public function __construct(private readonly SettingsService $service = new SettingsService()) {}

    public function handle(string $resource, string $method, ?string $id): void
    {
        try {
            $user = Auth::requireUser();

            match ($resource) {
                'branches' => $this->branches($user, $method, $id),
                'departments' => $this->departments($user, $method, $id),
                'positions' => $this->positions($user, $method, $id),
                default => Response::error('Unknown settings resource', 404),
            };
        } catch (Throwable $e) {
            Response::error($e->getMessage(), 500);
        }
    }

    private function branches(array $user, string $method, ?string $id): void
    {
        if ($method === 'GET' && $id === null) {
            Auth::requirePermission($user, 'employees.view');
            Response::json(['success' => true, 'data' => $this->service->listBranches()]);
            return;
        }
        if ($method === 'GET' && $id !== null) {
            Auth::requirePermission($user, 'employees.view');
            $row = $this->service->getBranch($id);
            if (!$row) {
                Response::error('Branch not found', 404);
                return;
            }
            Response::json(['success' => true, 'data' => $row]);
            return;
        }
        if ($method === 'POST' && $id === null) {
            Auth::requirePermission($user, 'settings.branches.manage');
            $body = Request::jsonBody();
            if (empty($body['name'])) {
                Response::error('name required', 422);
                return;
            }
            $row = $this->service->createBranch($body);
            AuditLog::write($user['id'], 'create', 'branches', $row['id'] ?? null, null, $row);
            Response::json(['success' => true, 'data' => $row], 201);
            return;
        }
        if ($method === 'PUT' && $id !== null) {
            Auth::requirePermission($user, 'settings.branches.manage');
            $row = $this->service->updateBranch($id, Request::jsonBody());
            if (!$row) {
                Response::error('Branch not found', 404);
                return;
            }
            AuditLog::write($user['id'], 'update', 'branches', $id, null, $row);
            Response::json(['success' => true, 'data' => $row]);
            return;
        }
        Response::error('Method not allowed', 405);
    }

    private function departments(array $user, string $method, ?string $id): void
    {
        if ($method === 'GET' && $id === null) {
            Auth::requirePermission($user, 'employees.view');
            Response::json([
                'success' => true,
                'data' => $this->service->listDepartments(Request::query('branch_id')),
            ]);
            return;
        }
        if ($method === 'POST' && $id === null) {
            Auth::requirePermission($user, 'settings.departments.manage');
            $body = Request::jsonBody();
            if (empty($body['branch_id']) || empty($body['name'])) {
                Response::error('branch_id and name required', 422);
                return;
            }
            $row = $this->service->createDepartment($body);
            AuditLog::write($user['id'], 'create', 'departments', $row['id'] ?? null, null, $row);
            Response::json(['success' => true, 'data' => $row], 201);
            return;
        }
        if ($method === 'PUT' && $id !== null) {
            Auth::requirePermission($user, 'settings.departments.manage');
            $row = $this->service->updateDepartment($id, Request::jsonBody());
            if (!$row) {
                Response::error('Department not found', 404);
                return;
            }
            AuditLog::write($user['id'], 'update', 'departments', $id, null, $row);
            Response::json(['success' => true, 'data' => $row]);
            return;
        }
        Response::error('Method not allowed', 405);
    }

    private function positions(array $user, string $method, ?string $id): void
    {
        if ($method === 'GET' && $id === null) {
            Auth::requirePermission($user, 'employees.view');
            Response::json([
                'success' => true,
                'data' => $this->service->listPositions(
                    Request::query('department_id'),
                    Request::query('branch_id')
                ),
            ]);
            return;
        }
        if ($method === 'POST' && $id === null) {
            Auth::requirePermission($user, 'settings.departments.manage');
            $body = Request::jsonBody();
            if (empty($body['department_id']) || empty($body['title'])) {
                Response::error('department_id and title required', 422);
                return;
            }
            $row = $this->service->createPosition($body);
            AuditLog::write($user['id'], 'create', 'positions', $row['id'] ?? null, null, $row);
            Response::json(['success' => true, 'data' => $row], 201);
            return;
        }
        if ($method === 'PUT' && $id !== null) {
            Auth::requirePermission($user, 'settings.departments.manage');
            $row = $this->service->updatePosition($id, Request::jsonBody());
            if (!$row) {
                Response::error('Position not found', 404);
                return;
            }
            AuditLog::write($user['id'], 'update', 'positions', $id, null, $row);
            Response::json(['success' => true, 'data' => $row]);
            return;
        }
        Response::error('Method not allowed', 405);
    }
}
