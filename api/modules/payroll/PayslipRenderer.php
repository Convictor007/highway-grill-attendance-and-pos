<?php

declare(strict_types=1);

namespace Hg\Api\Modules\Payroll;

/** Highway Grill payslip (PDF + email) — table layout for Dompdf alignment. */
final class PayslipRenderer
{
    private const COMPANY = 'Highway Grill';

    /** @param array<string, mixed> $row */
    public static function html(array $row, bool $includeLogo = true): string
    {
        $d = self::buildData($row);
        $esc = static fn (string $v): string => htmlspecialchars($v, ENT_QUOTES, 'UTF-8');
        $money = static fn (float $v): string => self::money($v);
        $blank = static fn (float $v): string => $v > 0 ? self::money($v) : '';

        $watermark = $includeLogo ? self::watermarkMarkup() : '';

        $midDedRows = self::kvRows([
            ['TARDINESS', $money($d['tardiness']), false],
            ['OUTSTANDING LOAN', $money($d['outstandingLoan']), false],
            ['CA', $blank($d['ca']), true],
            ['HSNG', $blank($d['hsng']), true],
        ]);

        $summaryRows = self::kvRows([
            ['EVENT Duty:', $money($d['eventDuty']), false],
            ['ALLOWANCE :', $money($d['allowance']), false],
            ['GROSS PAY:', $money($d['grossPay']), false, 'strong'],
        ]);

        $lessRows = self::kvRows([
            ['CA', $blank($d['less']['ca']), true, 'sub'],
            ['LOAN Partial Payment', $blank($d['less']['loan']), true, 'sub'],
            ['HSNG', $blank($d['less']['hsng']), true, 'sub'],
        ]);

        return '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Payslip — '
            . $esc($d['employeeName']) . '</title>' . self::styles() . '</head><body><article class="tpl">'
            . $watermark
            . '<header class="brand"><p class="company-name">' . $esc(self::COMPANY) . '</p>'
            . '<div class="title-block"><div class="banner-wrap"><span class="banner">' . $esc($d['title']) . '</span></div>'
            . '<p class="period">PERIOD : <strong>' . $esc($d['periodLabel']) . '</strong></p></div></header>'
            . '<table class="top-sum" cellpadding="0" cellspacing="0" align="right"><tr>'
            . '<td class="lbl">BASIC PAY:</td><td class="num">' . $money($d['basicPay']) . '</td>'
            . '<td class="gap"></td>'
            . '<td class="lbl">OT</td><td class="num">' . $money($d['overtime']) . '</td>'
            . '<td class="gap"></td>'
            . '<td class="num total">' . $money($d['earningsSubtotal']) . '</td>'
            . '</tr></table>'
            . '<table class="emp" width="100%" cellpadding="0" cellspacing="0"><tr>'
            . '<td width="40%"><strong>EMPLOYEE:</strong> ' . $esc($d['employeeName']) . '</td>'
            . '<td width="22%"><strong>STATUS:</strong> ' . $esc($d['status']) . '</td>'
            . '<td width="38%"><strong>POSITION:</strong> ' . $esc($d['position']) . '</td>'
            . '</tr></table>'
            . '<table class="main-grid" width="100%" cellpadding="0" cellspacing="0"><tr>'
            . '<td class="col" width="42%">'
            . '<table class="tbl" width="100%" cellpadding="0" cellspacing="0"><thead><tr>'
            . '<th width="22%"></th><th width="14%">Days</th><th width="20%">BASE PAY</th>'
            . '<th width="22%">ADJUSTMENTS</th><th width="22%">AMOUNT</th></tr></thead><tbody><tr>'
            . '<td><strong>REGULAR</strong></td>'
            . '<td class="center">' . $esc($d['days']) . '</td>'
            . '<td class="num">' . $money($d['basePayRate']) . '</td>'
            . '<td class="center">OTHERS</td>'
            . '<td class="num dotted">' . ($d['adjustmentsAmount'] > 0 ? $money($d['adjustmentsAmount']) : '&nbsp;') . '</td>'
            . '</tr></tbody></table></td>'
            . '<td class="col" width="33%">'
            . '<table class="tbl" width="100%" cellpadding="0" cellspacing="0"><thead><tr>'
            . '<th>DEDUCTION</th><th width="38%">AMOUNT</th></tr></thead><tbody>'
            . '<tr><td>W/H TAX</td><td class="num">' . $money($d['deductions']['whTax']) . '</td></tr>'
            . '<tr><td>SSS</td><td class="num">' . ($d['deductions']['sss'] > 0 ? $money($d['deductions']['sss']) : '&nbsp;') . '</td></tr>'
            . '<tr><td>SSS loan</td><td class="num">' . ($d['deductions']['sssLoan'] > 0 ? $money($d['deductions']['sssLoan']) : '&nbsp;') . '</td></tr>'
            . '<tr><td>PHILHEALTH</td><td class="num">' . ($d['deductions']['philhealth'] > 0 ? $money($d['deductions']['philhealth']) : '&nbsp;') . '</td></tr>'
            . '<tr><td>HDMF</td><td class="num">' . ($d['deductions']['hdmf'] > 0 ? $money($d['deductions']['hdmf']) : '&nbsp;') . '</td></tr>'
            . '</tbody></table>'
            . '<table class="kv" width="100%" cellpadding="0" cellspacing="0">' . $midDedRows . '</table>'
            . '</td>'
            . '<td class="col col-last" width="25%">'
            . '<table class="kv" width="100%" cellpadding="0" cellspacing="0">' . $summaryRows . '</table>'
            . '<p class="less-head">LESS:</p>'
            . '<table class="kv" width="100%" cellpadding="0" cellspacing="0">' . $lessRows . '</table>'
            . '</td>'
            . '</tr></table>'
            . '<table class="net" width="100%" cellpadding="0" cellspacing="0"><tr>'
            . '<td><strong>NET PAY :</strong> <span class="net-amt">' . $money($d['netPay']) . '</span></td>'
            . '</tr></table>'
            . '<div class="received"><strong>RECEIVED BY:</strong><div class="sign-line"></div></div>'
            . '</article></body></html>';
    }

