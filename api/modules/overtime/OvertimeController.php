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
                Auth::requireActiveEmployeeAccount($user);
                $eid = $user['employee_id'] ?? null;
                Response::json(['success' => true, 'data' => $this->service->list($eid)]);
                return;
            }

            if ($method === 'POST' && $seg1 === 'requests') {
                if (!Auth::hasPermission($user, 'attendance.manage')) {
                    Response::error(
                        'Overtime is recorded automatically from your DTR when you work past your shift, 9 hours, or midnight.',
                        422
                    );
                    return;
                }
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
                Response::error(
                    'Overtime from DTR is approved automatically. Manual review is no longer required.',
                    410
                );
                return;
            }

            Response::error('Not found', 404);
        } catch (Throwable $e) {
            Response::error($e->getMessage(), 400);
        }
    }
}
