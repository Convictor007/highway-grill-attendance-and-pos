<?php

declare(strict_types=1);

namespace Hg\Api\Modules\Payroll;

use Hg\Api\Core\Database;
use Hg\Api\Core\Schema;
use Hg\Api\Modules\Benefits\BenefitService;
use Hg\Api\Modules\Holidays\HolidayService;
use Hg\Api\Modules\Loans\LoanService;
use Hg\Api\Modules\Tips\TipsService;

final class PayrollService
{
    public function listRuns(?string $branchId = null): array
    {
        $sql = 'SELECT pr.*, b.name AS branch_name FROM payroll_runs pr
                INNER JOIN branches b ON b.id = pr.branch_id WHERE 1=1';
        $params = [];
        if ($branchId) {
            $sql .= ' AND pr.branch_id = :b';
            $params['b'] = $branchId;
        }
        $sql .= ' ORDER BY pr.period_end DESC';
        $stmt = Database::connection()->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll();
    }

    public function createRun(array $data, string $userId): array
    {
        $id = Database::uuid();
        $runType = ($data['run_type'] ?? 'regular') === '13th_month' ? '13th_month' : 'regular';
        $pdo = Database::connection();
        if (Schema::hasColumn('payroll_runs', 'run_type')) {
            $pdo->prepare(
                'INSERT INTO payroll_runs (id, branch_id, period_start, period_end, pay_date, run_type, status, processed_by)
                 VALUES (:id, :bid, :ps, :pe, :pd, :rt, :st, :uid)'
            )->execute([
                'id' => $id,
                'bid' => $data['branch_id'],
                'ps' => $data['period_start'],
                'pe' => $data['period_end'],
                'pd' => $data['pay_date'],
                'rt' => $runType,
                'st' => 'draft',
                'uid' => $userId,
            ]);
        } else {
            $pdo->prepare(
                'INSERT INTO payroll_runs (id, branch_id, period_start, period_end, pay_date, status, processed_by)
                 VALUES (:id, :bid, :ps, :pe, :pd, :st, :uid)'
            )->execute([
                'id' => $id,
                'bid' => $data['branch_id'],
                'ps' => $data['period_start'],
                'pe' => $data['period_end'],
                'pd' => $data['pay_date'],
                'st' => 'draft',
                'uid' => $userId,
            ]);
        }
        $stmt = Database::connection()->prepare('SELECT * FROM payroll_runs WHERE id = :id');
        $stmt->execute(['id' => $id]);
        return $stmt->fetch();
    }

    public function payslipsForEmployee(string $employeeId): array
    {
        $stmt = Database::connection()->prepare(
            'SELECT ps.*, pr.period_start, pr.period_end, pr.pay_date, pr.status AS run_status
             FROM payslips ps
             INNER JOIN payroll_runs pr ON pr.id = ps.payroll_run_id
             WHERE ps.employee_id = :eid
             ORDER BY pr.pay_date DESC'
        );
        $stmt->execute(['eid' => $employeeId]);
        return $stmt->fetchAll();
    }

    public function payslips(?string $runId = null): array
    {
        $sql = 'SELECT ps.*, e.emp_number, e.first_name, e.last_name
                FROM payslips ps
                INNER JOIN employees e ON e.id = ps.employee_id WHERE 1=1';
        $params = [];
        if ($runId) {
            $sql .= ' AND ps.payroll_run_id = :rid';
            $params['rid'] = $runId;
        }
        $sql .= ' ORDER BY e.last_name';
        $stmt = Database::connection()->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll();
    }

