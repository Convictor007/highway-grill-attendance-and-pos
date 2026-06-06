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

    public function handle(string $method, ?string $id): void
    {
        try {
            $user = Auth::requireUser();

            if ($method === 'GET' && $id === 'me') {
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

            if ($method === 'PUT' && $id === 'me') {
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

            if ($method === 'GET' && $id === null) {
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

            if ($method === 'GET' && $id !== null) {
                Auth::requirePermission($user, 'employees.view');
                $row = $this->service->get($id);
                if (!$row) {
                    Response::error('Employee not found', 404);
                    return;
                }
                Response::json(['success' => true, 'data' => $row]);
                return;
            }

            if ($method === 'POST' && $id === null) {
                Auth::requirePermission($user, 'employees.manage');
                $body = Request::jsonBody();
                if (empty($body['branch_id']) || empty($body['emp_number']) || empty($body['first_name']) || empty($body['last_name'])) {
                    Response::error('branch_id, emp_number, first_name, last_name required', 422);
                    return;
                }
                Response::json(['success' => true, 'data' => $this->service->create($body)], 201);
                return;
            }

            if ($method === 'PUT' && $id !== null) {
                Auth::requirePermission($user, 'employees.manage');
                $row = $this->service->update($id, Request::jsonBody());
                if (!$row) {
                    Response::error('Employee not found', 404);
                    return;
                }
                Response::json(['success' => true, 'data' => $row]);
                return;
            }

            if ($method === 'DELETE' && $id !== null) {
                Auth::requirePermission($user, 'employees.manage');
                $this->service->delete($id);
                Response::json(['success' => true]);
                return;
            }

            Response::error('Method not allowed', 405);
        } catch (Throwable $e) {
            Response::error($e->getMessage(), 500);
        }
    }
}
