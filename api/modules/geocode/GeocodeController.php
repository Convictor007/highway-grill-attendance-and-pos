<?php

declare(strict_types=1);

namespace Hg\Api\Modules\Geocode;

use Hg\Api\Core\Auth;
use Hg\Api\Core\Request;
use Hg\Api\Core\Response;
use Throwable;

final class GeocodeController
{
    public function __construct(private readonly GeocodeService $service = new GeocodeService()) {}

    public function handle(string $method, ?string $action): void
    {
        try {
            Auth::requireUser();

            if ($method === 'GET' && ($action === null || $action === 'reverse')) {
                $lat = Request::query('lat') ?? Request::query('latitude');
                $lng = Request::query('lng') ?? Request::query('longitude');
                if ($lat === null || $lng === null) {
                    Response::error('lat and lng query parameters required', 422);
                    return;
                }
                $data = $this->service->reverse((float) $lat, (float) $lng);
                Response::json(['success' => true, 'data' => $data]);
                return;
            }

            if ($method === 'GET' && $action === 'search') {
                $q = trim((string) (Request::query('q') ?? ''));
                if ($q === '') {
                    Response::error('q query parameter required', 422);
                    return;
                }
                Response::json(['success' => true, 'data' => $this->service->search($q)]);
                return;
            }

            Response::error('Not found', 404);
        } catch (Throwable $e) {
            Response::error($e->getMessage(), 400);
        }
    }
}
