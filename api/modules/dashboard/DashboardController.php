<?php

declare(strict_types=1);

namespace Hg\Api\Modules\Dashboard;

use Hg\Api\Core\Auth;
use Hg\Api\Core\Request;
use Hg\Api\Core\Response;
use Throwable;

final class DashboardController
{
    public function handle(string $method, ?string $action = null): void
    {
        try {
            $user = Auth::requireUser();
            if (!Auth::hasPermission($user, 'reports.view')) {
                Response::error('Forbidden', 403);
                return;
            }
            if ($method !== 'GET') {
                Response::error('Method not allowed', 405);
                return;
            }
            $service = new DashboardService();
            if ($action === 'org-masterlist') {
                Response::json([
                    'success' => true,
                    'data' => $service->orgMasterlist(Request::query('branch_id')),
                ]);
                return;
            }
            Response::json(['success' => true, 'data' => $service->summary(Request::query('branch_id'))]);
        } catch (Throwable $e) {
            Response::error($e->getMessage(), 500);
        }
    }
}
