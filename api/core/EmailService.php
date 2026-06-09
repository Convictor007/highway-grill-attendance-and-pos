<?php

declare(strict_types=1);

namespace Hg\Api\Core;

use Hg\Api\Core\Mail\Mailer;

final class EmailService
{
    private static ?Mailer $mailer = null;

    public static function send(string $to, string $subject, string $body): bool
    {
        return self::mailer()->sendText($to, $subject, $body);
    }

    public static function sendHtml(string $to, string $subject, string $htmlBody, string $textBody = ''): bool
    {
        return self::mailer()->sendHtml($to, $subject, $htmlBody, $textBody);
    }

    /**
     * @param list<array{filename: string, content: string, mime?: string}> $attachments
     */
    public static function sendWithAttachments(
        string $to,
        string $subject,
        string $textBody,
        array $attachments,
        ?string $htmlBody = null
    ): bool {
        return self::mailer()->sendWithAttachments($to, $subject, $textBody, $attachments, $htmlBody);
    }

    public static function lastError(): ?string
    {
        return Mailer::lastError();
    }

    private static function mailer(): Mailer
    {
        if (self::$mailer === null) {
            $config = require dirname(__DIR__) . '/config/config.php';
            self::$mailer = new Mailer($config);
        }

        return self::$mailer;
    }
}