    /**
     * @param list<array{0: string, 1: string, 2?: bool, 3?: string}> $rows label, value, dotted?, class?
     */
    private static function kvRows(array $rows): string
    {
        $html = '';
        foreach ($rows as $row) {
            $label = $row[0];
            $value = $row[1];
            $dotted = $row[2] ?? false;
            $class = $row[3] ?? '';
            $valueClass = 'kv-val' . ($dotted ? ' dotted' : '') . ($class !== '' ? ' ' . $class : '');
            $display = $value !== '' ? $value : '&nbsp;';
            $html .= '<tr><td class="kv-label' . ($class === 'sub' ? ' sub' : '') . ($class === 'strong' ? ' strong' : '') . '">'
                . htmlspecialchars($label, ENT_QUOTES, 'UTF-8') . '</td>'
                . '<td class="' . $valueClass . '">' . $display . '</td></tr>';
        }

        return $html;
    }

    /**
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    public static function buildData(array $row): array
    {
        $employeeName = trim(((string) ($row['first_name'] ?? '')) . ' ' . ((string) ($row['last_name'] ?? '')));
        $basic = self::num($row['basic_pay'] ?? 0);
        $overtime = self::num($row['overtime_pay'] ?? 0);
        $eventDuty = self::num($row['holiday_pay'] ?? 0);
        $allowance = self::num($row['service_charge'] ?? 0);
        $gross = self::num($row['gross_pay'] ?? 0);
        $whTax = self::num($row['tax_amount'] ?? 0);
        $sss = self::num($row['sss_amount'] ?? 0);
        $philhealth = self::num($row['philhealth_amount'] ?? 0);
        $hdmf = self::num($row['pagibig_amount'] ?? 0);
        $loan = self::num($row['loan_deduction'] ?? 0);
        $ca = self::num($row['cash_advance'] ?? 0);
        $hsng = self::num($row['housing_deduction'] ?? 0);
        $tardiness = self::num($row['tardiness'] ?? 0);
        $otherAdj = self::num($row['other_adjustments'] ?? 0);
        $misc = max(0, $otherAdj - $ca - $tardiness - $hsng);

        $payBasis = (string) ($row['pay_basis'] ?? 'daily');
        $regularHours = self::num($row['regular_hours'] ?? 0);
        if ($payBasis === 'daily') {
            $days = $regularHours > 0
                ? number_format($regularHours > 15 ? $regularHours / 8 : $regularHours, 2, '.', ',')
                : '0.00';
        } else {
            $days = $regularHours > 0 ? number_format($regularHours / 8, 2, '.', ',') : '0.00';
        }

        $start = (string) ($row['period_start'] ?? '');
        $end = (string) ($row['period_end'] ?? '');
        $runType = (string) ($row['run_type'] ?? '');
        $payFreq = (string) ($row['pay_frequency'] ?? 'semi_monthly');
        $title = $runType === '13th_month'
            ? 'PAYSLIP - 13TH MONTH PAY'
            : ($payFreq === 'monthly' ? 'PAYSLIP - MONTHLY PAYROLL' : 'PAYSLIP - SEMI-MONTHLY PAYROLL');

        $status = (string) ($row['employment_status'] ?? '');
        $statusLabel = $status !== ''
            ? ucwords(str_replace('_', ' ', $status))
            : 'N/A';

        return [
            'title' => $title,
            'periodLabel' => self::formatPeriod($start, $end),
            'basicPay' => $basic,
            'overtime' => $overtime,
            'earningsSubtotal' => round($basic + $overtime, 2),
            'employeeName' => $employeeName !== '' ? $employeeName : '—',
            'status' => $statusLabel,
            'position' => trim((string) ($row['position_title'] ?? '')) !== '' ? (string) $row['position_title'] : '—',
            'eventDuty' => $eventDuty,
            'allowance' => $allowance,
            'grossPay' => $gross,
            'days' => $days,
            'basePayRate' => self::num($row['pay_rate'] ?? 0),
            'adjustmentsAmount' => $misc,
            'deductions' => ['whTax' => $whTax, 'sss' => $sss, 'sssLoan' => 0.0, 'philhealth' => $philhealth, 'hdmf' => $hdmf],
            'tardiness' => $tardiness,
            'outstandingLoan' => $loan,
            'ca' => $ca,
            'hsng' => $hsng,
            'less' => ['ca' => $ca, 'loan' => $loan, 'hsng' => $hsng],
            'netPay' => self::num($row['net_pay'] ?? 0),
        ];
    }

    private static function watermarkMarkup(): string
    {
        $img = self::watermarkImgTag();
        if ($img === '') {
            return '';
        }

        return '<div class="watermark" aria-hidden="true"><table class="wm-table" cellpadding="0" cellspacing="0"><tr><td>'
            . $img . '</td></tr></table></div>';
    }

    private static function watermarkImgTag(): string
    {
        $root = dirname(__DIR__, 3);
        $pngPath = $root . '/src/assets/HGlogo_whitebg.png';
        $jpgPath = $root . '/api/assets/HGlogo_whitebg.jpg';

        if (extension_loaded('gd') && is_readable($pngPath)) {
            $data = base64_encode((string) file_get_contents($pngPath));

            return '<img class="watermark-img" src="data:image/png;base64,' . $data . '" alt="" width="280" height="280" />';
        }

        if (is_readable($jpgPath)) {
            $data = base64_encode((string) file_get_contents($jpgPath));

            return '<img class="watermark-img" src="data:image/jpeg;base64,' . $data . '" alt="" width="280" height="280" />';
        }

        if (is_readable($pngPath)) {
            $data = base64_encode((string) file_get_contents($pngPath));

            return '<img class="watermark-img" src="data:image/png;base64,' . $data . '" alt="" width="280" height="280" />';
        }

        return '';
    }

    private static function styles(): string
    {
        return '<style>
          *{box-sizing:border-box}
          body{font-family:Arial,Helvetica,sans-serif;font-size:10px;color:#1c1410;margin:16px}
          .tpl{position:relative;max-width:720px;margin:0 auto;border:2px solid #e8a317;padding:14px 16px;overflow:hidden}
          .watermark{position:absolute;top:0;left:0;width:100%;height:100%;z-index:0}
          .wm-table{width:100%;height:520px;border-collapse:collapse}
          .wm-table td{text-align:center;vertical-align:middle}
          .watermark-img{width:280px;height:280px;opacity:.02}
          .brand,.top-sum,.emp,.main-grid,.net,.received{position:relative;z-index:1}
          .brand{text-align:center;margin-bottom:12px}
          .company-name{margin:0 0 10px;font-size:13px;font-weight:700;color:#7a1528;letter-spacing:.02em}
          .title-block{width:100%;text-align:center;margin-top:2px}
          .banner-wrap{text-align:center;margin-bottom:6px}
          .banner{display:inline-block;background:#7a1528;color:#f5d78e;font-weight:700;font-size:9px;letter-spacing:.08em;text-transform:uppercase;padding:6px 20px;border-radius:20px;border:2px solid #e8a317;line-height:1.3}
          .period{margin:0;font-size:10px;font-weight:600;letter-spacing:.04em;color:#1c1410}
          .period strong{font-weight:700}
          .top-sum{margin:10px 0 8px;padding-bottom:6px;border-bottom:1px solid #b8a898}
          .top-sum td{padding:2px 6px;vertical-align:baseline}
          .top-sum .lbl{font-weight:700;white-space:nowrap}
          .top-sum .gap{width:10px}
          .top-sum .total{font-size:12px;font-weight:700}
          .emp{margin-bottom:10px;font-size:10px}
          .emp td{padding:2px 4px 2px 0;vertical-align:top}
          .main-grid{border:1px solid #e8a317;border-collapse:collapse;margin-bottom:8px}
          .main-grid .col{vertical-align:top;padding:6px;border-right:1px solid #e8a317}
          .main-grid .col-last{border-right:none}
          .tbl{border-collapse:collapse;font-size:9px;margin-bottom:6px}
          .tbl th{background:#7a1528;color:#f5d78e;padding:4px 3px;text-align:center;font-size:8px;font-weight:700}
          .tbl td{padding:4px 3px;border-bottom:1px dotted #b8a898}
          .tbl .center{text-align:center}
          .num{text-align:right;font-weight:600;white-space:nowrap;padding-right:2px}
          .num.dotted{border-bottom:1px dotted #888}
          .kv{border-collapse:collapse;font-size:9px;margin-top:4px}
          .kv td{padding:3px 0;vertical-align:bottom}
          .kv-label{text-align:left;padding-right:6px;white-space:nowrap}
          .kv-label.sub{padding-left:8px}
          .kv-label.strong{font-weight:700}
          .kv-val{text-align:right;font-weight:600;white-space:nowrap;width:58px}
          .kv-val.dotted{border-bottom:1px dotted #888;min-height:12px}
          .kv-val.strong{font-weight:700}
          .less-head{font-weight:700;margin:8px 0 2px;font-size:9px}
          .net{background:#edf6e4;border:1px solid #9bc47a;margin-top:10px}
          .net td{padding:8px 10px;font-size:12px;font-weight:700}
          .net-amt{font-size:14px}
          .received{margin-top:16px}
          .sign-line{border-bottom:1px solid #222;height:22px;margin-top:6px;max-width:240px}
        </style>';
    }

    private static function num(mixed $value): float
    {
        return round((float) $value, 2);
    }

    private static function money(mixed $value): string
    {
        return number_format(self::num($value), 2, '.', ',');
    }

    private static function formatPeriod(string $start, string $end): string
    {
        if ($start === '' || $end === '') {
            return '—';
        }
        $months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
        $s = strtotime($start);
        $e = strtotime($end);
        if ($s === false || $e === false) {
            return $start . ' – ' . $end;
        }
        $sm = $months[(int) date('n', $s) - 1];
        $em = $months[(int) date('n', $e) - 1];
        if ($sm === $em) {
            return $sm . ' ' . date('j', $s) . ' – ' . date('j', $e);
        }

        return $sm . ' ' . date('j', $s) . ' – ' . $em . ' ' . date('j', $e);
    }
}
