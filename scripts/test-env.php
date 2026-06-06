<?php
$config = require dirname(__DIR__) . '/api/config/config.php';
echo "DB: {$config['db']['name']}@{$config['db']['host']}\n";
echo "CORS: {$config['cors_origin']}\n";

require dirname(__DIR__) . '/api/core/Database.php';
use Hg\Api\Core\Database;

$pdo = Database::connection();
$count = $pdo->query('SELECT COUNT(*) FROM users')->fetchColumn();
echo "Users in DB: $count\n";
