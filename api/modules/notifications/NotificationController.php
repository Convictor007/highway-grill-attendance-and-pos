<?php

declare(strict_types=1);

namespace Hg\Api\Modules\Notifications;

use Hg\Api\Core\Auth;
use Hg\Api\Core\Request;
use Hg\Api\Core\Response;
use Throwable;

final class NotificationController
{
    public function __construct(private readonly NotificationService $service = new NotificationService()) {}

    public function handle(string $method, ?string $id, ?string $action = null): void
    {
        try {
            $user = Auth::requireUser();

            if ($method === 'GET' && $id === null) {
                $unread = Request::query('unread');
                Response::json([
                    'success' => true,
                    'data' => [
                        'items' => $this->service->listForUser(
                            $user['id'],
                            $unread === '1' || $unread === 'true' ? true : null
                        ),
                        'unread_count' => $this->service->unreadCount($user['id']),
                    ],
                ]);
                return;
            }

            if ($method === 'PUT' && $id === 'read-all') {
                $this->service->markAllRead($user['id']);
                Response::json(['success' => true, 'data' => ['read' => true]]);
                return;
            }

            if ($method === 'PUT' && $id !== null && ($action === null || $action === 'read')) {
                if (!$this->service->markRead($id, $user['id'])) {
                    Response::error('Notification not found', 404);
                    return;
                }
                Response::json(['success' => true, 'data' => ['read' => true]]);
                return;
            }

            Response::error('Not found', 404);
        } catch (Throwable $e) {
            Response::error($e->getMessage(), 500);
        }
    }
}
