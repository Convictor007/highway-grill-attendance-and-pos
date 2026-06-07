<?php

declare(strict_types=1);

namespace Hg\Api\Core;

final class EmailService
{
    public static function send(string $to, string $subject, string $body): bool
    {
        $to = trim($to);
        if ($to === '' || !filter_var($to, FILTER_VALIDATE_EMAIL)) {
            return false;
        }

        $config = require dirname(__DIR__) . '/config/config.php';
        $from = (string) ($config['mail_from'] ?? 'noreply@highwaygrill.local');
        $enabled = (bool) ($config['mail_enabled'] ?? false);

        if (!$enabled) {
            error_log("[HG HRMS mail skipped] To: {$to} | {$subject}");
            return false;
        }

        $headers = implode("\r\n", [
            'MIME-Version: 1.0',
            'Content-type: text/plain; charset=utf-8',
            "From: {$from}",
        ]);

        return @mail($to, $subject, $body, $headers);
    }
}
