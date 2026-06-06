<?php

declare(strict_types=1);

namespace Hg\Api\Modules\Loans;

use Hg\Api\Core\Auth;
use Hg\Api\Core\Request;
use Hg\Api\Core\Response;
use Throwable;

final class LoanController
{
    public function __construct(private readonly LoanService $service = new LoanService()) {}

    public function handle(string $method, ?string $seg1, ?string $seg2): void
    {
        try {
            $user = Auth::requireUser();

            if ($method === 'GET' && ($seg1 === null || $seg1 === 'list')) {
                if (Auth::hasPermission($user, 'loans.manage')) {
                    Response::json([
                        'success' => true,
                        'data' => $this->service->list(
                            Request::query('employee_id'),
                            Request::query('branch_id')
                        ),
                    ]);
                    return;
                }
                Auth::requirePermission($user, 'loans.self');
                $eid = $user['employee_id'] ?? null;
                if (!$eid) {
                    Response::error('No employee linked', 422);
                    return;
                }
                Response::json(['success' => true, 'data' => $this->service->list($eid)]);
                return;
            }

            if ($method === 'GET' && $seg1 !== null && $seg2 === 'payments') {
                if (!Auth::hasPermission($user, 'loans.self') && !Auth::hasPermission($user, 'loans.manage')) {
                    Response::error('Forbidden', 403);
                    return;
                }
                $loan = $this->service->get($seg1);
                if (!$loan) {
                    Response::error('Loan not found', 404);
                    return;
                }
                if (!Auth::hasPermission($user, 'loans.manage') && ($user['employee_id'] ?? '') !== $loan['employee_id']) {
                    Response::error('Forbidden', 403);
                    return;
                }
                Response::json(['success' => true, 'data' => $this->service->payments($seg1)]);
                return;
            }

            if ($method === 'POST' && ($seg1 === null || $seg1 === 'apply')) {
                Auth::requirePermission($user, 'loans.self');
                $body = Request::jsonBody();
                $body['employee_id'] = $body['employee_id'] ?? $user['employee_id'];
                if (empty($body['employee_id']) || empty($body['principal'])) {
                    Response::error('principal required', 422);
                    return;
                }
                if ((float) $body['principal'] <= 0) {
                    Response::error('principal must be positive', 422);
                    return;
                }
                Response::json(['success' => true, 'data' => $this->service->apply($body)], 201);
                return;
            }

            if ($method === 'POST' && $seg1 !== null && $seg2 === 'payments') {
                Auth::requirePermission($user, 'loans.manage');
                $body = Request::jsonBody();
                if (empty($body['amount'])) {
                    Response::error('amount required', 422);
                    return;
                }
                try {
                    $row = $this->service->recordPayment($seg1, $body);
                } catch (\InvalidArgumentException $e) {
                    Response::error($e->getMessage(), 422);
                    return;
                }
                if (!$row) {
                    Response::error('Loan not found or not active', 404);
                    return;
                }
                Response::json(['success' => true, 'data' => $row], 201);
                return;
            }

            if ($method === 'PUT' && $seg1 !== null && $seg2 === 'review') {
                Auth::requirePermission($user, 'loans.manage');
                $body = Request::jsonBody();
                $status = $body['status'] ?? '';
                $row = $this->service->review($seg1, $status, $user['id']);
                if (!$row) {
                    Response::error('Loan not found or not pending', 404);
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
