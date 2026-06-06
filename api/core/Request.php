<?php

declare(strict_types=1);

namespace Hg\Api\Core;

final class Request
{
    public static function jsonBody(): array
    {
        $raw = file_get_contents('php://input');
        if ($raw === false || $raw === '') {
            return [];
        }
        $data = json_decode($raw, true);
        return is_array($data) ? $data : [];
    }

    public static function bearerToken(): ?string
    {
        $header = (string) (
            $_SERVER['HTTP_AUTHORIZATION']
            ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION']
            ?? ''
        );

        if ($header === '' && function_exists('apache_request_headers')) {
            $headers = apache_request_headers();
            $header = (string) ($headers['Authorization'] ?? $headers['authorization'] ?? '');
        }

        if ($header === '') {
            $env = getenv('HTTP_AUTHORIZATION') ?: getenv('REDIRECT_HTTP_AUTHORIZATION');
            if ($env !== false && $env !== '') {
                $header = (string) $env;
            }
        }

        if (preg_match('/Bearer\s+(\S+)/i', $header, $m)) {
            return $m[1];
        }

        return isset($_GET['token']) ? (string) $_GET['token'] : null;
    }

    public static function query(string $key, ?string $default = null): ?string
    {
        return isset($_GET[$key]) ? (string) $_GET[$key] : $default;
    }
}
