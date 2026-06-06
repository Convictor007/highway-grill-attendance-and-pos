<?php

declare(strict_types=1);

namespace Hg\Api\Modules\Payroll;

use Hg\Api\Core\AuditLog;
use Hg\Api\Core\Auth;
use Hg\Api\Core\Request;
use Hg\Api\Core\Response;
use Throwable;

final class PayrollController
{
    public function __construct(private readonly PayrollService $service = new PayrollService()) {}

    public function handle(string $method, ?string $id, ?string $seg2): void
    {
        try {
            $user = Auth::requireUser();

            if ($method === 'GET' && $id === 'runs' && $seg2 !== null) {
                Auth::requirePermission($user, 'payroll.view');
                $row = $this->service->getRun($seg2);
                if (!$row) {
                    Response::error('Payroll run not found', 404);
                    return;
                }
                Response::json(['success' => true, 'data' => $row]);
                return;
            }

            if ($method === 'GET' && ($id === 'runs' || $id === null)) {
                Auth::requirePermission($user, 'payroll.view');
                Response::json([
                    'success' => true,
                    'data' => $this->service->listRuns(Request::query('branch_id')),
                ]);
                return;
            }

            if ($method === 'GET' && $id !== null && $seg2 === null
                && !in_array($id, ['runs', 'payslips'], true)) {
                $run = $this->service->getRun($id);
                if ($run) {
                    Auth::requirePermission($user, 'payroll.view');
                    Response::json(['success' => true, 'data' => $run]);
                    return;
                }
                $row = $this->service->getPayslip($id);
                if (!$row) {
                    Response::error('Not found', 404);
                    return;
                }
                if (Auth::hasPermission($user, 'payroll.view')) {
                    Response::json(['success' => true, 'data' => $row]);
                    return;
                }
                if (
                    Auth::hasPermission($user, 'payroll.view.self')
                    && ($user['employee_id'] ?? null) === $row['employee_id']
                ) {
                    Response::json(['success' => true, 'data' => $row]);
                    return;
                }
                Response::error('Forbidden', 403);
                return;
            }

            if ($method === 'POST' && $seg2 === 'generate-payslips' && $id !== null && $id !== 'runs') {
                Auth::requirePermission($user, 'payroll.manage');
                $result = $this->service->generatePayslips($id);
                AuditLog::write($user['id'], 'create', 'payslips', $id, null, ['created' => $result['created']]);
                Response::json(['success' => true, 'data' => $result]);
                return;
            }

            if ($method === 'POST' && $id === 'runs') {
                Auth::requirePermission($user, 'payroll.manage');
                $body = Request::jsonBody();
                if (empty($body['branch_id']) || empty($body['period_start']) || empty($body['period_end']) || empty($body['pay_date'])) {
                    Response::error('branch_id, period_start, period_end, pay_date required', 422);
                    return;
                }
                $row = $this->service->createRun($body, $user['id']);
                AuditLog::write($user['id'], 'create', 'payroll_runs', $row['id'] ?? null, null, $row);
                Response::json(['success' => true, 'data' => $row], 201);
                return;
            }

            if ($method === 'PUT' && $id !== null && $id !== 'runs' && $id !== 'payslips') {
                Auth::requirePermission($user, 'payroll.manage');
                $row = $this->service->updateRun($id, Request::jsonBody());
                if (!$row) {
                    Response::error('Payroll run not found', 404);
                    return;
                }
                AuditLog::write($user['id'], 'update', 'payroll_runs', $id, null, $row);
                Response::json(['success' => true, 'data' => $row]);
                return;
            }

            if ($method === 'GET' && $id === 'my-payslips') {
                Auth::requirePermission($user, 'payroll.view.self');
                $eid = $user['employee_id'] ?? null;
                if (!$eid) {
                    Response::error('No employee linked', 422);
                    return;
                }
                Response::json(['success' => true, 'data' => $this->service->payslipsForEmployee($eid)]);
                return;
            }

            if ($method === 'GET' && $id === 'payslips') {
                Auth::requirePermission($user, 'payroll.view');
                Response::json([
                    'success' => true,
                    'data' => $this->service->payslips(Request::query('run_id')),
                ]);
                return;
            }

            Response::error('Not found', 404);
        } catch (Throwable $e) {
            Response::error($e->getMessage(), 500);
        }
    }
}
