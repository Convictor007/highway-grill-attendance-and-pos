<?php

declare(strict_types=1);

namespace Hg\Api\Modules\Users;

use Hg\Api\Core\Auth;
use Hg\Api\Core\Request;
use Hg\Api\Core\Response;
use Throwable;

final class UserController
{
    public function __construct(private readonly UserService $service = new UserService()) {}

    public function handle(string $method, ?string $seg1, ?string $seg2): void
    {
        try {
            $user = Auth::requireUser();

            if ($method === 'GET' && $seg1 === 'pending') {
                $this->requireCrewApproval($user);
                Response::json(['success' => true, 'data' => $this->service->listPendingRegistrations()]);
                return;
            }

            if ($method === 'POST' && $seg1 !== null && $seg2 === 'approve') {
                $this->requireCrewApproval($user);
                Response::json([
                    'success' => true,
                    'data' => $this->service->approveRegistration($seg1, $user['id']),
                ]);
                return;
            }

            if ($method === 'POST' && $seg1 !== null && $seg2 === 'activate') {
                $this->requireCrewApproval($user);
                Response::json([
                    'success' => true,
                    'data' => $this->service->activateEmployee($seg1, $user['id']),
                ]);
                return;
            }

            if ($method === 'POST' && $seg1 !== null && $seg2 === 'reject') {
                $this->requireCrewApproval($user);
                $body = Request::jsonBody();
                Response::json([
                    'success' => true,
                    'data' => $this->service->rejectRegistration(
                        $seg1,
                        $user['id'],
                        isset($body['reason']) ? trim((string) $body['reason']) : null
                    ),
                ]);
                return;
            }

            Auth::requirePermission($user, 'users.manage');

            if ($method === 'GET' && $seg1 === null) {
                Response::json(['success' => true, 'data' => $this->service->list()]);
                return;
            }

            if ($method === 'GET' && $seg1 !== null) {
                Response::json(['success' => true, 'data' => $this->service->get($seg1)]);
                return;
            }

            if ($method === 'POST' && $seg1 === null) {
                Response::json(['success' => true, 'data' => $this->service->create(Request::jsonBody())], 201);
                return;
            }

            if ($method === 'PUT' && $seg1 !== null) {
                Response::json(['success' => true, 'data' => $this->service->update($seg1, Request::jsonBody())]);
                return;
            }

            Response::error('Not found', 404);
        } catch (Throwable $e) {
            Response::error($e->getMessage(), 400);
        }
    }

    /** @param array<string, mixed> $user */
    private function requireCrewApproval(array $user): void
    {
        if (
            !Auth::hasPermission($user, 'users.manage')
            && !Auth::hasPermission($user, 'users.approve')
        ) {
            Response::error('Forbidden', 403);
            exit;
        }
    }
}
