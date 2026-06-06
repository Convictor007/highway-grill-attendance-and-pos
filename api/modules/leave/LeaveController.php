<?php

declare(strict_types=1);

namespace Hg\Api\Modules\Leave;

use Hg\Api\Core\Auth;
use Hg\Api\Core\Request;
use Hg\Api\Core\Response;
use Throwable;

final class LeaveController
{
    public function __construct(private readonly LeaveService $service = new LeaveService()) {}

    public function handle(string $method, ?string $id, ?string $action): void
    {
        try {
            $user = Auth::requireUser();

            if ($method === 'GET' && $id === 'types') {
                Auth::requirePermission($user, 'leave.view');
                Response::json(['success' => true, 'data' => $this->service->types()]);
                return;
            }

            if ($method === 'POST' && $id === 'types') {
                Auth::requirePermission($user, 'leave.manage');
                $body = Request::jsonBody();
                if (empty($body['name'])) {
                    Response::error('name required', 422);
                    return;
                }
                Response::json(['success' => true, 'data' => $this->service->createType($body)], 201);
                return;
            }

            if ($method === 'PUT' && $action === null && $id !== null && $id !== 'types'
                && $id !== 'balances' && $id !== 'requests') {
                Auth::requirePermission($user, 'leave.manage');
                $type = $this->service->updateType($id, Request::jsonBody());
                if (!$type) {
                    Response::error('Leave type not found', 404);
                    return;
                }
                Response::json(['success' => true, 'data' => $type]);
                return;
            }

            if ($method === 'GET' && $id === 'balances') {
                Auth::requirePermission($user, 'leave.view');
                $eid = Request::query('employee_id');
                if (!$eid && !Auth::hasPermission($user, 'leave.approve')) {
                    $eid = $user['employee_id'] ?? null;
                }
                $year = Request::query('year') ? (int) Request::query('year') : null;
                Response::json(['success' => true, 'data' => $this->service->balances($eid, $year)]);
                return;
            }

            if ($method === 'GET' && ($id === 'requests' || $id === null)) {
                Auth::requirePermission($user, 'leave.view');
                $eid = Auth::hasPermission($user, 'leave.approve') ? Request::query('employee_id') : ($user['employee_id'] ?? null);
                Response::json([
                    'success' => true,
                    'data' => $this->service->requests($eid, Request::query('status')),
                ]);
                return;
            }

            if ($method === 'POST' && $id === 'requests') {
                Auth::requirePermission($user, 'leave.apply');
                $body = Request::jsonBody();
                $body['employee_id'] = $body['employee_id'] ?? $user['employee_id'];
                if (empty($body['employee_id']) || empty($body['leave_type_id']) || empty($body['start_date']) || empty($body['end_date'])) {
                    Response::error('Missing required fields', 422);
                    return;
                }
                if (!isset($body['days_count'])) {
                    $start = new \DateTime($body['start_date']);
                    $end = new \DateTime($body['end_date']);
                    $body['days_count'] = $start->diff($end)->days + 1;
                }
                Response::json(['success' => true, 'data' => $this->service->createRequest($body)], 201);
                return;
            }

            if ($method === 'PUT' && $id !== null && $action === 'cancel'
                && !in_array($id, ['types', 'balances', 'requests'], true)) {
                Auth::requirePermission($user, 'leave.apply');
                $eid = $user['employee_id'] ?? null;
                if (!$eid) {
                    Response::error('No employee linked', 422);
                    return;
                }
                try {
                    $row = $this->service->cancelRequest($id, $eid);
                } catch (\RuntimeException $e) {
                    Response::error($e->getMessage(), 400);
                    return;
                }
                if (!$row) {
                    Response::error('Request not found', 404);
                    return;
                }
                Response::json(['success' => true, 'data' => $row]);
                return;
            }

            if ($method === 'PUT' && $id !== null && $action === 'review'
                && !in_array($id, ['types', 'balances', 'requests'], true)) {
                Auth::requirePermission($user, 'leave.approve');
                $body = Request::jsonBody();
                $status = (string) ($body['status'] ?? '');
                $row = $this->service->review($id, $status, $user['id'], $body['notes'] ?? null);
                if (!$row) {
                    Response::error('Request not found', 404);
                    return;
                }
                Response::json(['success' => true, 'data' => $row]);
                return;
            }

            Response::error('Not found', 404);
        } catch (Throwable $e) {
            Response::error($e->getMessage(), 500);
        }
    }
}
