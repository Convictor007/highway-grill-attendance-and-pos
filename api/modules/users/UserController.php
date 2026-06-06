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

    public function handle(string $method, ?string $id): void
    {
        try {
            $user = Auth::requireUser();
            Auth::requirePermission($user, 'users.manage');

            if ($method === 'GET' && $id === null) {
                Response::json(['success' => true, 'data' => $this->service->list()]);
                return;
            }

            if ($method === 'GET' && $id !== null) {
                Response::json(['success' => true, 'data' => $this->service->get($id)]);
                return;
            }

            if ($method === 'POST' && $id === null) {
                Response::json(['success' => true, 'data' => $this->service->create(Request::jsonBody())], 201);
                return;
            }

            if ($method === 'PUT' && $id !== null) {
                Response::json(['success' => true, 'data' => $this->service->update($id, Request::jsonBody())]);
                return;
            }

            Response::error('Not found', 404);
        } catch (Throwable $e) {
            Response::error($e->getMessage(), 400);
        }
    }
}
