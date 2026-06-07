<?php

declare(strict_types=1);

namespace Hg\Api\Modules\Attendance;

use Hg\Api\Core\AuditLog;
use Hg\Api\Modules\Attendance\AttendanceAutoService;
use Hg\Api\Core\Auth;
use Hg\Api\Core\Request;
use Hg\Api\Core\Response;
use InvalidArgumentException;
use Throwable;

final class AttendanceController
{
    public function __construct(private readonly AttendanceService $service = new AttendanceService()) {}

    public function handle(string $method, ?string $action): void
    {
        try {
            $user = Auth::requireUser();

            if ($method === 'GET' && ($action === null || $action === 'list')) {
                $date = Request::query('date');
                $branchId = Request::query('branch_id');
                if (Auth::hasPermission($user, 'attendance.view')) {
                    Response::json([
                        'success' => true,
                        'data' => $this->service->list($date, $branchId, Request::query('employee_id')),
                    ]);
                    return;
                }
                if (Auth::hasPermission($user, 'attendance.self') && !empty($user['employee_id'])) {
                    Auth::requireActiveEmployeeAccount($user);
                    Response::json([
                        'success' => true,
                        'data' => $this->service->list($date, null, $user['employee_id']),
                    ]);
                    return;
                }
                Response::error('Forbidden', 403);
                return;
            }

            if ($method === 'GET' && $action === 'statistics') {
                Auth::requirePermission($user, 'attendance.view');
                $from = Request::query('from') ?? date('Y-m-01');
                $to = Request::query('to') ?? date('Y-m-d');
                Response::json([
                    'success' => true,
                    'data' => $this->service->statistics(Request::query('branch_id'), $from, $to),
                ]);
                return;
            }

            if ($method === 'GET' && $action === 'scheduled-shift') {
                Auth::requirePermission($user, 'attendance.manage');
                $employeeId = Request::query('employee_id');
                $date = Request::query('date');
                if (!$employeeId || !$date) {
                    Response::error('employee_id and date required', 422);
                    return;
                }
                Response::json([
                    'success' => true,
                    'data' => $this->service->scheduledShiftForEmployee($employeeId, $date),
                ]);
                return;
            }

            if ($method === 'GET' && $action === 'summary') {
                Auth::requirePermission($user, 'attendance.self');
                Auth::requireActiveEmployeeAccount($user);
                $eid = $user['employee_id'] ?? null;
                if (!$eid) {
                    Response::error('No employee linked', 422);
                    return;
                }
                $from = Request::query('from') ?? date('Y-m-d', strtotime('monday this week'));
                $to = Request::query('to') ?? date('Y-m-d');
                Response::json([
                    'success' => true,
                    'data' => $this->service->hoursSummary($eid, $from, $to),
                ]);
                return;
            }

            if ($method === 'GET' && $action === 'status') {
                Auth::requirePermission($user, 'attendance.self');
                Auth::requireActiveEmployeeAccount($user);
                $employeeId = $user['employee_id'] ?? null;
                if (!$employeeId) {
                    Response::json(['success' => true, 'data' => ['open' => false]]);
                    return;
                }
                $open = $this->service->openSession($employeeId);
                $onBreak = $open && !empty($open['break_start']) && empty($open['break_end']);
                $policy = $this->service->clockPolicyForEmployee($employeeId);
                $auto = new AttendanceAutoService();
                Response::json([
                    'success' => true,
                    'data' => [
                        'open' => $open !== null,
                        'on_break' => $onBreak,
                        'session' => $open,
                        'geofence_required' => $policy['geofence_required'],
                        'mobile_clock' => $policy['mobile_clock'] ?? false,
                        'position_label' => $policy['position_label'] ?? null,
                        'shift' => $open ? $auto->shiftContextForEmployee($employeeId) : null,
                    ],
                ]);
                return;
            }

            if ($method === 'POST' && $action === 'break-start') {
                Auth::requirePermission($user, 'attendance.self');
                Auth::requireActiveEmployeeAccount($user);
                $eid = $user['employee_id'] ?? null;
                if (!$eid) {
                    Response::error('No employee linked', 422);
                    return;
                }
                Response::json(['success' => true, 'data' => $this->service->breakStart($eid)]);
                return;
            }

            if ($method === 'POST' && $action === 'break-end') {
                Auth::requirePermission($user, 'attendance.self');
                Auth::requireActiveEmployeeAccount($user);
                $eid = $user['employee_id'] ?? null;
                if (!$eid) {
                    Response::error('No employee linked', 422);
                    return;
                }
                Response::json(['success' => true, 'data' => $this->service->breakEnd($eid)]);
                return;
            }

            if ($method === 'GET' && $action !== null && !in_array($action, ['list', 'status', 'summary', 'statistics', 'scheduled-shift'], true)) {
                Auth::requirePermission($user, 'attendance.view');
                $row = $this->service->get($action);
                if (!$row) {
                    Response::error('Record not found', 404);
                    return;
                }
                Response::json(['success' => true, 'data' => $row]);
                return;
            }

            if ($method === 'POST' && $action === 'clock-in') {
                Auth::requirePermission($user, 'attendance.self');
                Auth::requireActiveEmployeeAccount($user);
                $body = Request::jsonBody();
                $employeeId = $user['employee_id'] ?? $body['employee_id'] ?? null;
                if (!$employeeId) {
                    Response::error('No employee linked to user', 422);
                    return;
                }
                $coords = self::optionalCoords($body);
                $accuracy = self::optionalAccuracy($body);
                $address = isset($body['address']) ? trim((string) $body['address']) : null;
                Response::json([
                    'success' => true,
                    'data' => $this->service->clockIn(
                        $employeeId,
                        'app',
                        $coords[0],
                        $coords[1],
                        $address ?: null,
                        $accuracy
                    ),
                ]);
                return;
            }

            if ($method === 'POST' && $action === 'clock-out') {
                Auth::requirePermission($user, 'attendance.self');
                Auth::requireActiveEmployeeAccount($user);
                $body = Request::jsonBody();
                $employeeId = $user['employee_id'] ?? $body['employee_id'] ?? null;
                if (!$employeeId) {
                    Response::error('No employee linked to user', 422);
                    return;
                }
                $coords = self::optionalCoords($body);
                $address = isset($body['address']) ? trim((string) $body['address']) : null;
                Response::json([
                    'success' => true,
                    'data' => $this->service->clockOut($employeeId, $coords[0], $coords[1], $address ?: null),
                ]);
                return;
            }

            if ($method === 'POST' && $action === 'vicinity-ping') {
                Auth::requirePermission($user, 'attendance.self');
                Auth::requireActiveEmployeeAccount($user);
                $employeeId = $user['employee_id'] ?? null;
                if (!$employeeId) {
                    Response::error('No employee linked', 422);
                    return;
                }
                $body = Request::jsonBody();
                $coords = self::optionalCoords($body);
                if ($coords[0] === null || $coords[1] === null) {
                    Response::error('latitude and longitude required', 422);
                    return;
                }
                $accuracy = self::optionalAccuracy($body);
                $auto = new AttendanceAutoService();
                Response::json([
                    'success' => true,
                    'data' => $auto->vicinityPing($employeeId, $coords[0], $coords[1], $accuracy),
                ]);
                return;
            }

            if ($method === 'POST' && $action === 'manual') {
                Auth::requirePermission($user, 'attendance.manage');
                $body = Request::jsonBody();
                if (empty($body['employee_id'])) {
                    Response::error('employee_id required', 422);
                    return;
                }
                $row = $this->service->manualEntry($body, $user['id']);
                AuditLog::write($user['id'], 'create', 'attendance', $row['id'] ?? null, null, $row);
                Response::json(['success' => true, 'data' => $row], 201);
                return;
            }

            if ($method === 'PUT' && $action !== null) {
                Auth::requirePermission($user, 'attendance.manage');
                $row = $this->service->update($action, Request::jsonBody(), $user['id']);
                if (!$row) {
                    Response::error('Record not found', 404);
                    return;
                }
                AuditLog::write($user['id'], 'update', 'attendance', $action, null, $row);
                Response::json(['success' => true, 'data' => $row]);
                return;
            }

            Response::error('Not found', 404);
        } catch (InvalidArgumentException $e) {
            Response::error($e->getMessage(), 422);
        } catch (Throwable $e) {
            Response::error($e->getMessage(), 400);
        }
    }

    /** @return array{0: ?float, 1: ?float} */
    private static function optionalCoords(array $body): array
    {
        if (!isset($body['latitude'], $body['longitude'])) {
            return [null, null];
        }
        $lat = (float) $body['latitude'];
        $lng = (float) $body['longitude'];
        if ($lat < -90 || $lat > 90 || $lng < -180 || $lng > 180) {
            throw new \InvalidArgumentException('Invalid coordinates');
        }
        return [$lat, $lng];
    }

    private static function optionalAccuracy(array $body): ?float
    {
        if (!isset($body['accuracy_m']) && !isset($body['accuracy'])) {
            return null;
        }
        $raw = $body['accuracy_m'] ?? $body['accuracy'];
        if ($raw === null || $raw === '') {
            return null;
        }
        $accuracy = (float) $raw;
        if ($accuracy <= 0 || $accuracy > 500) {
            return null;
        }

        return $accuracy;
    }
}
