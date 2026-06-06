<?php

declare(strict_types=1);

namespace Hg\Api\Core;

final class Env
{
    private static bool $loaded = false;

    /** @var array<string, string> */
    private static array $vars = [];

    public static function load(?string $path = null): void
    {
        if (self::$loaded) {
            return;
        }

        $path ??= dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . '.env';
        if (!is_readable($path)) {
            self::$loaded = true;
            return;
        }

        $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        if ($lines === false) {
            self::$loaded = true;
            return;
        }

        foreach ($lines as $line) {
            $line = trim($line);
            if ($line === '' || str_starts_with($line, '#')) {
                continue;
            }
            if (!str_contains($line, '=')) {
                continue;
            }
            [$key, $value] = explode('=', $line, 2);
            $key = trim($key);
            $value = trim($value);
            if (
                (str_starts_with($value, '"') && str_ends_with($value, '"'))
                || (str_starts_with($value, "'") && str_ends_with($value, "'"))
            ) {
                $value = substr($value, 1, -1);
            }
            self::$vars[$key] = $value;
            $_ENV[$key] = $value;
            putenv("$key=$value");
        }

        self::$loaded = true;
    }

    public static function get(string $key, ?string $default = null): ?string
    {
        self::load();
        if (array_key_exists($key, self::$vars)) {
            return self::$vars[$key];
        }
        $env = $_ENV[$key] ?? getenv($key);
        if ($env !== false && $env !== '') {
            return (string) $env;
        }
        return $default;
    }

    public static function int(string $key, int $default = 0): int
    {
        $v = self::get($key);
        return $v !== null && $v !== '' ? (int) $v : $default;
    }
}
