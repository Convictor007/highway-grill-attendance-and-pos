<?php

declare(strict_types=1);

namespace Hg\Api\Modules\Holidays;

use Hg\Api\Core\Auth;
use Hg\Api\Core\Request;
use Hg\Api\Core\Response;
use Throwable;

final class HolidayController
{
    public function __construct(private readonly HolidayService $service = new HolidayService()) {}

    public function handle(string $method, ?string $id): void
    {
        try {
            $user = Auth::requireUser();

            if ($method === 'GET' && $id === null) {
                Auth::requirePermission($user, 'payroll.view');
                $year = Request::query('year') ? (int) Request::query('year') : null;
                Response::json([
                    'success' => true,
                    'data' => $this->service->list(Request::query('branch_id'), $year),
                ]);
                return;
            }

            if ($method === 'GET' && $id !== null) {
                Auth::requirePermission($user, 'payroll.view');
                $row = $this->service->get($id);
                if (!$row) {
                    Response::error('Holiday not found', 404);
                    return;
                }
                Response::json(['success' => true, 'data' => $row]);
                return;
            }

            if ($method === 'POST' && $id === null) {
                Auth::requirePermission($user, 'payroll.manage');
                $body = Request::jsonBody();
                if (empty($body['holiday_date']) || empty($body['name'])) {
                    Response::error('holiday_date and name required', 422);
                    return;
                }
                Response::json(['success' => true, 'data' => $this->service->create($body)], 201);
                return;
            }

            if ($method === 'PUT' && $id !== null) {
                Auth::requirePermission($user, 'payroll.manage');
                $row = $this->service->update($id, Request::jsonBody());
                if (!$row) {
                    Response::error('Holiday not found', 404);
                    return;
                }
                Response::json(['success' => true, 'data' => $row]);
                return;
            }

            if ($method === 'DELETE' && $id !== null) {
                Auth::requirePermission($user, 'payroll.manage');
                if (!$this->service->delete($id)) {
                    Response::error('Holiday not found', 404);
                    return;
                }
                Response::json(['success' => true]);
                return;
            }

            Response::error('Not found', 404);
        } catch (Throwable $e) {
            Response::error($e->getMessage(), 500);
        }
    }
}
