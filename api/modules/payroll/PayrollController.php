<?php

declare(strict_types=1);

namespace Hg\Api\Modules\Payroll;

use Hg\Api\Core\AuditLog;
use Hg\Api\Core\Auth;
use Hg\Api\Core\Request;
use Hg\Api\Core\Response;
use Hg\Api\Modules\Payroll\PayrollPeriodHelper;
use Throwable;

final class PayrollController
{
    public function __construct(
        private readonly PayrollService $service = new PayrollService(),
        private readonly PayrollAdjustmentService $adjustments = new PayrollAdjustmentService(),
    ) {}

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
                $page = max(1, Request::queryInt('page', 1));
                $limit = max(1, min(100, Request::queryInt('limit', 25)));
                Response::json([
                    'success' => true,
                    'data' => $this->service->listRuns(
                        Request::query('branch_id'),
                        Request::query('status'),
                        trim((string) Request::query('q', '')),
                        $page,
                        $limit,
                    ),
                ]);
                return;
            }

            if ($method === 'GET' && $id === 'suggested-period') {
                Auth::requirePermission($user, 'payroll.view');
                $which = Request::query('which') === 'next' ? 'next' : 'current';
                Response::json([
                    'success' => true,
                    'data' => PayrollPeriodHelper::suggested($which),
                ]);
                return;
            }

            if ($method === 'GET' && $id === 'my-payslips') {
                Auth::requirePermission($user, 'payroll.view.self');
                Auth::requireActiveEmployeeAccount($user);
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
                $page = max(1, Request::queryInt('page', 1));
                $limit = max(1, min(100, Request::queryInt('limit', 25)));
                Response::json([
                    'success' => true,
                    'data' => $this->service->payslips(
                        Request::query('run_id'),
                        trim((string) Request::query('q', '')),
                        $page,
                        $limit,
                    ),
                ]);
                return;
            }

            if ($method === 'GET' && $id === 'run-roster') {
                Auth::requirePermission($user, 'payroll.view');
                $runId = Request::query('run_id');
                if (!$runId) {
                    Response::error('run_id required', 422);
                    return;
                }
                $page = max(1, Request::queryInt('page', 1));
                $limit = max(1, min(100, Request::queryInt('limit', 25)));
                Response::json([
                    'success' => true,
                    'data' => $this->service->runRoster(
                        (string) $runId,
                        trim((string) Request::query('q', '')),
                        $page,
                        $limit,
                    ),
                ]);
                return;
            }

            if ($method === 'GET' && $id === 'prepare') {
                Auth::requirePermission($user, 'payroll.view');
                $runId = Request::query('run_id');
                $employeeId = Request::query('employee_id');
                if (!$runId || !$employeeId) {
                    Response::error('run_id and employee_id required', 422);
                    return;
                }
                $includedParam = Request::query('included_dates');
                $attendanceEditMode = is_string($includedParam);
                $includedDates = null;
                if ($attendanceEditMode) {
                    $includedDates = $includedParam !== ''
                        ? array_values(array_filter(array_map('trim', explode(',', $includedParam))))
                        : [];
                }
                Response::json([
                    'success' => true,
                    'data' => $this->service->prepareEmployee(
                        (string) $runId,
                        (string) $employeeId,
                        $includedDates,
                        $attendanceEditMode
                    ),
                ]);
                return;
            }

            if ($method === 'GET' && $id === 'adjustments') {
                Auth::requirePermission($user, 'payroll.view');
                $recurring = Request::query('recurring');
                Response::json([
                    'success' => true,
                    'data' => $this->adjustments->list(
                        Request::query('employee_id'),
                        Request::query('run_id'),
                        $recurring === '1' || $recurring === 'true' ? true : null
                    ),
                ]);
                return;
            }

            if ($method === 'PUT' && $id === 'payslip' && $seg2 !== null) {
                Auth::requirePermission($user, 'payroll.manage');
                $row = $this->service->updatePayslip($seg2, Request::jsonBody());
                if (!$row) {
                    Response::error('Payslip not found', 404);
                    return;
                }
                AuditLog::write($user['id'], 'update', 'payslips', $seg2, null, $row);
                Response::json(['success' => true, 'data' => $row]);
                return;
            }

            if ($method === 'GET' && $id !== null && $seg2 === null
                && !in_array($id, ['runs', 'payslips', 'run-roster', 'prepare', 'suggested-period', 'my-payslips', 'adjustments'], true)) {
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
                $body = Request::jsonBody();
                $replace = !empty($body['replace']);
                $result = $this->service->generatePayslips($id, $replace);
                AuditLog::write($user['id'], 'create', 'payslips', $id, null, ['created' => $result['created'], 'replace' => $replace]);
                Response::json(['success' => true, 'data' => $result]);
                return;
            }

            if ($method === 'POST' && $seg2 === 'defer' && $id !== null && $id !== 'runs') {
                Auth::requirePermission($user, 'payroll.manage');
                $body = Request::jsonBody();
                $ids = $body['employee_ids'] ?? [];
                if (!is_array($ids) || $ids === []) {
                    Response::error('employee_ids required', 422);
                    return;
                }
                $result = $this->service->deferEmployees(
                    $id,
                    array_map('strval', $ids),
                    isset($body['note']) ? (string) $body['note'] : null,
                    $user['id']
                );
                AuditLog::write($user['id'], 'update', 'payroll_runs', $id, null, $result);
                Response::json(['success' => true, 'data' => $result]);
                return;
            }

            if ($method === 'POST' && $seg2 === 'undefer' && $id !== null && $id !== 'runs') {
                Auth::requirePermission($user, 'payroll.manage');
                $body = Request::jsonBody();
                $ids = $body['employee_ids'] ?? [];
                if (!is_array($ids) || $ids === []) {
                    Response::error('employee_ids required', 422);
                    return;
                }
                $result = $this->service->undeferEmployees($id, array_map('strval', $ids));
                AuditLog::write($user['id'], 'update', 'payroll_runs', $id, null, $result);
                Response::json(['success' => true, 'data' => $result]);
                return;
            }

            if ($method === 'POST' && $seg2 === 'pay-selected' && $id !== null && $id !== 'runs') {
                Auth::requirePermission($user, 'payroll.manage');
                $body = Request::jsonBody();
                $ids = $body['employee_ids'] ?? [];
                if (!is_array($ids) || $ids === []) {
                    Response::error('employee_ids required', 422);
                    return;
                }
                $result = $this->service->paySelectedEmployees(
                    $id,
                    array_map('strval', $ids),
                    !empty($body['send_payslips']),
                    $user['id']
                );
                AuditLog::write($user['id'], 'update', 'payroll_runs', $id, null, $result);
                Response::json(['success' => true, 'data' => $result]);
                return;
            }

            if ($method === 'POST' && $seg2 === 'generate-payslip' && $id !== null && $id !== 'runs') {
                Auth::requirePermission($user, 'payroll.manage');
                $body = Request::jsonBody();
                if (empty($body['employee_id'])) {
                    Response::error('employee_id required', 422);
                    return;
                }
                $result = $this->service->generatePayslipForEmployee($id, (string) $body['employee_id'], [
                    'included_dates' => $body['included_dates'] ?? null,
                    'overrides' => $body['overrides'] ?? [],
                ]);
                AuditLog::write($user['id'], 'create', 'payslip', $id, null, [
                    'employee_id' => $body['employee_id'],
                ]);
                Response::json(['success' => true, 'data' => $result]);
                return;
            }

            if ($method === 'POST' && $seg2 === 'send-payslips' && $id !== null && $id !== 'runs') {
                Auth::requirePermission($user, 'payroll.manage');
                $result = $this->service->sendRunPayslips($id, $user['id']);
                AuditLog::write($user['id'], 'send', 'payslips', $id, null, $result);
                Response::json(['success' => true, 'data' => $result]);
                return;
            }

            if ($method === 'POST' && $seg2 === 'send-payslip' && $id !== null && $id !== 'runs') {
                Auth::requirePermission($user, 'payroll.manage');
                $result = $this->service->sendPayslip($id, $user['id']);
                AuditLog::write($user['id'], 'send', 'payslip', $id, null, $result);
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
                $row = $this->service->updateRun($id, Request::jsonBody(), $user['id']);
                if (!$row) {
                    Response::error('Payroll run not found', 404);
                    return;
                }
                AuditLog::write($user['id'], 'update', 'payroll_runs', $id, null, $row);
                Response::json(['success' => true, 'data' => $row]);
                return;
            }

            if ($method === 'POST' && $id === 'adjustments') {
                Auth::requirePermission($user, 'payroll.manage');
                $body = Request::jsonBody();
                if (empty($body['employee_id']) || !isset($body['amount'])) {
                    Response::error('employee_id and amount required', 422);
                    return;
                }
                $row = $this->adjustments->create($body, $user['id']);
                AuditLog::write($user['id'], 'create', 'payroll_adjustments', $row['id'] ?? null, null, $row);
                Response::json(['success' => true, 'data' => $row], 201);
                return;
            }

            if ($method === 'DELETE' && $id === 'adjustments' && $seg2 !== null) {
                Auth::requirePermission($user, 'payroll.manage');
                if (!$this->adjustments->delete($seg2)) {
                    Response::error('Adjustment not found', 404);
                    return;
                }
                AuditLog::write($user['id'], 'delete', 'payroll_adjustments', $seg2);
                Response::json(['success' => true]);
                return;
            }

            Response::error('Not found', 404);
        } catch (Throwable $e) {
            Response::error($e->getMessage(), 500);
        }
    }
}