    public function generatePayslips(string $runId): array
    {
        $pdo = Database::connection();
        $run = $pdo->prepare('SELECT * FROM payroll_runs WHERE id = :id LIMIT 1');
        $run->execute(['id' => $runId]);
        $runRow = $run->fetch();
        if (!$runRow) {
            throw new \RuntimeException('Payroll run not found');
        }

        if (($runRow['run_type'] ?? 'regular') === '13th_month') {
            return $this->generate13thMonthPayslips($runId, $runRow);
        }

        $holidayService = new HolidayService();
        $adjustmentService = new PayrollAdjustmentService();
        $tipsService = new TipsService();
        $benefitService = new BenefitService();
        $loanService = new LoanService();
        $branchId = (string) $runRow['branch_id'];

        $emps = $pdo->prepare(
            "SELECT e.id, COALESCE(p.min_hourly, 80) AS hourly
             FROM employees e
             LEFT JOIN positions p ON p.id = e.position_id
             WHERE e.branch_id = :b AND e.status = 'active'"
        );
        $emps->execute(['b' => $branchId]);
        $created = 0;

        foreach ($emps->fetchAll() as $emp) {
            $exists = $pdo->prepare('SELECT id FROM payslips WHERE payroll_run_id = :r AND employee_id = :e LIMIT 1');
            $exists->execute(['r' => $runId, 'e' => $emp['id']]);
            if ($exists->fetch()) {
                continue;
            }

            $employeeId = (string) $emp['id'];
            $periodStart = (string) $runRow['period_start'];
            $periodEnd = (string) $runRow['period_end'];

            $hrs = $pdo->prepare(
                'SELECT COALESCE(SUM(actual_hours), 0) FROM attendance
                 WHERE employee_id = :e AND DATE(clock_in) BETWEEN :ps AND :pe'
            );
            $hrs->execute(['e' => $employeeId, 'ps' => $periodStart, 'pe' => $periodEnd]);
            $regularHours = (float) $hrs->fetchColumn();
            $hourly = (float) $emp['hourly'];
            $basicPay = round($regularHours * $hourly, 2);

            $holidayHours = $holidayService->holidayHoursInPeriod($employeeId, $periodStart, $periodEnd, $branchId);
            $holidayPremium = $holidayService->holidayPremiumPay($employeeId, $periodStart, $periodEnd, $branchId, $hourly);

            $overtimeHours = $this->approvedOvertimeHours($employeeId, $periodStart, $periodEnd);
            $overtimePay = round($overtimeHours * $hourly * 1.25, 2);

            $tipsAmount = $tipsService->tipsForEmployeeInPeriod($employeeId, $periodStart, $periodEnd);
            $benefitsAmount = $benefitService->monthlyTotalForEmployee($employeeId);

            $adj = $adjustmentService->totalsForEmployee($employeeId, $runId);
            $adjNet = (float) $adj['net'];

            $gross = round($basicPay + $holidayPremium + $overtimePay + $tipsAmount + $benefitsAmount + max(0, $adjNet), 2);
            $sss = round($gross * 0.045, 2);
            $phil = round($gross * 0.025, 2);
            $pagibig = round($gross * 0.02, 2);
            $tax = round($gross * 0.05, 2);
            $loanDeduction = $loanService->applyPayrollDeduction($employeeId, $runId, (string) $runRow['pay_date']);
            $adjDebits = max(0, -(float) $adj['net']);
            $otherDeductions = round($loanDeduction + $adjDebits, 2);
            $net = round($gross - $sss - $phil - $pagibig - $tax - $otherDeductions, 2);

            $pdo->prepare(
                'INSERT INTO payslips (id, payroll_run_id, employee_id, regular_hours, overtime_hours, holiday_hours,
                 basic_pay, overtime_pay, tips_amount, service_charge, gross_pay,
                 sss_amount, philhealth_amount, pagibig_amount, tax_amount, other_deductions, net_pay, generated_at)
                 VALUES (UUID(), :rid, :eid, :rh, :oth, :hh, :bp, :otp, :tips, :svc, :gp, :sss, :ph, :pg, :tax, :other, :net, NOW())'
            )->execute([
                'rid' => $runId,
                'eid' => $employeeId,
                'rh' => $regularHours,
                'oth' => $overtimeHours,
                'hh' => $holidayHours,
                'bp' => $basicPay,
                'otp' => $overtimePay,
                'tips' => $tipsAmount,
                'svc' => $benefitsAmount,
                'gp' => $gross,
                'sss' => $sss,
                'ph' => $phil,
                'pg' => $pagibig,
                'tax' => $tax,
                'other' => $otherDeductions,
                'net' => max(0, $net),
            ]);
            $created++;
        }

