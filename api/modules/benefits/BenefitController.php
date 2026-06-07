<?php

declare(strict_types=1);

namespace Hg\Api\Modules\Benefits;

use Hg\Api\Core\Auth;
use Hg\Api\Core\Request;
use Hg\Api\Core\Response;
use Throwable;

final class BenefitController
{
    public function __construct(private readonly BenefitService $service = new BenefitService()) {}

    public function handle(string $method, ?string $id): void
    {
        try {
            $user = Auth::requireUser();

            if ($method === 'GET' && $id === null) {
                $eid = Request::query('employee_id');
                if (!$eid && Auth::hasPermission($user, 'payroll.view')) {
                    Response::json(['success' => true, 'data' => $this->service->list()]);
                    return;
                }
                if (!$eid) {
                    $eid = $user['employee_id'] ?? null;
                }
                if (!$eid) {
                    Response::error('employee_id required', 422);
                    return;
                }
                if (
                    !Auth::hasPermission($user, 'payroll.view')
                    && ($user['employee_id'] ?? '') !== $eid
                ) {
                    Response::error('Forbidden', 403);
                    return;
                }
                Response::json(['success' => true, 'data' => $this->service->list($eid)]);
                return;
            }

            if ($method === 'POST' && $id === null) {
                Auth::requirePermission($user, 'payroll.manage');
                $body = Request::jsonBody();
                if (empty($body['employee_id']) || empty($body['benefit_name'])) {
                    Response::error('employee_id and benefit_name required', 422);
                    return;
                }
                Response::json(['success' => true, 'data' => $this->service->create($body)], 201);
                return;
            }

            if ($method === 'PUT' && $id !== null) {
                Auth::requirePermission($user, 'payroll.manage');
                $row = $this->service->update($id, Request::jsonBody());
                if (!$row) {
                    Response::error('Enrollment not found', 404);
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
