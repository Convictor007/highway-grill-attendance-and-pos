<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/core/Env.php';

use Hg\Api\Core\Env;

Env::load(dirname(__DIR__, 2) . '/.env');

return [
    'app_env' => Env::get('APP_ENV', 'local'),
    'db' => [
        'driver' => Env::get('DB_DRIVER', 'mysql'),
        'host' => Env::get('DB_HOST', '127.0.0.1'),
        'port' => Env::get('DB_PORT', '3306'),
        'name' => Env::get('DB_NAME', 'highway_grill_hrms'),
        'user' => Env::get('DB_USER', 'root'),
        'pass' => Env::get('DB_PASS', ''),
        'charset' => Env::get('DB_CHARSET', 'utf8mb4'),
    ],
    'cors_origin' => Env::get('CORS_ORIGIN', 'http://localhost:5173'),
    'session_ttl_hours' => Env::int('SESSION_TTL_HOURS', 24),
    'auth_hash_passwords' => Env::get('AUTH_HASH_PASSWORDS', 'false') === 'true',
];
