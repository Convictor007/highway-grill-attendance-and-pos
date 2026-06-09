<?php

declare(strict_types=1);

namespace Hg\Api\Modules\Payroll;

/**
 * Philippines employee statutory deductions (approx. 2024–2025 rules).
 * Semi-monthly: monthly equivalent = period gross × 2, then contributions halved per cutoff.
 */
final class PhDeductionCalculator
{
    /** @return array{sss: float, philhealth: float, pagibig: float, tax: float} */
    public static function forPayPeriod(float $periodGross, string $payFrequency = 'semi_monthly'): array
    {
        $monthlyEquiv = $payFrequency === 'monthly' ? $periodGross : $periodGross * 2;
        $monthly = self::monthlyEmployeeShares($monthlyEquiv);
        $divisor = $payFrequency === 'monthly' ? 1.0 : 2.0;

        return [
            'sss' => round($monthly['sss'] / $divisor, 2),
            'philhealth' => round($monthly['philhealth'] / $divisor, 2),
            'pagibig' => round($monthly['pagibig'] / $divisor, 2),
            'tax' => round($monthly['tax'] / $divisor, 2),
        ];
    }

    /** @return array{sss: float, philhealth: float, pagibig: float, tax: float} */
    public static function monthlyEmployeeShares(float $monthlyCompensation): array
    {
        $taxable = max(0, $monthlyCompensation);

        return [
            'sss' => self::sssEmployeeShare($taxable),
            'philhealth' => self::philhealthEmployeeShare($taxable),
            'pagibig' => self::pagibigEmployeeShare($taxable),
            'tax' => self::birMonthlyWithholding($taxable),
        ];
    }

    /** SSS — MSC bracketed; employee share 4.5% of MSC (2024 table, max MSC 30,000). */
    public static function sssEmployeeShare(float $monthlySalary): float
    {
        if ($monthlySalary < 1000) {
            return 0.0;
        }
        $msc = min(30000, max(4000, (int) (ceil($monthlySalary / 500) * 500)));

        return round($msc * 0.045, 2);
    }

    /** PhilHealth 2025 — 2.5% employee share; salary floor 10k, ceiling 100k. */
    public static function philhealthEmployeeShare(float $monthlySalary): float
    {
        $base = max(10000, min(100000, $monthlySalary));

        return round($base * 0.025, 2);
    }

    /** Pag-IBIG — 1% ≤ ₱1,500; else 2% capped at ₱200 employee share. */
    public static function pagibigEmployeeShare(float $monthlySalary): float
    {
        if ($monthlySalary <= 0) {
            return 0.0;
        }
        if ($monthlySalary <= 1500) {
            return round($monthlySalary * 0.01, 2);
        }

        return min(200.0, round($monthlySalary * 0.02, 2));
    }

    /** BIR TRAIN monthly withholding (compensation, no exemptions). */
    public static function birMonthlyWithholding(float $monthlyTaxable): float
    {
        if ($monthlyTaxable <= 20833) {
            return 0.0;
        }
        if ($monthlyTaxable <= 33332) {
            return round(($monthlyTaxable - 20833) * 0.20, 2);
        }
        if ($monthlyTaxable <= 66666) {
            return round(2500 + ($monthlyTaxable - 33332) * 0.25, 2);
        }
        if ($monthlyTaxable <= 166666) {
            return round(10833 + ($monthlyTaxable - 66666) * 0.30, 2);
        }
        if ($monthlyTaxable <= 666666) {
            return round(40833.33 + ($monthlyTaxable - 166666) * 0.32, 2);
        }

        return round(200833.33 + ($monthlyTaxable - 666666) * 0.35, 2);
    }

    public static function thirteenthMonthTax(float $thirteenthAmount): float
    {
        if ($thirteenthAmount <= 90000) {
            return 0.0;
        }

        return round(($thirteenthAmount - 90000) * 0.05, 2);
    }
}
