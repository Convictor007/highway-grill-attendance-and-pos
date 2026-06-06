<?php

declare(strict_types=1);

namespace Hg\Api\Modules\Documents;

use Hg\Api\Core\AuditLog;
use Hg\Api\Core\Auth;
use Hg\Api\Core\Request;
use Hg\Api\Core\Response;
use Throwable;

final class DocumentController
{
    public function __construct(private readonly DocumentService $service = new DocumentService()) {}

    public function handle(string $method, ?string $id): void
    {
        try {
            $user = Auth::requireUser();

            if ($method === 'GET' && $id === null) {
                $employeeId = Request::query('employee_id');
                if ($employeeId && Auth::hasPermission($user, 'employees.manage')) {
                    Response::json(['success' => true, 'data' => $this->service->forEmployeeHr($employeeId)]);
                    return;
                }

                Auth::requirePermission($user, 'documents.view.self');
                $eid = $user['employee_id'] ?? null;
                if (!$eid) {
                    Response::error('No employee linked', 422);
                    return;
                }
                Response::json(['success' => true, 'data' => $this->service->forEmployee($eid)]);
                return;
            }

            if ($method === 'POST' && $id === 'upload') {
                Auth::requirePermission($user, 'employees.manage');
                $row = $this->service->upload($_POST, $_FILES['file'] ?? [], $user['id']);
                AuditLog::write($user['id'], 'create', 'documents', $row['id'] ?? null, null, $row);
                Response::json(['success' => true, 'data' => $row], 201);
                return;
            }

            if ($method === 'POST' && $id === null) {
                Auth::requirePermission($user, 'employees.manage');
                $row = $this->service->create(Request::jsonBody(), $user['id']);
                AuditLog::write($user['id'], 'create', 'documents', $row['id'] ?? null, null, $row);
                Response::json(['success' => true, 'data' => $row], 201);
                return;
            }

            if ($method === 'DELETE' && $id !== null && $id !== 'upload') {
                Auth::requirePermission($user, 'employees.manage');
                if (!$this->service->delete($id)) {
                    Response::error('Document not found', 404);
                    return;
                }
                AuditLog::write($user['id'], 'delete', 'documents', $id, null, null);
                Response::json(['success' => true]);
                return;
            }

            Response::error('Not found', 404);
        } catch (\InvalidArgumentException $e) {
            Response::error($e->getMessage(), 422);
        } catch (Throwable $e) {
            Response::error($e->getMessage(), 500);
        }
    }
}