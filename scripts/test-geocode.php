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
        CURLOPT_TIMEOUT => 15,
    ]);
    if ($body !== null) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
    }
    $raw = curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return ['code' => $code, 'json' => json_decode((string) $raw, true)];
}

$login = Auth::login('employee@highwaygrill.local', 'dsadsadsa');
if (!$login) {
    echo "FAIL login\n";
    exit(1);
}
$token = $login['token'];
echo "OK login\n";

$r = apiRequest('GET', '/geocode/reverse?lat=14.5547&lng=121.0244', $token);
$ok = ($r['code'] === 200 && ($r['json']['success'] ?? false));
echo ($ok ? 'OK' : 'FAIL') . " GET /geocode/reverse\n";
if ($ok) {
    echo '  short: ' . ($r['json']['data']['short'] ?? '') . "\n";
} else {
    echo '  ' . ($r['json']['error'] ?? 'unknown') . "\n";
}

$r = apiRequest('POST', '/attendance/clock-in', $token, [
    'latitude' => 14.5547,
    'longitude' => 121.0244,
    'address' => 'Test address from geocode script',
]);
echo (($r['code'] === 200 && ($r['json']['success'] ?? false)) ? 'OK' : 'FAIL') . " POST clock-in with address\n";
if (!($r['json']['success'] ?? false)) {
    echo '  ' . ($r['json']['error'] ?? '') . "\n";
}

$r = apiRequest('POST', '/attendance/clock-out', $token, [
    'latitude' => 14.5548,
    'longitude' => 121.0245,
    'address' => 'Clock out address',
]);
echo (($r['code'] === 200 && ($r['json']['success'] ?? false)) ? 'OK' : 'FAIL') . " POST clock-out with address\n";

echo "Done.\n";
