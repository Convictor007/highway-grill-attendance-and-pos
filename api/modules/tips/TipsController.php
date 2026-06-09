<?php

declare(strict_types=1);

namespace Hg\Api\Modules\Tips;

use Hg\Api\Core\Auth;
use Hg\Api\Core\Request;
use Hg\Api\Core\Response;
use Throwable;

final class TipsController
{
    public function __construct(private readonly TipsService $service = new TipsService()) {}

    public function handle(string $method, ?string $seg1, ?string $seg2): void
    {
        try {
            $user = Auth::requireUser();
            Auth::requirePermission($user, 'payroll.view');

            if ($method === 'GET' && $seg1 === 'pools' && $seg2 === null) {
                Response::json([
                    'success' => true,
                    'data' => $this->service->listPools(Request::query('branch_id')),
                ]);
                return;
            }

            if ($method === 'GET' && $seg1 === 'pools' && $seg2 !== null && !str_contains((string) $seg2, '/')) {
                $pool = $this->service->getPool($seg2);
                if (!$pool) {
                    Response::error('Pool not found', 404);
                    return;
                }
                $pool['distributions'] = $this->service->distributions($seg2);
                Response::json(['success' => true, 'data' => $pool]);
                return;
            }

            if ($method === 'POST' && $seg1 === 'pools' && $seg2 === null) {
                Auth::requirePermission($user, 'payroll.manage');
                $body = Request::jsonBody();
                if (empty($body['branch_id']) || empty($body['pool_date']) || !isset($body['total_tips'])) {
                    Response::error('branch_id, pool_date, total_tips required', 422);
                    return;
                }
                Response::json(['success' => true, 'data' => $this->service->createPool($body)], 201);
                return;
            }

            if ($method === 'POST' && $seg1 === 'pools' && $seg2 !== null && str_ends_with((string) $seg2, '/distribute-equal')) {
                Auth::requirePermission($user, 'payroll.manage');
                $poolId = substr((string) $seg2, 0, -strlen('/distribute-equal'));
                Response::json([
                    'success' => true,
                    'data' => $this->service->distributeEqualAmongTipped($poolId),
                ]);
                return;
            }

            if ($method === 'POST' && $seg1 === 'pools' && $seg2 !== null) {
                Auth::requirePermission($user, 'payroll.manage');
                $body = Request::jsonBody();
                if (!empty($body['equal'])) {
                    Response::json([
                        'success' => true,
                        'data' => $this->service->distributeEqualAmongTipped($seg2),
                    ]);
                    return;
                }
                if (empty($body['allocations']) || !is_array($body['allocations'])) {
                    Response::error('allocations array required', 422);
                    return;
                }
                Response::json([
                    'success' => true,
                    'data' => $this->service->distribute($seg2, $body['allocations']),
                ]);
                return;
            }

            Response::error('Not found', 404);
        } catch (Throwable $e) {
            Response::error($e->getMessage(), 400);
        }
    }
}
