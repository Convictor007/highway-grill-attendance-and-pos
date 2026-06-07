<?php

declare(strict_types=1);

namespace Hg\Api\Modules\Shifts;

use Hg\Api\Core\Auth;
use Hg\Api\Core\Database;
use Hg\Api\Core\Request;
use Hg\Api\Core\Response;
use Throwable;

final class ShiftController
{
    public function __construct(
        private readonly ShiftService $service = new ShiftService(),
        private readonly ShiftSwapService $swapService = new ShiftSwapService(),
    ) {}

    public function handle(string $method, ?string $seg1, ?string $seg2): void
    {
        try {
            $user = Auth::requireUser();

            if ($seg1 === 'swaps' && $method === 'GET' && $seg2 === null) {
                if (Auth::hasPermission($user, 'shifts.manage')) {
                    Response::json(['success' => true, 'data' => $this->swapService->list(null, true)]);
                    return;
                }
                Auth::requirePermission($user, 'shifts.view.self');
                $eid = $user['employee_id'] ?? null;
                if (!$eid) {
                    Response::error('No employee linked', 422);
                    return;
                }
                Response::json(['success' => true, 'data' => $this->swapService->list($eid, false)]);
                return;
            }

            if ($seg1 === 'swaps' && $method === 'POST' && $seg2 === null) {
                Auth::requirePermission($user, 'shifts.view.self');
                $eid = $user['employee_id'] ?? null;
                if (!$eid) {
                    Response::error('No employee linked', 422);
                    return;
                }
                Response::json([
                    'success' => true,
                    'data' => $this->swapService->create(Request::jsonBody(), $user['id'], $eid),
                ], 201);
                return;
            }

            if ($seg1 === 'swaps' && $method === 'PUT' && $seg2 !== null) {
                Auth::requirePermission($user, 'shifts.view.self');
                $eid = $user['employee_id'] ?? null;
                if (!$eid) {
                    Response::error('No employee linked', 422);
                    return;
                }
                $body = Request::jsonBody();
                $action = (string) ($body['action'] ?? '');

                if ($action === 'cancel') {
                    if (!$this->swapService->cancel($seg2, $eid)) {
                        Response::error('Swap request not found', 404);
                        return;
                    }
                    Response::json(['success' => true, 'data' => ['cancelled' => true]]);
                    return;
                }

                if (in_array($action, ['accept', 'reject'], true)) {
                    $row = $this->swapService->respond($seg2, $action, $user['id'], $eid);
                    if (!$row) {
                        Response::error('Swap request not found', 404);
                        return;
                    }
                    Response::json(['success' => true, 'data' => $row]);
                    return;
                }

                Response::error('action must be accept, reject, or cancel', 422);
                return;
            }

            if ($seg1 === 'coworkers' && $method === 'GET') {
                Auth::requirePermission($user, 'shifts.view.self');
                $eid = $user['employee_id'] ?? null;
                if (!$eid) {
                    Response::error('No employee linked', 422);
                    return;
                }
                Response::json(['success' => true, 'data' => $this->service->coworkers($eid)]);
                return;
            }

            if ($seg1 === 'roster' && $method === 'GET') {
                $branchId = Request::query('branch_id');
                if (Auth::hasPermission($user, 'shifts.manage')) {
                    if (!$branchId) {
                        Response::error('branch_id required', 422);
                        return;
                    }
                } elseif (Auth::hasPermission($user, 'shifts.view.self')) {
                    $eid = $user['employee_id'] ?? null;
                    if (!$eid) {
                        Response::error('No employee linked', 422);
                        return;
                    }
                    $stmt = Database::connection()->prepare(
                        'SELECT branch_id FROM employees WHERE id = :id LIMIT 1'
                    );
                    $stmt->execute(['id' => $eid]);
                    $emp = $stmt->fetch();
                    $branchId = $emp['branch_id'] ?? null;
                    if (!$branchId) {
                        Response::error('Employee branch not set', 422);
                        return;
                    }
                } else {
                    Response::error('Forbidden', 403);
                    return;
                }

                Response::json([
                    'success' => true,
                    'data' => $this->service->rosterGrid(
                        is_string($branchId) ? $branchId : null,
                        Request::query('week_start')
                    ),
                ]);
                return;
            }

            if ($seg1 === 'my' && $method === 'GET') {
                Auth::requirePermission($user, 'shifts.view.self');
                $eid = $user['employee_id'] ?? null;
                if (!$eid) {
                    Response::error('No employee linked', 422);
                    return;
                }
                Response::json([
                    'success' => true,
                    'data' => $this->service->myShifts(
                        $eid,
                        Request::query('from'),
                        Request::query('to')
                    ),
                ]);
                return;
            }

            if ($seg1 === 'templates' && $method === 'GET') {
                Auth::requirePermission($user, 'shifts.manage');
                Response::json([
                    'success' => true,
                    'data' => $this->service->templates(Request::query('branch_id')),
                ]);
                return;
            }

            if ($seg1 === 'templates' && $method === 'POST') {
                Auth::requirePermission($user, 'shifts.manage');
                $body = Request::jsonBody();
                if (empty($body['branch_id']) || empty($body['name']) || empty($body['start_time']) || empty($body['end_time'])) {
                    Response::error('branch_id, name, start_time, end_time required', 422);
                    return;
                }
                Response::json(['success' => true, 'data' => $this->service->createTemplate($body)], 201);
                return;
            }

            if ($seg1 === 'templates' && $method === 'PUT' && $seg2 !== null) {
                Auth::requirePermission($user, 'shifts.manage');
                $row = $this->service->updateTemplate($seg2, Request::jsonBody());
                if (!$row) {
                    Response::error('Shift template not found', 404);
                    return;
                }
                Response::json(['success' => true, 'data' => $row]);
                return;
            }

            if ($seg1 === 'schedules' && $method === 'GET' && $seg2 === null) {
                Auth::requirePermission($user, 'shifts.manage');
                Response::json([
                    'success' => true,
                    'data' => $this->service->schedules(Request::query('branch_id')),
                ]);
                return;
            }

            if ($seg1 === 'schedules' && $method === 'POST' && $seg2 === null) {
                Auth::requirePermission($user, 'shifts.manage');
                $body = Request::jsonBody();
                Response::json([
                    'success' => true,
                    'data' => $this->service->createSchedule($body, $user['id']),
                ], 201);
                return;
            }

            if ($seg1 === 'schedules' && $method === 'PUT' && $seg2 !== null) {
                Auth::requirePermission($user, 'shifts.manage');
                $row = $this->service->updateSchedule($seg2, Request::jsonBody(), $user['id']);
                if (!$row) {
                    Response::error('Schedule not found', 404);
                    return;
                }
                Response::json(['success' => true, 'data' => $row]);
                return;
            }

            if ($seg1 === 'assignments' && $method === 'GET') {
                Auth::requirePermission($user, 'shifts.manage');
                Response::json([
                    'success' => true,
                    'data' => $this->service->assignments(Request::query('schedule_id')),
                ]);
                return;
            }

            if ($seg1 === 'assignments' && $method === 'POST') {
                Auth::requirePermission($user, 'shifts.manage');
                Response::json([
                    'success' => true,
                    'data' => $this->service->addAssignment(Request::jsonBody()),
                ], 201);
                return;
            }

            if ($seg1 === 'assignments' && $method === 'PUT' && $seg2 !== null) {
                Auth::requirePermission($user, 'shifts.manage');
                $row = $this->service->updateAssignment($seg2, Request::jsonBody());
                if (!$row) {
                    Response::error('Assignment not found', 404);
                    return;
                }
                Response::json(['success' => true, 'data' => $row]);
                return;
            }

            if ($seg1 === 'roster' && $method === 'POST' && $seg2 === 'cell') {
                Auth::requirePermission($user, 'shifts.manage');
                Response::json([
                    'success' => true,
                    'data' => $this->service->upsertRosterCell(Request::jsonBody(), $user['id']),
                ]);
                return;
            }

            if ($seg1 === 'roster' && $method === 'POST' && $seg2 === 'footnotes') {
                Auth::requirePermission($user, 'shifts.manage');
                $body = Request::jsonBody();
                if (empty($body['branch_id']) || empty($body['week_start']) || !array_key_exists('day_footnotes', $body)) {
                    Response::error('branch_id, week_start, and day_footnotes required', 422);
                    return;
                }
                $schedule = $this->service->ensureSchedule(
                    (string) $body['branch_id'],
                    (string) $body['week_start'],
                    $user['id']
                );
                $row = $this->service->updateSchedule($schedule['id'], [
                    'day_footnotes' => $body['day_footnotes'],
                ], $user['id']);
                Response::json(['success' => true, 'data' => $row]);
                return;
            }

            if ($seg1 === 'assignments' && $method === 'DELETE' && $seg2 !== null) {
                Auth::requirePermission($user, 'shifts.manage');
                if (!$this->service->deleteAssignment($seg2)) {
                    Response::error('Assignment not found', 404);
                    return;
                }
                Response::json(['success' => true]);
                return;
            }

            Response::error('Not found', 404);
        } catch (Throwable $e) {
            Response::error($e->getMessage(), 400);
        }
    }
}
