<?php

declare(strict_types=1);

namespace Hg\Api\Modules\Roles;

use Hg\Api\Core\Auth;
use Hg\Api\Core\Request;
use Hg\Api\Core\Response;
use Throwable;

final class RoleController
{
    public function __construct(private readonly RoleService $service = new RoleService()) {}

    public function handle(string $method, ?string $slug, ?string $subResource): void
    {
        try {
            if ($method === 'GET' && $slug === null) {
                $roleType = $_GET['role_type'] ?? null;
                Response::json([
                    'success' => true,
                    'data' => $this->service->listRoles(is_string($roleType) ? $roleType : null),
                ]);
                return;
            }

            if ($method === 'GET' && $slug !== null && $subResource === 'permissions') {
                $user = Auth::requireUser();
                Auth::requirePermission($user, 'users.manage');
                $role = $this->service->getRoleBySlug($slug);
                if ($role === null) {
                    Response::error('Role not found', 404);
                    return;
                }

                Response::json([
                    'success' => true,
                    'data' => [
                        'role' => $role,
                        'permissions' => $this->service->getPermissionsForRole((int) $role['role_id']),
                        'all_permissions' => $this->service->listAllPermissions(),
                    ],
                ]);
                return;
            }

            if ($method === 'PUT' && $slug !== null && $subResource === 'permissions') {
                $user = Auth::requireUser();
                Auth::requirePermission($user, 'users.manage');
                $role = $this->service->getRoleBySlug($slug);
                if ($role === null) {
                    Response::error('Role not found', 404);
                    return;
                }
                if (($role['role_type'] ?? '') === 'system') {
                    Response::error('System roles cannot be modified', 403);
                    return;
                }
                $body = Request::jsonBody();
                $ids = $body['permission_ids'] ?? [];
                if (!is_array($ids)) {
                    Response::error('permission_ids must be an array', 422);
                    return;
                }
                $this->service->setPermissionsForRole((int) $role['role_id'], $ids);
                Response::json([
                    'success' => true,
                    'data' => [
                        'role' => $role,
                        'permissions' => $this->service->getPermissionsForRole((int) $role['role_id']),
                    ],
                ]);
                return;
            }

            if ($method === 'GET' && $slug !== null) {
                $role = $this->service->getRoleBySlug($slug);
                if ($role === null) {
                    Response::error('Role not found', 404);
                    return;
                }

                Response::json(['success' => true, 'data' => $role]);
                return;
            }

            Response::error('Method not allowed', 405);
        } catch (Throwable $e) {
            Response::error($e->getMessage(), 500);
        }
    }
}
