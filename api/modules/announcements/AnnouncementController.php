<?php

declare(strict_types=1);

namespace Hg\Api\Modules\Announcements;

use Hg\Api\Core\AuditLog;
use Hg\Api\Core\Auth;
use Hg\Api\Core\Database;
use Hg\Api\Core\Request;
use Hg\Api\Core\Response;
use Throwable;

final class AnnouncementController
{
    public function __construct(private readonly AnnouncementService $service = new AnnouncementService()) {}

    public function handle(string $method, ?string $id): void
    {
        try {
            $user = Auth::requireUser();

            if ($method === 'GET' && $id === null) {
                if (
                    !Auth::hasPermission($user, 'announcements.view')
                    && !Auth::hasPermission($user, 'employees.manage')
                ) {
                    Response::error('Forbidden', 403);
                    return;
                }
                if (Auth::hasPermission($user, 'employees.manage')) {
                    Response::json(['success' => true, 'data' => $this->service->listAll()]);
                    return;
                }

                $branchId = Request::query('branch_id');
                if (!$branchId && !empty($user['employee_id'])) {
                    $stmt = Database::connection()->prepare('SELECT branch_id FROM employees WHERE id = :id');
                    $stmt->execute(['id' => $user['employee_id']]);
                    $emp = $stmt->fetch();
                    $branchId = $emp['branch_id'] ?? null;
                }

                Response::json(['success' => true, 'data' => $this->service->forBranch($branchId)]);
                return;
            }

            if ($method === 'POST' && $id === null) {
                Auth::requirePermission($user, 'employees.manage');
                $body = Request::jsonBody();
                if (empty($body['title']) || empty($body['body'])) {
                    Response::error('title and body required', 422);
                    return;
                }
                $row = $this->service->create($body, $user['id']);
                AuditLog::write($user['id'], 'create', 'announcements', $row['id'] ?? null, null, $row);
                Response::json(['success' => true, 'data' => $row], 201);
                return;
            }

            if ($method === 'PUT' && $id !== null) {
                Auth::requirePermission($user, 'employees.manage');
                $body = Request::jsonBody();
                if (empty($body['title']) || empty($body['body'])) {
                    Response::error('title and body required', 422);
                    return;
                }
                $row = $this->service->update($id, $body);
                if (!$row) {
                    Response::error('Announcement not found', 404);
                    return;
                }
                AuditLog::write($user['id'], 'update', 'announcements', $id, null, $row);
                Response::json(['success' => true, 'data' => $row]);
                return;
            }

            if ($method === 'DELETE' && $id !== null) {
                Auth::requirePermission($user, 'employees.manage');
                $existing = $this->service->get($id);
                if (!$existing) {
                    Response::error('Announcement not found', 404);
                    return;
                }
                $this->service->delete($id);
                AuditLog::write($user['id'], 'delete', 'announcements', $id, $existing, null);
                Response::json(['success' => true, 'data' => ['deleted' => true]]);
                return;
            }

            Response::error('Not found', 404);
        } catch (Throwable $e) {
            Response::error($e->getMessage(), 500);
        }
    }
}
