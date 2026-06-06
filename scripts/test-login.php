<?php

declare(strict_types=1);

require dirname(__DIR__) . '/api/core/Env.php';
require dirname(__DIR__) . '/api/core/Database.php';
require dirname(__DIR__) . '/api/core/Auth.php';
require dirname(__DIR__) . '/api/core/Request.php';
require dirname(__DIR__) . '/api/core/Response.php';

use Hg\Api\Core\Auth;

$pass = 'dsadsadsa';
$accounts = [
    ['admin@highwaygrill.local', $pass],
    ['hr@highwaygrill.local', $pass],
    ['employee@highwaygrill.local', $pass],
];

foreach ($accounts as [$email, $pwd]) {
    $result = Auth::login($email, $pwd);
    $ok = $result !== null ? 'OK' : 'FAIL';
    $role = $result['user']['role_slug'] ?? '-';
    echo "$ok  $email  ($role)\n";
}
