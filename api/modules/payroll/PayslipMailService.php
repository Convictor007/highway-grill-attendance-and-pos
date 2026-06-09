<?php

declare(strict_types=1);

namespace Hg\Api\Modules\Payroll;

use Hg\Api\Core\Database;
use Hg\Api\Core\EmailService;
use Hg\Api\Modules\Notifications\NotificationService;

final class PayslipMailService
{
    public function __construct(
        private readonly PayrollService $payroll = new PayrollService(),
        private readonly PayslipPdfService $pdf = new PayslipPdfService(),
    ) {}

    /** @return array{sent: int, skipped: int, failed: int, details: list<array<string, mixed>>} */
    public function sendRunPayslips(string $runId, ?string $actorUserId = null): array
    {
        $run = $this->payroll->getRun($runId);
        if (!$run) {
            throw new \RuntimeException('Payroll run not found');
        }

        $status = (string) ($run['status'] ?? '');
        if (!in_array($status, ['approved', 'paid'], true)) {
            throw new \InvalidArgumentException('Approve the payroll run before sending payslips');
        }

        $stmt = Database::connection()->prepare(
            'SELECT id FROM payslips WHERE payroll_run_id = :rid ORDER BY employee_id'
        );
        $stmt->execute(['rid' => $runId]);
        $ids = array_column($stmt->fetchAll(), 'id');

        $result = ['sent' => 0, 'skipped' => 0, 'failed' => 0, 'details' => []];
        foreach ($ids as $payslipId) {
            $detail = $this->sendPayslip((string) $payslipId, $actorUserId);
            $result['details'][] = $detail;
            $result[$detail['status']]++;
        }

        return $result;
    }

    /** @return array<string, mixed> */
    public function sendPayslip(string $payslipId, ?string $actorUserId = null): array
    {
        $row = $this->payroll->getPayslip($payslipId);
        if (!$row) {
            throw new \RuntimeException('Payslip not found');
        }

        $runStatus = (string) ($row['run_status'] ?? '');
        if (!in_array($runStatus, ['approved', 'paid'], true)) {
            throw new \InvalidArgumentException('Payroll run must be approved or paid before sending payslips');
        }

        $employeeId = (string) $row['employee_id'];
        $email = $this->resolveEmployeeEmail($employeeId);
        $name = trim(((string) ($row['first_name'] ?? '')) . ' ' . ((string) ($row['last_name'] ?? '')));
        $periodLabel = $this->periodLabel((string) ($row['period_start'] ?? ''), (string) ($row['period_end'] ?? ''));

        if ($email === null) {
            return [
                'payslip_id' => $payslipId,
                'employee_id' => $employeeId,
                'employee_name' => $name,
                'status' => 'skipped',
                'reason' => 'No email on file',
            ];
        }

        try {
            $pdf = $this->pdf->generate($row);
            $documentId = $this->archivePdf($row, $pdf, $actorUserId);
            if ($documentId !== null) {
                Database::connection()->prepare(
                    'UPDATE payslips SET document_id = :doc WHERE id = :id'
                )->execute(['doc' => $documentId, 'id' => $payslipId]);
            }

            $filename = $this->pdfFilename($name, $periodLabel);
            $netPay = number_format((float) ($row['net_pay'] ?? 0), 2);
            $payDate = (string) ($row['pay_date'] ?? '');
            $config = require dirname(__DIR__, 2) . '/config/config.php';
            $appUrl = rtrim((string) ($config['app_url'] ?? ''), '/');

            $subject = "Highway Grill Payslip — {$periodLabel}" . ($name !== '' ? " — {$name}" : '');
            $textBody = implode("\n", array_filter([
                'Hello' . ($name !== '' ? " {$name}" : '') . ',',
                '',
                'Your payslip for period ' . $periodLabel . ' is attached.',
                $payDate !== '' ? "Pay date: {$payDate}" : null,
                "Net pay: ₱{$netPay}",
                $appUrl !== '' ? "View in portal: {$appUrl}/payroll" : null,
                '',
                '— Highway Grill HR',
            ]));

            $htmlBody = '<p>Hello' . ($name !== '' ? ' <strong>' . htmlspecialchars($name, ENT_QUOTES, 'UTF-8') . '</strong>' : '') . ',</p>'
                . '<p>Your payslip for period <strong>' . htmlspecialchars($periodLabel, ENT_QUOTES, 'UTF-8') . '</strong> is attached.</p>'
                . ($payDate !== '' ? '<p>Pay date: ' . htmlspecialchars($payDate, ENT_QUOTES, 'UTF-8') . '</p>' : '')
                . '<p>Net pay: <strong>₱' . htmlspecialchars($netPay, ENT_QUOTES, 'UTF-8') . '</strong></p>'
                . ($appUrl !== '' ? '<p><a href="' . htmlspecialchars($appUrl . '/payroll', ENT_QUOTES, 'UTF-8') . '">Open My Payroll</a></p>' : '')
                . '<p>— Highway Grill HR</p>';

            $sent = EmailService::sendWithAttachments(
                $email,
                $subject,
                $textBody,
                [['filename' => $filename, 'content' => $pdf, 'mime' => 'application/pdf']],
                $htmlBody
            );

            if (!$sent) {
                $reason = EmailService::lastError()
                    ?? 'Mail not sent (check MAIL_ENABLED and SMTP settings in .env)';
                return [
                    'payslip_id' => $payslipId,
                    'employee_id' => $employeeId,
                    'employee_name' => $name,
                    'email' => $email,
                    'status' => 'failed',
                    'reason' => $reason,
                ];
            }

            $this->notifyEmployee($employeeId, $periodLabel, $payslipId, $appUrl);

            return [
                'payslip_id' => $payslipId,
                'employee_id' => $employeeId,
                'employee_name' => $name,
                'email' => $email,
                'document_id' => $documentId,
                'status' => 'sent',
            ];
        } catch (\Throwable $e) {
            return [
                'payslip_id' => $payslipId,
                'employee_id' => $employeeId,
                'employee_name' => $name,
                'email' => $email,
                'status' => 'failed',
                'reason' => $e->getMessage(),
            ];
        }
    }

