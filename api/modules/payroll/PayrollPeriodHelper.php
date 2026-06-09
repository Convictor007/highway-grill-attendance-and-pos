<?php

declare(strict_types=1);

namespace Hg\Api\Modules\Payroll;

/** Semi-monthly cutoffs: 1–15 (pay on 15th) and 16–end (pay on last day). */
final class PayrollPeriodHelper
{
    public static function currentSemiMonthly(?string $asOf = null): array
    {
        $ts = $asOf ? strtotime($asOf) : time();
        if ($ts === false) {
            $ts = time();
        }
        $y = (int) date('Y', $ts);
        $m = (int) date('m', $ts);
        $d = (int) date('d', $ts);

        if ($d <= 15) {
            return self::pack($y, $m, 1, 15, 15, 'first');
        }

        $last = (int) date('t', $ts);

        return self::pack($y, $m, 16, $last, $last, 'second');
    }

    public static function nextSemiMonthly(?string $asOf = null): array
    {
        $current = self::currentSemiMonthly($asOf);
        if ($current['cutoff'] === 'first') {
            $y = (int) substr($current['period_start'], 0, 4);
            $m = (int) substr($current['period_start'], 5, 2);
            $last = (int) date('t', strtotime(sprintf('%04d-%02d-01', $y, $m)));

            return self::pack($y, $m, 16, $last, $last, 'second');
        }

        $nextMonth = strtotime($current['period_start'] . ' +1 month');
        $y = (int) date('Y', $nextMonth);
        $m = (int) date('m', $nextMonth);

        return self::pack($y, $m, 1, 15, 15, 'first');
    }

    public static function suggested(string $which = 'current'): array
    {
        return match ($which) {
            'next' => self::nextSemiMonthly(),
            default => self::currentSemiMonthly(),
        };
    }

    /** @return array{period_start: string, period_end: string, pay_date: string, cutoff: string, pay_frequency: string} */
    private static function pack(int $y, int $m, int $startDay, int $endDay, int $payDay, string $cutoff): array
    {
        return [
            'period_start' => sprintf('%04d-%02d-%02d', $y, $m, $startDay),
            'period_end' => sprintf('%04d-%02d-%02d', $y, $m, $endDay),
            'pay_date' => sprintf('%04d-%02d-%02d', $y, $m, $payDay),
            'cutoff' => $cutoff,
            'pay_frequency' => 'semi_monthly',
        ];
    }
}
