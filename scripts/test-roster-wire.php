<?php

declare(strict_types=1);

require dirname(__DIR__) . '/api/core/Env.php';
require dirname(__DIR__) . '/api/core/Database.php';
require dirname(__DIR__) . '/api/core/Auth.php';

use Hg\Api\Core\Auth;
use Hg\Api\Core\Database;

function apiRequest(string $method, string $path, string $token, ?array $body = null): array
{
    $url = 'http://localhost/HG_web/api/index.php' . $path;
    $ch = curl_init($url);
    $headers = ['Content-Type: application/json', 'Authorization: Bearer ' . $token];
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

    return ['code' => $code, 'json' => json_decode((string) $raw, true), 'raw' => (string) $raw];
}

$login = Auth::login('hr@highwaygrill.local', 'dsadsadsa');
if (!$login) {
    echo "FAIL login\n";
    exit(1);
}
$token = $login['token'];
echo "OK login\n";

$branchId = '9e525036-603c-11f1-adbf-823eb3c4bd68';
$employeeId = '9ea79668-603c-11f1-adbf-823eb3c4bd68'; // Elena Cruz
$weekStart = '2026-06-07';

$r = apiRequest('POST', '/shifts/roster/cell', $token, [
    'branch_id' => $branchId,
    'week_start' => $weekStart,
    'employee_id' => $employeeId,
    'shift_date' => '2026-06-09',
    'start_time' => '09:00',
    'end_time' => '17:00',
    'off' => false,
]);
echo (($r['code'] === 200 && ($r['json']['success'] ?? false)) ? 'OK' : 'FAIL') . " POST /shifts/roster/cell ({$r['code']})\n";
if (!($r['json']['success'] ?? false)) {
    echo $r['raw'] . "\n";
}

$r2 = apiRequest('GET', "/shifts/roster?branch_id={$branchId}&week_start={$weekStart}", $token);
echo (($r2['code'] === 200 && ($r2['json']['success'] ?? false)) ? 'OK' : 'FAIL') . " GET /shifts/roster ({$r2['code']})\n";

$pdo = Database::connection();
$schedules = (int) $pdo->query('SELECT COUNT(*) FROM schedules')->fetchColumn();
$assignments = (int) $pdo->query('SELECT COUNT(*) FROM shift_assignments')->fetchColumn();
echo "DB schedules: {$schedules}\n";
echo "DB assignments: {$assignments}\n";

if ($assignments > 0) {
    $rows = $pdo->query(
        "SELECT sa.shift_date, e.first_name, e.last_name, sa.start_time, sa.end_time, sa.notes, sch.week_start, sch.status
         FROM shift_assignments sa
         JOIN employees e ON e.id = sa.employee_id
         JOIN schedules sch ON sch.id = sa.schedule_id
         ORDER BY sa.shift_date LIMIT 5"
    )->fetchAll();
    foreach ($rows as $row) {
        echo "- {$row['first_name']} {$row['last_name']} {$row['shift_date']} {$row['start_time']}-{$row['end_time']} (week {$row['week_start']}, {$row['status']})\n";
    }
}