    private function resolveEmployeeEmail(string $employeeId): ?string
    {
        $stmt = Database::connection()->prepare(
            "SELECT COALESCE(NULLIF(TRIM(e.email), ''), NULLIF(TRIM(u.email), '')) AS email
             FROM employees e
             LEFT JOIN users u ON u.employee_id = e.id AND u.is_active = 1
             WHERE e.id = :eid
             ORDER BY u.approved_at DESC
             LIMIT 1"
        );
        $stmt->execute(['eid' => $employeeId]);
        $email = trim((string) ($stmt->fetchColumn() ?: ''));
        if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return null;
        }

        return $email;
    }

    /** @param array<string, mixed> $row */
    private function archivePdf(array $row, string $pdfBinary, ?string $actorUserId): ?string
    {
        $dir = dirname(__DIR__, 2) . '/uploads/documents';
        if (!is_dir($dir) && !mkdir($dir, 0755, true) && !is_dir($dir)) {
            return null;
        }

        $id = Database::uuid();
        $filename = $id . '.pdf';
        $path = $dir . '/' . $filename;
        if (file_put_contents($path, $pdfBinary) === false) {
            return null;
        }

        $periodLabel = $this->periodLabel((string) ($row['period_start'] ?? ''), (string) ($row['period_end'] ?? ''));
        $title = 'Payslip ' . $periodLabel;
        $employeeId = (string) $row['employee_id'];
        $fileUrl = '/api/uploads/documents/' . $filename;
        $sizeKb = (int) max(1, ceil(strlen($pdfBinary) / 1024));

        Database::connection()->prepare(
            'INSERT INTO documents (id, employee_id, category, title, file_url, file_type, file_size_kb, is_confidential, uploaded_by)
             VALUES (:id, :eid, :cat, :title, :url, :ftype, :size, 0, :by)'
        )->execute([
            'id' => $id,
            'eid' => $employeeId,
            'cat' => 'payslip',
            'title' => $title,
            'url' => $fileUrl,
            'ftype' => 'application/pdf',
            'size' => $sizeKb,
            'by' => $actorUserId,
        ]);

        return $id;
    }

    private function notifyEmployee(string $employeeId, string $periodLabel, string $payslipId, string $appUrl): void
    {
        $stmt = Database::connection()->prepare(
            'SELECT id FROM users WHERE employee_id = :eid AND is_active = 1 LIMIT 1'
        );
        $stmt->execute(['eid' => $employeeId]);
        $userId = $stmt->fetchColumn();
        if (!$userId) {
            return;
        }

        (new NotificationService())->create(
            (string) $userId,
            'payslip',
            'Payslip ready — ' . $periodLabel,
            'Your payslip was emailed and is available in My Payroll.',
            $payslipId,
            $appUrl !== '' ? $appUrl . '/payroll' : '/payroll'
        );
    }

    private function periodLabel(string $start, string $end): string
    {
        if ($start === '' || $end === '') {
            return 'Pay period';
        }

        return $start . ' – ' . $end;
    }

    private function pdfFilename(string $name, string $periodLabel): string
    {
        $safeName = preg_replace('/[^a-zA-Z0-9_-]+/', '_', $name) ?: 'Employee';
        $safePeriod = preg_replace('/[^a-zA-Z0-9_-]+/', '_', $periodLabel) ?: 'period';

        return "Payslip_{$safeName}_{$safePeriod}.pdf";
    }
}
