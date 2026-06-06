<?php

declare(strict_types=1);

require dirname(__DIR__) . '/api/core/Env.php';
require dirname(__DIR__) . '/api/core/Database.php';
require dirname(__DIR__) . '/api/core/Auth.php';

use Hg\Api\Core\Auth;

function apiRequest(string $method, string $path, ?string $token = null, ?array $body = null): array
{
    $url = 'http://localhost/HG_web/api/index.php' . $path;
    $ch = curl_init($url);
    $headers = ['Content-Type: application/json'];
    if ($token) {
        $headers[] = 'Authorization: Bearer ' . $token;
    }
    curl_setopt_array($ch, [
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 10,
    ]);
    if ($body !== null) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
    }
    $raw = curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return ['code' => $code, 'json' => json_decode((string) $raw, true)];
}

$login = Auth::login('hr@highwaygrill.local', 'dsadsadsa');
if (!$login) {
    echo "FAIL login\n";
    exit(1);
}
$token = $login['token'];
echo "OK login\n";

$tests = [
    ['GET', '/dashboard', null],
    ['GET', '/employees', null],
    ['GET', '/leave/balances', null],
    ['GET', '/compliance/checklists', null],
    ['GET', '/settings/branches', null],
    ['GET', '/attendance?date=' . date('Y-m-d'), null],
];

foreach ($tests as [$method, $path]) {
    $r = apiRequest($method, $path, $token);
    $ok = ($r['code'] === 200 && ($r['json']['success'] ?? false)) ? 'OK' : 'FAIL';
    echo "$ok $method $path ({$r['code']})\n";
}

$emp = Auth::login('employee@highwaygrill.local', 'dsadsadsa');
$et = $emp['token'] ?? '';
$r = apiRequest('GET', '/employees/me', $et);
echo (($r['code'] === 200) ? 'OK' : 'FAIL') . " GET /employees/me\n";
$r = apiRequest('GET', '/leave/requests', $et);
echo (($r['code'] === 200) ? 'OK' : 'FAIL') . " GET /leave/requests (employee)\n";

$r = apiRequest('GET', '/attendance/status', $et);
echo (($r['code'] === 200) ? 'OK' : 'FAIL') . " GET /attendance/status (employee)\n";

$r = apiRequest('POST', '/attendance/clock-in', $et, []);
echo (($r['code'] === 200 && ($r['json']['success'] ?? false)) ? 'OK' : 'FAIL') . " POST /attendance/clock-in\n";
if (($r['json']['error'] ?? '') !== '') {
    echo '  ' . $r['json']['error'] . "\n";
}

$r = apiRequest('POST', '/attendance/clock-out', $et, []);
echo (($r['code'] === 200 && ($r['json']['success'] ?? false)) ? 'OK' : 'FAIL') . " POST /attendance/clock-out\n";

$r = apiRequest('GET', '/users', $token);
echo (($r['code'] === 200) ? 'OK' : 'FAIL') . " GET /users (hr)\n";

echo "Done.\n";
