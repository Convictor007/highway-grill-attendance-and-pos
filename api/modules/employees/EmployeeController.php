<?php

declare(strict_types=1);

namespace Hg\Api\Modules\Employees;

use Hg\Api\Core\Auth;
use Hg\Api\Core\Request;
use Hg\Api\Core\Response;
use Throwable;

final class EmployeeController
{
    public function __construct(private readonly EmployeeService $service = new EmployeeService()) {}

    public function handle(string $method, ?string $seg1, ?string $seg2): void
    {
        try {
            $user = Auth::requireUser();

            if ($method === 'POST' && $seg1 === 'me' && $seg2 === 'photo') {
                Auth::requirePermission($user, 'profile.edit.self');
                $eid = $user['employee_id'] ?? null;
                if (!$eid) {
                    Response::error('No employee profile linked', 404);
                    return;
                }
                $row = $this->service->uploadPhoto($eid, $_FILES['photo'] ?? []);
                Response::json(['success' => true, 'data' => $row]);
                return;
            }

            if ($method === 'GET' && $seg1 === 'me') {
                $eid = $user['employee_id'] ?? null;
                if (!$eid) {
                    Response::error('No employee profile linked', 404);
                    return;
                }
                $row = $this->service->get($eid);
                if (!$row) {
                    Response::error('Employee not found', 404);
                    return;
                }
                Response::json(['success' => true, 'data' => $row]);
                return;
            }

            if ($method === 'PUT' && $seg1 === 'me') {
                Auth::requirePermission($user, 'profile.edit.self');
                $eid = $user['employee_id'] ?? null;
                if (!$eid) {
                    Response::error('No employee profile linked', 404);
                    return;
                }
                $row = $this->service->updateSelf($eid, Request::jsonBody());
                Response::json(['success' => true, 'data' => $row]);
                return;
            }

            if ($method === 'GET' && $seg1 === null) {
                Auth::requirePermission($user, 'employees.view');
                Response::json([
                    'success' => true,
                    'data' => $this->service->list(
                        Request::query('branch_id'),
                        Request::query('status')
                    ),
                ]);
                return;
            }

            if ($method === 'GET' && $seg1 !== null) {
                Auth::requirePermission($user, 'employees.view');
                $row = $this->service->get($seg1);
                if (!$row) {
                    Response::error('Employee not found', 404);
                    return;
                }
                Response::json(['success' => true, 'data' => $row]);
                return;
            }

            if ($method === 'POST' && $seg1 === null) {
                Auth::requirePermission($user, 'employees.manage');
                $body = Request::jsonBody();
                if (empty($body['branch_id']) || empty($body['emp_number']) || empty($body['first_name']) || empty($body['last_name'])) {
                    Response::error('branch_id, emp_number, first_name, last_name required', 422);
                    return;
                }
                $this->service->validatePositionForBranch(
                    (string) $body['branch_id'],
                    $body['department_id'] ?? null,
                    $body['position_id'] ?? null
                );
                Response::json(['success' => true, 'data' => $this->service->create($body)], 201);
                return;
            }

            if ($method === 'PUT' && $seg1 !== null && $seg1 !== 'me') {
                Auth::requirePermission($user, 'employees.manage');
                $body = Request::jsonBody();
                $existing = $this->service->get($seg1);
                if (!$existing) {
                    Response::error('Employee not found', 404);
                    return;
                }
                $branchId = (string) ($body['branch_id'] ?? $existing['branch_id']);
                $this->service->validatePositionForBranch(
                    $branchId,
                    $body['department_id'] ?? $existing['department_id'] ?? null,
                    $body['position_id'] ?? $existing['position_id'] ?? null
                );
                $row = $this->service->update($seg1, $body);
                Response::json(['success' => true, 'data' => $row]);
                return;
            }

            if ($method === 'DELETE' && $seg1 !== null) {
                Auth::requirePermission($user, 'employees.manage');
                $this->service->delete($seg1);
                Response::json(['success' => true]);
                return;
            }

            Response::error('Method not allowed', 405);
        } catch (Throwable $e) {
            Response::error($e->getMessage(), 500);
        }
    }
}
