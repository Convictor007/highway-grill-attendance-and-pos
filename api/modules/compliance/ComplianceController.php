<?php

declare(strict_types=1);

namespace Hg\Api\Modules\Compliance;

use Hg\Api\Core\AuditLog;
use Hg\Api\Core\Auth;
use Hg\Api\Core\Request;
use Hg\Api\Core\Response;
use Throwable;

final class ComplianceController
{
    public function __construct(private readonly ComplianceService $service = new ComplianceService()) {}

    public function handle(string $method, ?string $seg1, ?string $seg2): void
    {
        try {
            $user = Auth::requireUser();
            Auth::requirePermission($user, 'compliance.view');

            if ($method === 'GET' && $seg1 === 'checklists') {
                Response::json(['success' => true, 'data' => $this->service->checklists()]);
                return;
            }

            if ($method === 'GET' && $seg1 === 'logs') {
                Response::json([
                    'success' => true,
                    'data' => $this->service->logs(
                        Request::query('branch_id'),
                        Request::query('limit') ? (int) Request::query('limit') : 50
                    ),
                ]);
                return;
            }

            if ($method === 'GET' && $seg1 === 'audit') {
                Response::json([
                    'success' => true,
                    'data' => $this->service->auditLogs(
                        Request::query('limit') ? (int) Request::query('limit') : 100
                    ),
                ]);
                return;
            }

            if ($method === 'POST' && $seg1 === 'checklists' && $seg2 === null) {
                $body = Request::jsonBody();
                try {
                    $row = $this->service->createChecklist($body);
                } catch (\InvalidArgumentException $e) {
                    Response::error($e->getMessage(), 422);
                    return;
                }
                AuditLog::write($user['id'], 'create', 'compliance_checklists', $row['id'] ?? null, null, $row);
                Response::json(['success' => true, 'data' => $row], 201);
                return;
            }

            if ($method === 'PUT' && $seg1 === 'checklists' && $seg2 !== null) {
                $row = $this->service->updateChecklist($seg2, Request::jsonBody());
                if (!$row) {
                    Response::error('Checklist not found', 404);
                    return;
                }
                AuditLog::write($user['id'], 'update', 'compliance_checklists', $seg2, null, $row);
                Response::json(['success' => true, 'data' => $row]);
                return;
            }

            if ($method === 'DELETE' && $seg1 === 'checklists' && $seg2 !== null) {
                if (!$this->service->deleteChecklist($seg2)) {
                    Response::error('Checklist not found', 404);
                    return;
                }
                AuditLog::write($user['id'], 'delete', 'compliance_checklists', $seg2, null, null);
                Response::json(['success' => true]);
                return;
            }

            if ($method === 'POST' && $seg1 === 'logs') {
                $body = Request::jsonBody();
                if (empty($body['checklist_id']) || empty($body['branch_id']) || empty($body['status'])) {
                    Response::error('checklist_id, branch_id, status required', 422);
                    return;
                }
                if (!in_array($body['status'], ['compliant', 'non_compliant', 'needs_action'], true)) {
                    Response::error('Invalid status', 422);
                    return;
                }
                $row = $this->service->createLog($body, $user['employee_id'] ?? null);
                AuditLog::write($user['id'], 'create', 'compliance_logs', $row['id'] ?? null, null, $row);
                Response::json(['success' => true, 'data' => $row], 201);
                return;
            }

            Response::error('Not found', 404);
        } catch (Throwable $e) {
            Response::error($e->getMessage(), 500);
        }
    }
}
