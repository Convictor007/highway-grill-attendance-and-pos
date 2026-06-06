<?php

declare(strict_types=1);

namespace Hg\Api\Modules\Overtime;

use Hg\Api\Core\Auth;
use Hg\Api\Core\Request;
use Hg\Api\Core\Response;
use Throwable;

final class OvertimeController
{
    public function __construct(private readonly OvertimeService $service = new OvertimeService()) {}

    public function handle(string $method, ?string $seg1, ?string $seg2): void
    {
        try {
            $user = Auth::requireUser();

            if ($method === 'GET' && ($seg1 === 'requests' || $seg1 === null)) {
                if (Auth::hasPermission($user, 'attendance.manage')) {
                    Response::json([
                        'success' => true,
                        'data' => $this->service->list(Request::query('employee_id')),
                    ]);
                    return;
                }
                Auth::requirePermission($user, 'overtime.apply');
                $eid = $user['employee_id'] ?? null;
                Response::json(['success' => true, 'data' => $this->service->list($eid)]);
                return;
            }

            if ($method === 'POST' && $seg1 === 'requests') {
                Auth::requirePermission($user, 'overtime.apply');
                $body = Request::jsonBody();
                $body['employee_id'] = $body['employee_id'] ?? $user['employee_id'];
                if (empty($body['employee_id']) || empty($body['request_date']) || empty($body['extra_hours'])) {
                    Response::error('request_date and extra_hours required', 422);
                    return;
                }
                Response::json(['success' => true, 'data' => $this->service->create($body)], 201);
                return;
            }

            if ($method === 'PUT' && $seg1 !== null && $seg2 === 'review') {
                Auth::requirePermission($user, 'attendance.manage');
                $body = Request::jsonBody();
                $row = $this->service->review($seg1, (string) ($body['status'] ?? ''), $user['id']);
                if (!$row) {
                    Response::error('Request not found or not pending', 404);
                    return;
                }
                Response::json(['success' => true, 'data' => $row]);
                return;
            }

            Response::error('Not found', 404);
        } catch (Throwable $e) {
            Response::error($e->getMessage(), 400);
        }
    }
}
