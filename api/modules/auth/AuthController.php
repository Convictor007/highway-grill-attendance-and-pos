<?php

declare(strict_types=1);

namespace Hg\Api\Modules\Auth;

use Hg\Api\Core\AuditLog;
use Hg\Api\Core\Auth;
use Hg\Api\Core\Database;
use Hg\Api\Core\Request;
use Hg\Api\Core\Response;
use Throwable;

final class AuthController
{
    public function __construct(
        private readonly RegistrationService $registration = new RegistrationService()
    ) {}

    public function handle(string $method, ?string $action): void
    {
        try {
            if ($method === 'POST' && $action === 'login') {
                $body = Request::jsonBody();
                $email = trim((string) ($body['email'] ?? ''));
                $password = (string) ($body['password'] ?? '');
                if ($email === '' || $password === '') {
                    Response::error('Email and password required', 422);
                    return;
                }
                try {
                    $result = Auth::login($email, $password);
                } catch (\RuntimeException $e) {
                    Response::error($e->getMessage(), 403);
                    return;
                }
                if ($result === null) {
                    Response::error('Invalid credentials', 401);
                    return;
                }
                $result['user']['permissions'] = $result['permissions'];
                $result['user'] = $this->enrichUser($result['user']);
                AuditLog::write($result['user']['id'], 'login', 'users', $result['user']['id']);
                Response::json(['success' => true, 'data' => $result]);
                return;
            }

            if ($method === 'POST' && $action === 'register') {
                $data = $this->registration->register(Request::jsonBody());
                Response::json(['success' => true, 'data' => $data], 201);
                return;
            }

            if ($method === 'GET' && $action === 'register-options') {
                Response::json([
                    'success' => true,
                    'data' => $this->registration->registerOptions(Request::query('branch_id')),
                ]);
                return;
            }

            if ($method === 'POST' && $action === 'logout') {
                Auth::logout(Request::bearerToken());
                Response::json(['success' => true]);
                return;
            }

            if ($method === 'GET' && ($action === 'me' || $action === null)) {
                $user = Auth::userFromToken(Request::bearerToken());
                if ($user === null) {
                    Response::error('Unauthorized', 401);
                    return;
                }
                $user = $this->enrichUser($user);
                Response::json(['success' => true, 'data' => $user]);
                return;
            }

            Response::error('Not found', 404);
        } catch (Throwable $e) {
            Response::error($e->getMessage(), 500);
        }
    }

    private function enrichUser(array $user): array
    {
        if (empty($user['employee_id'])) {
            return $user;
        }
        $stmt = Database::connection()->prepare(
            'SELECT id, emp_number, first_name, last_name, branch_id, department_id, position_id, status,
                    photo_url, gender, date_of_birth
             FROM employees WHERE id = :id LIMIT 1'
        );
        $stmt->execute(['id' => $user['employee_id']]);
        $emp = $stmt->fetch();
        $user['employee'] = $emp ?: null;
        return $user;
    }
}
