<?php

declare(strict_types=1);

namespace Hg\Api\Core\Mail;

use PHPMailer\PHPMailer\Exception as MailException;
use PHPMailer\PHPMailer\PHPMailer;

final class Mailer
{
    /** @param array<string, mixed> $config */
    public function __construct(private readonly array $config) {}

    public function sendText(string $to, string $subject, string $body): bool
    {
        return $this->dispatch($to, $subject, $body, null, []);
    }

    public function sendHtml(string $to, string $subject, string $htmlBody, string $textBody = ''): bool
    {
        return $this->dispatch($to, $subject, $textBody !== '' ? $textBody : strip_tags($htmlBody), $htmlBody, []);
    }

    /**
     * @param list<array{filename: string, content: string, mime?: string}> $attachments
     */
    public function sendWithAttachments(
        string $to,
        string $subject,
        string $textBody,
        array $attachments,
        ?string $htmlBody = null
    ): bool {
        return $this->dispatch($to, $subject, $textBody, $htmlBody, $attachments);
    }

    /**
     * @param list<array{filename: string, content: string, mime?: string}> $attachments
     */
    private function dispatch(
        string $to,
        string $subject,
        string $textBody,
        ?string $htmlBody,
        array $attachments
    ): bool {
        self::$lastError = null;
        $to = trim($to);
        if ($to === '' || !filter_var($to, FILTER_VALIDATE_EMAIL)) {
            self::$lastError = 'Invalid recipient email';
            return false;
        }

        if (!(bool) ($this->config['mail_enabled'] ?? false)) {
            self::$lastError = 'MAIL_ENABLED is false in .env';
            error_log("[HG HRMS mail skipped] To: {$to} | {$subject}");
            return false;
        }

        if (!class_exists(PHPMailer::class)) {
            return $this->sendViaPhpMail($to, $subject, $textBody);
        }

        $mail = new PHPMailer(true);
        try {
            $from = (string) ($this->config['mail_from'] ?? 'noreply@highwaygrill.local');
            $fromName = (string) ($this->config['mail_from_name'] ?? 'Highway Grill HR');

            $mail->CharSet = PHPMailer::CHARSET_UTF8;
            $mail->setFrom($from, $fromName);
            $mail->addAddress($to);
            $mail->Subject = $subject;

            if ($htmlBody !== null) {
                $mail->isHTML(true);
                $mail->Body = $htmlBody;
                $mail->AltBody = $textBody;
            } else {
                $mail->isHTML(false);
                $mail->Body = $textBody;
            }

            foreach ($attachments as $attachment) {
                $mail->addStringAttachment(
                    $attachment['content'],
                    $attachment['filename'],
                    PHPMailer::ENCODING_BASE64,
                    $attachment['mime'] ?? 'application/octet-stream'
                );
            }

            $smtpHost = trim((string) ($this->config['smtp_host'] ?? ''));
            if ($smtpHost !== '') {
                $mail->isSMTP();
                $mail->Host = $smtpHost;
                $mail->Port = (int) ($this->config['smtp_port'] ?? 587);
                $mail->SMTPAuth = ($this->config['smtp_user'] ?? '') !== '';
                $mail->Username = (string) ($this->config['smtp_user'] ?? '');
                $mail->Password = (string) ($this->config['smtp_pass'] ?? '');
                $encryption = strtolower((string) ($this->config['smtp_encryption'] ?? 'tls'));
                if ($encryption === 'ssl') {
                    $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS;
                } elseif ($encryption === 'tls') {
                    $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
                } else {
                    $mail->SMTPSecure = '';
                    $mail->SMTPAutoTLS = false;
                }
            } else {
                $mail->isMail();
            }

            return $mail->send();
        } catch (MailException $e) {
            self::$lastError = $e->getMessage();
            error_log('[HG HRMS mail error] ' . $e->getMessage());
            return false;
        }
    }

    private static ?string $lastError = null;

    public static function lastError(): ?string
    {
        return self::$lastError;
    }

    private function sendViaPhpMail(string $to, string $subject, string $body): bool
    {
        $from = (string) ($this->config['mail_from'] ?? 'noreply@highwaygrill.local');
        $headers = implode("\r\n", [
            'MIME-Version: 1.0',
            'Content-type: text/plain; charset=utf-8',
            "From: {$from}",
        ]);

        return @mail($to, $subject, $body, $headers);
    }
}
