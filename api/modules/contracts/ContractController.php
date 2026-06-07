<?php

declare(strict_types=1);

namespace Hg\Api\Modules\Contracts;

use Hg\Api\Core\Auth;
use Hg\Api\Core\Request;
use Hg\Api\Core\Response;
use Throwable;

final class ContractController
{
    public function __construct(private readonly ContractService $service = new ContractService()) {}

    public function handle(string $method, ?string $seg1, ?string $seg2): void
    {
        try {
            $user = Auth::requireUser();

            if ($method === 'GET' && $seg1 === 'service-record' && $seg2 !== null) {
                if (!Auth::hasPermission($user, 'employees.view') && ($user['employee_id'] ?? '') !== $seg2) {
                    Auth::requirePermission($user, 'documents.view.self');
                    if (($user['employee_id'] ?? '') !== $seg2) {
                        Response::error('Forbidden', 403);
                        return;
                    }
                }
                Response::json(['success' => true, 'data' => $this->service->serviceRecord($seg2)]);
                return;
            }

            if ($method === 'GET' && $seg1 === 'contracts' && $seg2 !== null) {
                Auth::requirePermission($user, 'employees.view');
                Response::json(['success' => true, 'data' => $this->service->contractsForEmployee($seg2)]);
                return;
            }

            if ($method === 'POST' && $seg1 === 'contracts') {
                Auth::requirePermission($user, 'employees.manage');
                $body = Request::jsonBody();
                if (empty($body['employee_id']) || empty($body['start_date'])) {
                    Response::error('employee_id and start_date required', 422);
                    return;
                }
                Response::json(['success' => true, 'data' => $this->service->createContract($body)], 201);
                return;
            }

            if ($method === 'DELETE' && $seg1 === 'contracts' && $seg2 !== null) {
                Auth::requirePermission($user, 'employees.manage');
                if (!$this->service->deleteContract($seg2)) {
                    Response::error('Contract not found', 404);
                    return;
                }
                Response::json(['success' => true]);
                return;
            }

            if ($method === 'POST' && $seg1 === 'bank-accounts') {
                Auth::requirePermission($user, 'employees.manage');
                $body = Request::jsonBody();
                if (empty($body['employee_id']) || empty($body['bank_name']) || empty($body['account_no'])) {
                    Response::error('employee_id, bank_name, account_no required', 422);
                    return;
                }
                Response::json(['success' => true, 'data' => $this->service->createBankAccount($body)], 201);
                return;
            }

            Response::error('Not found', 404);
        } catch (Throwable $e) {
            Response::error($e->getMessage(), 500);
        }
    }
}
