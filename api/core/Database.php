<?php

declare(strict_types=1);

namespace Hg\Api\Core;

use PDO;
use PDOException;

final class Database
{
    private static ?PDO $pdo = null;

    public static function connection(): PDO
    {
        if (self::$pdo !== null) {
            return self::$pdo;
        }

        $configPath = dirname(__DIR__) . '/config/config.php';
        if (!is_file($configPath)) {
            throw new PDOException('Missing api/config/config.php — copy from config.example.php');
        }

        $config = require $configPath;
        $db = $config['db'];
        $driver = $db['driver'] ?? 'mysql';

        if ($driver === 'mysql') {
            $dsn = sprintf(
                'mysql:host=%s;port=%s;dbname=%s;charset=%s',
                $db['host'],
                $db['port'] ?? '3306',
                $db['name'],
                $db['charset'] ?? 'utf8mb4'
            );
        } else {
            $dsn = sprintf('pgsql:host=%s;port=%s;dbname=%s', $db['host'], $db['port'], $db['name']);
        }

        self::$pdo = new PDO($dsn, $db['user'], $db['pass'], [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);

        return self::$pdo;
    }

    public static function uuid(): string
    {
        $pdo = self::connection();
        $row = $pdo->query('SELECT UUID() AS id')->fetch();
        return (string) $row['id'];
    }
}