        return $this->finalizeRun($runId, $created);
    }

    public function generate13thMonthPayslips(string $runId, ?array $runRow = null): array
    {
        $pdo = Database::connection();
        if ($runRow === null) {
            $stmt = $pdo->prepare('SELECT * FROM payroll_runs WHERE id = :id LIMIT 1');
            $stmt->execute(['id' => $runId]);
            $runRow = $stmt->fetch();
            if (!$runRow) {
                throw new \RuntimeException('Payroll run not found');
            }
        }

        $year = (int) date('Y', strtotime((string) $runRow['pay_date']));
        $emps = $pdo->prepare(
            "SELECT e.id FROM employees e WHERE e.branch_id = :b AND e.status = 'active'"
        );
        $emps->execute(['b' => $runRow['branch_id']]);
        $created = 0;

        foreach ($emps->fetchAll() as $emp) {
            $employeeId = (string) $emp['id'];
            $exists = $pdo->prepare('SELECT id FROM payslips WHERE payroll_run_id = :r AND employee_id = :e LIMIT 1');
            $exists->execute(['r' => $runId, 'e' => $employeeId]);
            if ($exists->fetch()) {
                continue;
            }

            $runTypeFilter = Schema::hasColumn('payroll_runs', 'run_type')
                ? " AND (pr.run_type IS NULL OR pr.run_type = 'regular')"
                : '';
            $basicStmt = $pdo->prepare(
                "SELECT COALESCE(SUM(ps.basic_pay), 0)
                 FROM payslips ps
                 INNER JOIN payroll_runs pr ON pr.id = ps.payroll_run_id
                 WHERE ps.employee_id = :eid AND pr.branch_id = :bid
                   AND YEAR(pr.period_end) = :yr
                   AND pr.status IN ('processing', 'approved', 'paid'){$runTypeFilter}"
            );
            $basicStmt->execute([
                'eid' => $employeeId,
                'bid' => $runRow['branch_id'],
                'yr' => $year,
            ]);
            $totalBasic = (float) $basicStmt->fetchColumn();
            $thirteenth = round($totalBasic / 12, 2);
            if ($thirteenth <= 0) {
                continue;
            }

            $tax = $thirteenth > 90000 ? round(($thirteenth - 90000) * 0.05, 2) : 0.0;
            $net = round($thirteenth - $tax, 2);

            $pdo->prepare(
                'INSERT INTO payslips (id, payroll_run_id, employee_id, regular_hours, basic_pay, gross_pay,
                 tax_amount, other_deductions, net_pay, generated_at)
                 VALUES (UUID(), :rid, :eid, 0, :bp, :gp, :tax, 0, :net, NOW())'
            )->execute([
                'rid' => $runId,
                'eid' => $employeeId,
                'bp' => $thirteenth,
                'gp' => $thirteenth,
                'tax' => $tax,
                'net' => $net,
            ]);
            $created++;
        }

        return $this->finalizeRun($runId, $created);
    }

    private function finalizeRun(string $runId, int $created): array
    {
        $pdo = Database::connection();
        $totals = $pdo->prepare(
            'SELECT COALESCE(SUM(gross_pay), 0) AS g, COALESCE(SUM(net_pay), 0) AS n FROM payslips WHERE payroll_run_id = :id'
        );
        $totals->execute(['id' => $runId]);
        $sum = $totals->fetch();
        $pdo->prepare(
            "UPDATE payroll_runs SET status = 'processing', total_gross = :g, total_net = :n WHERE id = :id"
        )->execute(['id' => $runId, 'g' => $sum['g'], 'n' => $sum['n']]);

        return ['created' => $created, 'payslips' => $this->payslips($runId)];
    }

    private function approvedOvertimeHours(string $employeeId, string $from, string $to): float
    {
        $stmt = Database::connection()->prepare(
            "SELECT COALESCE(SUM(extra_hours), 0) FROM overtime_requests
             WHERE employee_id = :eid AND status = 'approved' AND request_date BETWEEN :f AND :t"
        );
        $stmt->execute(['eid' => $employeeId, 'f' => $from, 't' => $to]);

        return round((float) $stmt->fetchColumn(), 2);
    }

    public function getRun(string $id): ?array
    {
        $stmt = Database::connection()->prepare(
            'SELECT pr.*, b.name AS branch_name FROM payroll_runs pr
             INNER JOIN branches b ON b.id = pr.branch_id WHERE pr.id = :id LIMIT 1'
        );
        $stmt->execute(['id' => $id]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public function updateRun(string $id, array $data): ?array
    {
        $existing = $this->getRun($id);
        if (!$existing) {
            return null;
        }

        if (empty($data['status'])) {
            return $existing;
        }

        $status = (string) $data['status'];
        $allowed = ['draft', 'processing', 'approved', 'paid', 'cancelled'];
        if (!in_array($status, $allowed, true)) {
            throw new \InvalidArgumentException('Invalid status');
        }

        $this->assertRunStatusTransition((string) $existing['status'], $status, $id);

        $sql = 'UPDATE payroll_runs SET status = :st';
        if (in_array($status, ['approved', 'paid'], true)) {
            $sql .= ', processed_at = NOW()';
        }
        $sql .= ' WHERE id = :id';
        Database::connection()->prepare($sql)->execute(['st' => $status, 'id' => $id]);

        return $this->getRun($id);
    }

    private function assertRunStatusTransition(string $from, string $to, string $runId): void
    {
        if ($to === $from) {
            return;
        }

        if ($to === 'cancelled') {
            if ($from === 'paid') {
                throw new \InvalidArgumentException('Cannot cancel a paid payroll run');
            }

            return;
        }

        $valid = [
            'draft' => ['processing'],
            'processing' => ['approved', 'cancelled'],
            'approved' => ['paid', 'cancelled'],
            'paid' => [],
            'cancelled' => [],
        ];

        if (!in_array($to, $valid[$from] ?? [], true)) {
            throw new \InvalidArgumentException("Cannot change payroll run status from {$from} to {$to}");
        }

        if ($to === 'approved') {
            $stmt = Database::connection()->prepare(
                'SELECT COUNT(*) FROM payslips WHERE payroll_run_id = :id'
            );
            $stmt->execute(['id' => $runId]);
            if ((int) $stmt->fetchColumn() === 0) {
                throw new \InvalidArgumentException('Generate payslips before approving this run');
            }
        }
    }

    public function getPayslip(string $id): ?array
    {
        $stmt = Database::connection()->prepare(
            'SELECT ps.*, e.emp_number, e.first_name, e.last_name,
                    pr.period_start, pr.period_end, pr.pay_date, pr.status AS run_status
             FROM payslips ps
             INNER JOIN employees e ON e.id = ps.employee_id
             INNER JOIN payroll_runs pr ON pr.id = ps.payroll_run_id
             WHERE ps.id = :id LIMIT 1'
        );
        $stmt->execute(['id' => $id]);
        $row = $stmt->fetch();
        return $row ?: null;
    }
}
