<?php

declare(strict_types=1);

namespace Hg\Api\Modules\Payroll;

use Hg\Api\Core\Database;
use Hg\Api\Core\Schema;
use Hg\Api\Modules\Benefits\BenefitService;
use Hg\Api\Modules\Holidays\HolidayService;
use Hg\Api\Modules\Loans\LoanService;
final class PayrollService
{
    /**
     * @return array{items: list<array<string, mixed>>, total: int, page: int, limit: int, pages: int}
     */
    public function listRuns(
        ?string $branchId = null,
        ?string $status = null,
        string $q = '',
        int $page = 1,
        int $limit = 25,
    ): array {
        $page = max(1, $page);
        $limit = max(1, min(100, $limit));
        $offset = ($page - 1) * $limit;

        $where = ' WHERE 1=1';
        $params = [];
        if ($branchId) {
            $where .= ' AND pr.branch_id = :b';
            $params['b'] = $branchId;
        }
        if ($status !== null && $status !== '') {
            $where .= ' AND pr.status = :st';
            $params['st'] = $status;
        }
        if ($q !== '') {
            $where .= ' AND (b.name LIKE :q OR pr.period_start LIKE :q OR pr.period_end LIKE :q'
                . ' OR pr.pay_date LIKE :q OR pr.status LIKE :q)';
            $params['q'] = '%' . $q . '%';
        }

        $pdo = Database::connection();
        $countStmt = $pdo->prepare(
            'SELECT COUNT(*) FROM payroll_runs pr INNER JOIN branches b ON b.id = pr.branch_id' . $where
        );
        $countStmt->execute($params);
        $total = (int) $countStmt->fetchColumn();

        $sql = 'SELECT pr.*, b.name AS branch_name FROM payroll_runs pr
                INNER JOIN branches b ON b.id = pr.branch_id' . $where
                . ' ORDER BY pr.period_end DESC, pr.created_at DESC LIMIT :lim OFFSET :off';
        $stmt = $pdo->prepare($sql);
        foreach ($params as $key => $value) {
            $stmt->bindValue(':' . $key, $value);
        }
        $stmt->bindValue(':lim', $limit, \PDO::PARAM_INT);
        $stmt->bindValue(':off', $offset, \PDO::PARAM_INT);
        $stmt->execute();

        return $this->paginatedResult($stmt->fetchAll(), $total, $page, $limit);
    }

    public function createRun(array $data, string $userId): array
    {
        $id = Database::uuid();
        $runType = ($data['run_type'] ?? 'regular') === '13th_month' ? '13th_month' : 'regular';
        $payFrequency = ($data['pay_frequency'] ?? 'semi_monthly') === 'monthly' ? 'monthly' : 'semi_monthly';
        $pdo = Database::connection();

        if (Schema::hasColumn('payroll_runs', 'run_type') && Schema::hasColumn('payroll_runs', 'pay_frequency')) {
            $pdo->prepare(
                'INSERT INTO payroll_runs (id, branch_id, period_start, period_end, pay_date, run_type, pay_frequency, status, processed_by)
                 VALUES (:id, :bid, :ps, :pe, :pd, :rt, :pf, :st, :uid)'
            )->execute([
                'id' => $id,
                'bid' => $data['branch_id'],
                'ps' => $data['period_start'],
                'pe' => $data['period_end'],
                'pd' => $data['pay_date'],
                'rt' => $runType,
                'pf' => $payFrequency,
                'st' => 'draft',
                'uid' => $userId,
            ]);
        } elseif (Schema::hasColumn('payroll_runs', 'run_type')) {
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
        $paidOnly = Schema::hasColumn('payslips', 'payment_status')
            ? " AND ps.payment_status = 'paid'"
            : '';
        $stmt = Database::connection()->prepare(
            "SELECT ps.*, pr.period_start, pr.period_end, pr.pay_date, pr.status AS run_status
             FROM payslips ps
             INNER JOIN payroll_runs pr ON pr.id = ps.payroll_run_id
             WHERE ps.employee_id = :eid{$paidOnly}
             ORDER BY pr.pay_date DESC"
        );
        $stmt->execute(['eid' => $employeeId]);
        return $stmt->fetchAll();
    }

    /**
     * @return array{items: list<array<string, mixed>>, total: int, page: int, limit: int, pages: int}
     */
    public function payslips(
        ?string $runId = null,
        string $q = '',
        int $page = 1,
        int $limit = 25,
    ): array {
        if (!$runId) {
            return $this->paginatedResult([], 0, $page, $limit);
        }

        $page = max(1, $page);
        $limit = max(1, min(100, $limit));
        $offset = ($page - 1) * $limit;

        $where = ' WHERE ps.payroll_run_id = :rid';
        $params = ['rid' => $runId];
        if ($q !== '') {
            $where .= ' AND (e.first_name LIKE :q OR e.last_name LIKE :q OR e.emp_number LIKE :q'
                . ' OR CONCAT(e.first_name, \' \', e.last_name) LIKE :q)';
            $params['q'] = '%' . $q . '%';
        }

        $pdo = Database::connection();
        $countStmt = $pdo->prepare(
            'SELECT COUNT(*) FROM payslips ps INNER JOIN employees e ON e.id = ps.employee_id' . $where
        );
        $countStmt->execute($params);
        $total = (int) $countStmt->fetchColumn();

        $sql = 'SELECT ps.*, e.emp_number, e.first_name, e.last_name
                FROM payslips ps
                INNER JOIN employees e ON e.id = ps.employee_id' . $where
                . ' ORDER BY e.last_name, e.first_name LIMIT :lim OFFSET :off';
        $stmt = $pdo->prepare($sql);
        foreach ($params as $key => $value) {
            $stmt->bindValue(':' . $key, $value);
        }
        $stmt->bindValue(':lim', $limit, \PDO::PARAM_INT);
        $stmt->bindValue(':off', $offset, \PDO::PARAM_INT);
        $stmt->execute();

        return $this->paginatedResult($stmt->fetchAll(), $total, $page, $limit);
    }

    public function generatePayslips(string $runId, bool $replace = false): array
    {
        $pdo = Database::connection();
        $run = $pdo->prepare('SELECT * FROM payroll_runs WHERE id = :id LIMIT 1');
        $run->execute(['id' => $runId]);
        $runRow = $run->fetch();
        if (!$runRow) {
            throw new \RuntimeException('Payroll run not found');
        }

        if ($replace) {
            $this->assertCanRegenerate($runRow);
            (new LoanService())->reversePayrollDeductions($runId);
            $pdo->prepare('DELETE FROM payslips WHERE payroll_run_id = :id')->execute(['id' => $runId]);
        }

        if (($runRow['run_type'] ?? 'regular') === '13th_month') {
            return $this->generate13thMonthPayslips($runId, $runRow, $replace);
        }

        $branchId = (string) $runRow['branch_id'];
        $payFrequency = (string) ($runRow['pay_frequency'] ?? 'semi_monthly');

        $payCols = Schema::hasColumn('employees', 'pay_basis') && Schema::hasColumn('employees', 'pay_rate')
            ? 'e.pay_basis, e.pay_rate,'
            : '';
        $emps = $pdo->prepare(
            "SELECT e.id, {$payCols} COALESCE(e.pay_rate, p.min_hourly, 80) AS rate
             FROM employees e
             LEFT JOIN positions p ON p.id = e.position_id
             WHERE e.branch_id = :b AND e.status = 'active'"
        );
        $emps->execute(['b' => $branchId]);
        $created = 0;
        $updated = 0;

        foreach ($emps->fetchAll() as $emp) {
            $employeeId = (string) $emp['id'];
            $existingId = $this->existingPayslipId($runId, $employeeId);
            if ($existingId && !$replace) {
                continue;
            }

            $row = $this->computeRegularPayslip($runRow, $employeeId, $this->payConfigFromRow($emp), $payFrequency);
            $cashAdvance = 0.0;
            foreach ((new PayrollAdjustmentService())->list($employeeId, $runId) as $adj) {
                if (in_array((string) ($adj['adj_type'] ?? ''), ['advance', 'penalty'], true)) {
                    $cashAdvance += (float) ($adj['amount'] ?? 0);
                }
            }
            $loanDeduction = (new LoanService())->applyPayrollDeduction(
                $employeeId,
                $runId,
                (string) $runRow['pay_date']
            );
            $housing = $this->housingDeductionForEmployee($employeeId);
            $row = $this->finalizePayslipAmounts($row, $loanDeduction, round($cashAdvance, 2), $housing);

            if ($existingId) {
                $this->updatePayslipRow($existingId, $row);
                $updated++;
            } else {
                $this->insertPayslipRow($runId, $employeeId, $row);
                $existingId = $this->existingPayslipId($runId, $employeeId);
                $created++;
            }
            if ($existingId && Schema::hasColumn('payslips', 'payment_status')) {
                $pdo->prepare(
                    "UPDATE payslips SET payment_status = 'ready', paid_at = NULL WHERE id = :id"
                )->execute(['id' => $existingId]);
            }
            $this->clearDeferral($runId, $employeeId);
        }

        return $this->finalizeRun($runId, $created + $updated);
    }

    /** @param array<string, mixed> $empPay */
    private function payConfigFromRow(array $empPay): array
    {
        $rate = (float) ($empPay['rate'] ?? 80);
        $basis = (string) ($empPay['pay_basis'] ?? 'hourly');

        return [
            'basis' => $basis === 'daily' ? 'daily' : 'hourly',
            'rate' => $rate,
            'hourly' => $basis === 'daily' ? ($rate > 0 ? $rate / 8 : 0) : $rate,
        ];
    }

    /** @param list<string>|null $includedDates */
    /** @param array{basis: string, rate: float, hourly: float} $pay */
    private function computeRegularPayslip(
        array $runRow,
        string $employeeId,
        array $pay,
        string $payFrequency,
        ?array $includedDates = null
    ): array {
        $pdo = Database::connection();
        $periodStart = (string) $runRow['period_start'];
        $periodEnd = (string) $runRow['period_end'];
        $branchId = (string) $runRow['branch_id'];
        $hourly = (float) $pay['hourly'];
        $rate = (float) $pay['rate'];

        if ($pay['basis'] === 'daily') {
            $regularHours = $this->countPayDays($pdo, $employeeId, $periodStart, $periodEnd, $includedDates);
            $basicPay = round($regularHours * $rate, 2);
        } else {
            $regularHours = $this->sumPayHours($pdo, $employeeId, $periodStart, $periodEnd, $includedDates);
            $basicPay = round($regularHours * $rate, 2);
        }

        $holidayService = new HolidayService();
        $holidayHours = $holidayService->holidayHoursInPeriod($employeeId, $periodStart, $periodEnd, $branchId);
        $holidayPay = $holidayService->holidayPremiumPay($employeeId, $periodStart, $periodEnd, $branchId, $hourly);

        $overtimeHours = $this->approvedOvertimeHours($employeeId, $periodStart, $periodEnd);
        $overtimePay = round($overtimeHours * $hourly * 1.25, 2);

        $benefitsAmount = (new BenefitService())->periodTotalForEmployee($employeeId, $payFrequency);

        $adj = (new PayrollAdjustmentService())->totalsForEmployee($employeeId, (string) $runRow['id']);
        $adjNet = (float) $adj['net'];
        $adjDebits = max(0, -(float) $adj['net']);

        $gross = round(
            $basicPay + $holidayPay + $overtimePay + $benefitsAmount + max(0, $adjNet),
            2
        );

        $deductions = PhDeductionCalculator::forPayPeriod($gross, $payFrequency);

        return [
            'regular_hours' => $regularHours,
            'overtime_hours' => $overtimeHours,
            'holiday_hours' => $holidayHours,
            'basic_pay' => $basicPay,
            'overtime_pay' => $overtimePay,
            'holiday_pay' => $holidayPay,
            'tips_amount' => 0.0,
            'benefits_amount' => $benefitsAmount,
            'gross_pay' => $gross,
            'sss_amount' => $deductions['sss'],
            'philhealth_amount' => $deductions['philhealth'],
            'pagibig_amount' => $deductions['pagibig'],
            'tax_amount' => $deductions['tax'],
            'other_deductions' => $adjDebits,
            'net_pay' => 0,
            'adj_debits' => $adjDebits,
        ];
    }

    private function existingPayslipId(string $runId, string $employeeId): ?string
    {
        $stmt = Database::connection()->prepare(
            'SELECT id FROM payslips WHERE payroll_run_id = :r AND employee_id = :e LIMIT 1'
        );
        $stmt->execute(['r' => $runId, 'e' => $employeeId]);
        $id = $stmt->fetchColumn();

        return $id ? (string) $id : null;
    }

    /** @param array<string, float> $row */
    private function insertPayslipRow(string $runId, string $employeeId, array $row): void
    {
        $hasHolidayPay = Schema::hasColumn('payslips', 'holiday_pay');
        $pdo = Database::connection();
        if ($hasHolidayPay) {
            $pdo->prepare(
                'INSERT INTO payslips (id, payroll_run_id, employee_id, regular_hours, overtime_hours, holiday_hours,
                 basic_pay, overtime_pay, holiday_pay, tips_amount, service_charge, gross_pay,
                 sss_amount, philhealth_amount, pagibig_amount, tax_amount, other_deductions, net_pay, generated_at)
                 VALUES (UUID(), :rid, :eid, :rh, :oth, :hh, :bp, :otp, :hp, :tips, :svc, :gp, :sss, :ph, :pg, :tax, :other, :net, NOW())'
            )->execute($this->payslipParams($runId, $employeeId, $row));
            return;
        }
        $pdo->prepare(
            'INSERT INTO payslips (id, payroll_run_id, employee_id, regular_hours, overtime_hours, holiday_hours,
             basic_pay, overtime_pay, tips_amount, service_charge, gross_pay,
             sss_amount, philhealth_amount, pagibig_amount, tax_amount, other_deductions, net_pay, generated_at)
             VALUES (UUID(), :rid, :eid, :rh, :oth, :hh, :bp, :otp, :tips, :svc, :gp, :sss, :ph, :pg, :tax, :other, :net, NOW())'
        )->execute($this->payslipParams($runId, $employeeId, $row, false));
    }

    /** @param array<string, float> $row */
    private function updatePayslipRow(string $payslipId, array $row): void
    {
        $hasHolidayPay = Schema::hasColumn('payslips', 'holiday_pay');
        $pdo = Database::connection();
        if ($hasHolidayPay) {
            $pdo->prepare(
                'UPDATE payslips SET regular_hours = :rh, overtime_hours = :oth, holiday_hours = :hh,
                 basic_pay = :bp, overtime_pay = :otp, holiday_pay = :hp, tips_amount = :tips, service_charge = :svc,
                 gross_pay = :gp, sss_amount = :sss, philhealth_amount = :ph, pagibig_amount = :pg,
                 tax_amount = :tax, other_deductions = :other, net_pay = :net, generated_at = NOW()
                 WHERE id = :id'
            )->execute(array_merge($this->payslipParams('', '', $row), ['id' => $payslipId]));
            return;
        }
        $pdo->prepare(
            'UPDATE payslips SET regular_hours = :rh, overtime_hours = :oth, holiday_hours = :hh,
             basic_pay = :bp, overtime_pay = :otp, tips_amount = :tips, service_charge = :svc,
             gross_pay = :gp, sss_amount = :sss, philhealth_amount = :ph, pagibig_amount = :pg,
             tax_amount = :tax, other_deductions = :other, net_pay = :net, generated_at = NOW()
             WHERE id = :id'
        )->execute(array_merge($this->payslipParams('', '', $row, false), ['id' => $payslipId]));
    }

    /** @param array<string, float> $row */
    /** @param array<string, float> $row */
    private function payslipParams(string $runId, string $employeeId, array $row, bool $withHolidayPay = true): array
    {
        $params = [
            'rh' => $row['regular_hours'],
            'oth' => $row['overtime_hours'],
            'hh' => $row['holiday_hours'],
            'bp' => $row['basic_pay'],
            'otp' => $row['overtime_pay'],
            'tips' => $row['tips_amount'],
            'svc' => $row['benefits_amount'],
            'gp' => $row['gross_pay'],
            'sss' => $row['sss_amount'],
            'ph' => $row['philhealth_amount'],
            'pg' => $row['pagibig_amount'],
            'tax' => $row['tax_amount'],
            'other' => $row['other_deductions'],
            'net' => $row['net_pay'],
        ];
        if ($withHolidayPay) {
            $params['hp'] = $row['holiday_pay'];
        }
        if ($runId !== '') {
            $params['rid'] = $runId;
            $params['eid'] = $employeeId;
        }

        return $params;
    }

    private function assertCanRegenerate(array $runRow): void
    {
        $status = (string) ($runRow['status'] ?? '');
        if (!in_array($status, ['draft', 'processing'], true)) {
            throw new \RuntimeException('Can only regenerate draft or processing payroll runs');
        }
    }

    public function generate13thMonthPayslips(string $runId, ?array $runRow = null, bool $replace = false): array
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
            $existingId = $this->existingPayslipId($runId, $employeeId);
            if ($existingId && !$replace) {
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

            $tax = PhDeductionCalculator::thirteenthMonthTax($thirteenth);
            $net = round($thirteenth - $tax, 2);

            if ($existingId) {
                $pdo->prepare(
                    'UPDATE payslips SET regular_hours = 0, basic_pay = :bp, gross_pay = :gp,
                     tax_amount = :tax, other_deductions = 0, net_pay = :net, generated_at = NOW()
                     WHERE id = :id'
                )->execute(['bp' => $thirteenth, 'gp' => $thirteenth, 'tax' => $tax, 'net' => $net, 'id' => $existingId]);
            } else {
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
            }
            $created++;
        }

        return $this->finalizeRun($runId, $created);
    }

    private function finalizeRun(string $runId, int $created): array
    {
        $this->syncRunDisbursementStatus($runId);

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

    /** @return list<string> */
    public function periodDateList(string $start, string $end): array
    {
        $dates = [];
        $d = new \DateTimeImmutable($start);
        $endDt = new \DateTimeImmutable($end);
        while ($d <= $endDt) {
            $dates[] = $d->format('Y-m-d');
            $d = $d->modify('+1 day');
        }

        return $dates;
    }

    /** @return list<array<string, mixed>> */
    public function attendanceByPeriodDay(string $employeeId, string $periodStart, string $periodEnd): array
    {
        $pdo = Database::connection();
        $stmt = $pdo->prepare(
            'SELECT DATE(clock_in) AS work_date, clock_in, clock_out, actual_hours, overtime_hours
             FROM attendance
             WHERE employee_id = :e AND DATE(clock_in) BETWEEN :ps AND :pe
             ORDER BY clock_in'
        );
        $stmt->execute(['e' => $employeeId, 'ps' => $periodStart, 'pe' => $periodEnd]);
        $byDate = [];
        foreach ($stmt->fetchAll() as $row) {
            $byDate[(string) $row['work_date']] = $row;
        }

        $out = [];
        foreach ($this->periodDateList($periodStart, $periodEnd) as $date) {
            $att = $byDate[$date] ?? null;
            $out[] = [
                'date' => $date,
                'present' => $att !== null,
                'clock_in' => $att['clock_in'] ?? null,
                'clock_out' => $att['clock_out'] ?? null,
                'actual_hours' => $att !== null ? (float) $att['actual_hours'] : 0.0,
                'overtime_hours' => $att !== null ? (float) ($att['overtime_hours'] ?? 0) : 0.0,
            ];
        }

        return $out;
    }

    /**
     * @return array{
     *   run: array<string, mixed>,
     *   employees: list<array<string, mixed>>,
     *   summary: array<string, int|float>,
     *   total: int,
     *   page: int,
     *   limit: int,
     *   pages: int
     * }
     */
    public function runRoster(string $runId, string $q = '', int $page = 1, int $limit = 25): array
    {
        $run = $this->getRun($runId);
        if (!$run) {
            throw new \RuntimeException('Payroll run not found');
        }

        $page = max(1, $page);
        $limit = max(1, min(100, $limit));
        $offset = ($page - 1) * $limit;
        $total = $this->countRosterEmployees($run, $q);
        $roster = $this->buildRosterEntries($runId, $run, $q, $limit, $offset);
        $pageMeta = $this->paginatedResult([], $total, $page, $limit);

        return [
            'run' => $run,
            'employees' => $roster,
            'summary' => $this->disbursementSummary($runId),
            'total' => $pageMeta['total'],
            'page' => $pageMeta['page'],
            'limit' => $pageMeta['limit'],
            'pages' => $pageMeta['pages'],
        ];
    }

    /** @param array<string, mixed> $run */
    private function countRosterEmployees(array $run, string $q = ''): int
    {
        [$searchSql, $searchParams] = $this->rosterSearchClause($q);
        $pdo = Database::connection();
        $stmt = $pdo->prepare(
            "SELECT COUNT(*) FROM employees e
             WHERE e.branch_id = :b AND e.status = 'active'{$searchSql}"
        );
        $stmt->execute(array_merge(['b' => $run['branch_id']], $searchParams));

        return (int) $stmt->fetchColumn();
    }

    /**
     * @return array{0: string, 1: array<string, string>}
     */
    private function rosterSearchClause(string $q): array
    {
        if ($q === '') {
            return ['', []];
        }

        return [
            ' AND (e.first_name LIKE :q OR e.last_name LIKE :q OR e.emp_number LIKE :q'
                . ' OR CONCAT(e.first_name, \' \', e.last_name) LIKE :q)',
            ['q' => '%' . $q . '%'],
        ];
    }

    /**
     * @param array<string, mixed> $run
     * @return list<array<string, mixed>>
     */
    private function buildRosterEntries(
        string $runId,
        array $run,
        string $q = '',
        ?int $limit = null,
        ?int $offset = null,
    ): array {
        $pdo = Database::connection();
        $payCols = Schema::hasColumn('employees', 'pay_basis') && Schema::hasColumn('employees', 'pay_rate')
            ? 'e.pay_basis, e.pay_rate,'
            : '';
        [$searchSql, $searchParams] = $this->rosterSearchClause($q);
        $sql = "SELECT e.id, e.emp_number, e.first_name, e.last_name, {$payCols}
                    COALESCE(e.pay_rate, p.min_hourly, 80) AS rate,
                    p.title AS position_title, d.name AS department_name
             FROM employees e
             LEFT JOIN positions p ON p.id = e.position_id
             LEFT JOIN departments d ON d.id = e.department_id
             WHERE e.branch_id = :b AND e.status = 'active'{$searchSql}
             ORDER BY e.last_name, e.first_name";
        if ($limit !== null) {
            $sql .= ' LIMIT :lim OFFSET :off';
        }
        $emps = $pdo->prepare($sql);
        $emps->bindValue(':b', $run['branch_id']);
        foreach ($searchParams as $key => $value) {
            $emps->bindValue(':' . $key, $value);
        }
        if ($limit !== null) {
            $emps->bindValue(':lim', $limit, \PDO::PARAM_INT);
            $emps->bindValue(':off', $offset ?? 0, \PDO::PARAM_INT);
        }
        $emps->execute();

        $periodStart = (string) $run['period_start'];
        $periodEnd = (string) $run['period_end'];
        $roster = [];

        foreach ($emps->fetchAll() as $emp) {
            $employeeId = (string) $emp['id'];
            $pay = $this->payConfigFromRow($emp);
            $daysOrHours = $pay['basis'] === 'daily'
                ? $this->countPayDays($pdo, $employeeId, $periodStart, $periodEnd, null)
                : $this->sumPayHours($pdo, $employeeId, $periodStart, $periodEnd, null);

            $payslipId = $this->existingPayslipId($runId, $employeeId);
            $payslip = null;
            if ($payslipId) {
                $cols = 'id, net_pay, gross_pay, regular_hours';
                if (Schema::hasColumn('payslips', 'payment_status')) {
                    $cols .= ', payment_status';
                }
                $ps = $pdo->prepare("SELECT {$cols} FROM payslips WHERE id = :id");
                $ps->execute(['id' => $payslipId]);
                $payslip = $ps->fetch() ?: null;
            }

            $roster[] = [
                'employee_id' => $employeeId,
                'emp_number' => $emp['emp_number'],
                'first_name' => $emp['first_name'],
                'last_name' => $emp['last_name'],
                'position_title' => $emp['position_title'],
                'department_name' => $emp['department_name'],
                'pay_basis' => $pay['basis'],
                'pay_rate' => $pay['rate'],
                'days_or_hours' => $daysOrHours,
                'payslip_id' => $payslipId,
                'payslip_net' => $payslip ? (float) $payslip['net_pay'] : null,
                'payslip_gross' => $payslip ? (float) $payslip['gross_pay'] : null,
                'payment_status' => $this->disbursementStatusFor($runId, $employeeId, $payslip),
                'defer_note' => $this->deferNoteFor($runId, $employeeId),
            ];
        }

        return $roster;
    }

    /** @param list<array<string, mixed>> $roster */
    /** @return array<string, int|float> */
    private function summarizeRosterEntries(array $roster): array
    {
        $counts = ['pending' => 0, 'ready' => 0, 'paid' => 0, 'deferred' => 0];
        $netReady = 0.0;
        $netPaid = 0.0;
        foreach ($roster as $emp) {
            $st = (string) ($emp['payment_status'] ?? 'pending');
            if (isset($counts[$st])) {
                $counts[$st]++;
            }
            if ($st === 'ready' && $emp['payslip_net'] !== null) {
                $netReady += (float) $emp['payslip_net'];
            }
            if ($st === 'paid' && $emp['payslip_net'] !== null) {
                $netPaid += (float) $emp['payslip_net'];
            }
        }

        return [
            'total_employees' => count($roster),
            'pending' => $counts['pending'],
            'ready' => $counts['ready'],
            'paid' => $counts['paid'],
            'deferred' => $counts['deferred'],
            'net_ready' => round($netReady, 2),
            'net_paid' => round($netPaid, 2),
        ];
    }

    /** @param list<string>|null $includedDates */
    public function prepareEmployee(
        string $runId,
        string $employeeId,
        ?array $includedDates = null,
        bool $attendanceEditMode = false
    ): array
    {
        $run = $this->getRun($runId);
        if (!$run) {
            throw new \RuntimeException('Payroll run not found');
        }

        $pdo = Database::connection();
        $payCols = Schema::hasColumn('employees', 'pay_basis') && Schema::hasColumn('employees', 'pay_rate')
            ? 'e.pay_basis, e.pay_rate,'
            : '';
        $empStmt = $pdo->prepare(
            "SELECT e.id, e.emp_number, e.first_name, e.last_name, e.branch_id, {$payCols}
                    COALESCE(e.pay_rate, p.min_hourly, 80) AS rate,
                    p.title AS position_title, d.name AS department_name
             FROM employees e
             LEFT JOIN positions p ON p.id = e.position_id
             LEFT JOIN departments d ON d.id = e.department_id
             WHERE e.id = :id AND e.branch_id = :bid LIMIT 1"
        );
        $empStmt->execute(['id' => $employeeId, 'bid' => $run['branch_id']]);
        $emp = $empStmt->fetch();
        if (!$emp) {
            throw new \InvalidArgumentException('Employee not in this payroll branch');
        }

        $periodStart = (string) $run['period_start'];
        $periodEnd = (string) $run['period_end'];
        $pay = $this->payConfigFromRow($emp);
        $payFrequency = (string) ($run['pay_frequency'] ?? 'semi_monthly');

        $attendance = $this->attendanceByPeriodDay($employeeId, $periodStart, $periodEnd);
        if ($includedDates === null) {
            $includedDates = array_values(array_map(
                static fn (array $d) => $d['date'],
                array_filter($attendance, static fn (array $d) => $d['present'])
            ));
        }

        $adjustments = (new PayrollAdjustmentService())->list($employeeId, $runId);
        $cashAdvance = 0.0;
        foreach ($adjustments as $adj) {
            if (in_array((string) ($adj['adj_type'] ?? ''), ['advance', 'penalty'], true)) {
                $cashAdvance += (float) ($adj['amount'] ?? 0);
            }
        }
        $cashAdvance = round($cashAdvance, 2);

        $computed = $this->computeRegularPayslip($run, $employeeId, $pay, $payFrequency, $includedDates);
        $loanEst = (new LoanService())->estimatedPayrollDeduction($employeeId);
        $housing = $this->housingDeductionForEmployee($employeeId);
        $preview = $this->finalizePayslipAmounts($computed, $loanEst, $cashAdvance, $housing);
        $preview['loan_deduction'] = $loanEst;
        $preview['cash_advance'] = $cashAdvance;
        $preview['housing_deduction'] = $housing;

        $payslipId = $this->existingPayslipId($runId, $employeeId);
        $payslip = $payslipId ? $this->getPayslip($payslipId) : null;

        if ($payslip && !$attendanceEditMode) {
            foreach (
                [
                    'regular_hours',
                    'basic_pay',
                    'overtime_pay',
                    'gross_pay',
                    'sss_amount',
                    'philhealth_amount',
                    'pagibig_amount',
                    'tax_amount',
                    'other_deductions',
                    'net_pay',
                ] as $field
            ) {
                if (isset($payslip[$field])) {
                    $preview[$field] = (float) $payslip[$field];
                }
            }
            $preview['loan_deduction'] = (float) ($payslip['loan_deduction'] ?? $loanEst);
            $preview['cash_advance'] = (float) ($payslip['cash_advance'] ?? $cashAdvance);
            $preview['housing_deduction'] = (float) ($payslip['housing_deduction'] ?? $housing);
        }

        $loans = (new LoanService())->list($employeeId);
        $activeLoans = array_values(array_filter(
            $loans,
            static fn (array $l) => ($l['status'] ?? '') === 'active' && (float) ($l['balance'] ?? 0) > 0
        ));

        return [
            'run' => $run,
            'employee' => $emp,
            'pay_basis' => $pay['basis'],
            'pay_rate' => $pay['rate'],
            'attendance' => $attendance,
            'included_dates' => $includedDates,
            'preview' => $preview,
            'loans' => $activeLoans,
            'adjustments' => $adjustments,
            'payslip' => $payslip,
            'can_edit' => in_array((string) ($run['status'] ?? ''), ['draft', 'processing', 'partially_paid'], true),
        ];
    }

    /** @param list<string>|null $includedDates */
    public function generatePayslipForEmployee(string $runId, string $employeeId, array $options = []): array
    {
        $pdo = Database::connection();
        $run = $this->getRun($runId);
        if (!$run) {
            throw new \RuntimeException('Payroll run not found');
        }
        if (!in_array((string) ($run['status'] ?? ''), ['draft', 'processing', 'partially_paid'], true)) {
            throw new \RuntimeException('Cannot generate payslips for a closed payroll run');
        }

        $this->clearDeferral($runId, $employeeId);

        $includedDates = $options['included_dates'] ?? null;
        if (is_array($includedDates)) {
            $includedDates = array_values(array_filter(array_map('strval', $includedDates)));
        }

        $overrides = is_array($options['overrides'] ?? null) ? $options['overrides'] : [];
        $payFrequency = (string) ($run['pay_frequency'] ?? 'semi_monthly');

        $payCols = Schema::hasColumn('employees', 'pay_basis') && Schema::hasColumn('employees', 'pay_rate')
            ? 'e.pay_basis, e.pay_rate,'
            : '';
        $empStmt = $pdo->prepare(
            "SELECT e.id, {$payCols} COALESCE(e.pay_rate, p.min_hourly, 80) AS rate
             FROM employees e
             LEFT JOIN positions p ON p.id = e.position_id
             WHERE e.id = :id AND e.branch_id = :bid LIMIT 1"
        );
        $empStmt->execute(['id' => $employeeId, 'bid' => $run['branch_id']]);
        $emp = $empStmt->fetch();
        if (!$emp) {
            throw new \InvalidArgumentException('Employee not in this payroll branch');
        }

        $row = $this->computeRegularPayslip($run, $employeeId, $this->payConfigFromRow($emp), $payFrequency, $includedDates);

        foreach (['sss_amount', 'philhealth_amount', 'pagibig_amount', 'tax_amount'] as $field) {
            if (array_key_exists($field, $overrides) && $overrides[$field] !== '' && $overrides[$field] !== null) {
                $row[$field] = round((float) $overrides[$field], 2);
            }
        }

        $cashAdvance = round((float) ($overrides['cash_advance'] ?? 0), 2);
        $loanDeduction = array_key_exists('loan_deduction', $overrides) && $overrides['loan_deduction'] !== ''
            ? round((float) $overrides['loan_deduction'], 2)
            : (new LoanService())->applyPayrollDeduction($employeeId, $runId, (string) $run['pay_date']);
        $housing = array_key_exists('housing_deduction', $overrides) && $overrides['housing_deduction'] !== ''
            ? round((float) $overrides['housing_deduction'], 2)
            : $this->housingDeductionForEmployee($employeeId);

        if (array_key_exists('other_deductions', $overrides) && $overrides['other_deductions'] !== '') {
            $row['other_deductions'] = round((float) $overrides['other_deductions'], 2);
            $row = $this->applyNetPay($row);
        } else {
            $row = $this->finalizePayslipAmounts($row, $loanDeduction, $cashAdvance, $housing);
        }

        $existingId = $this->existingPayslipId($runId, $employeeId);
        if ($existingId) {
            $this->updatePayslipRow($existingId, $row);
        } else {
            $this->insertPayslipRow($runId, $employeeId, $row);
            $existingId = $this->existingPayslipId($runId, $employeeId);
        }
        if ($existingId && Schema::hasColumn('payslips', 'payment_status')) {
            Database::connection()->prepare(
                "UPDATE payslips SET payment_status = 'ready', paid_at = NULL WHERE id = :id"
            )->execute(['id' => $existingId]);
        }

        $this->finalizeRun($runId, 1);

        return [
            'payslip' => $existingId ? $this->getPayslip($existingId) : null,
            'run' => $this->getRun($runId),
        ];
    }

    public function updatePayslip(string $payslipId, array $data): ?array
    {
        $existing = $this->getPayslip($payslipId);
        if (!$existing) {
            return null;
        }

        $run = $this->getRun((string) $existing['payroll_run_id']);
        if (!$run || !in_array((string) ($run['status'] ?? ''), ['draft', 'processing', 'partially_paid'], true)) {
            throw new \InvalidArgumentException('Cannot edit payslip on a closed payroll run');
        }
        if (Schema::hasColumn('payslips', 'payment_status') && ($existing['payment_status'] ?? '') === 'paid') {
            throw new \InvalidArgumentException('Cannot edit a payslip that is already paid');
        }

        $row = [
            'regular_hours' => (float) ($existing['regular_hours'] ?? 0),
            'overtime_hours' => (float) ($existing['overtime_hours'] ?? 0),
            'holiday_hours' => (float) ($existing['holiday_hours'] ?? 0),
            'basic_pay' => (float) ($existing['basic_pay'] ?? 0),
            'overtime_pay' => (float) ($existing['overtime_pay'] ?? 0),
            'holiday_pay' => (float) ($existing['holiday_pay'] ?? 0),
            'tips_amount' => 0.0,
            'benefits_amount' => (float) ($existing['service_charge'] ?? 0),
            'gross_pay' => (float) ($existing['gross_pay'] ?? 0),
            'sss_amount' => (float) ($existing['sss_amount'] ?? 0),
            'philhealth_amount' => (float) ($existing['philhealth_amount'] ?? 0),
            'pagibig_amount' => (float) ($existing['pagibig_amount'] ?? 0),
            'tax_amount' => (float) ($existing['tax_amount'] ?? 0),
            'other_deductions' => (float) ($existing['other_deductions'] ?? 0),
            'net_pay' => (float) ($existing['net_pay'] ?? 0),
            'adj_debits' => 0,
        ];

        foreach (
            [
                'sss_amount',
                'philhealth_amount',
                'pagibig_amount',
                'tax_amount',
                'other_deductions',
                'gross_pay',
                'basic_pay',
                'regular_hours',
                'overtime_pay',
                'overtime_hours',
            ] as $field
        ) {
            if (array_key_exists($field, $data) && $data[$field] !== '' && $data[$field] !== null) {
                $row[$field] = round((float) $data[$field], 2);
            }
        }

        $row = $this->applyNetPay($row);
        $this->updatePayslipRow($payslipId, $row);
        $this->finalizeRun((string) $existing['payroll_run_id'], 0);

        return $this->getPayslip($payslipId);
    }

    /** @param list<string>|null $includedDates */
    private function countPayDays(\PDO $pdo, string $employeeId, string $from, string $to, ?array $includedDates): float
    {
        if ($includedDates !== null && count($includedDates) > 0) {
            $placeholders = implode(',', array_fill(0, count($includedDates), '?'));
            $sql = "SELECT COUNT(DISTINCT DATE(clock_in)) FROM attendance
                    WHERE employee_id = ? AND DATE(clock_in) IN ({$placeholders})";
            $stmt = $pdo->prepare($sql);
            $stmt->execute(array_merge([$employeeId], $includedDates));

            return (float) $stmt->fetchColumn();
        }

        $stmt = $pdo->prepare(
            'SELECT COUNT(DISTINCT DATE(clock_in)) FROM attendance
             WHERE employee_id = :e AND DATE(clock_in) BETWEEN :ps AND :pe'
        );
        $stmt->execute(['e' => $employeeId, 'ps' => $from, 'pe' => $to]);

        return (float) $stmt->fetchColumn();
    }

    /** @param list<string>|null $includedDates */
    private function sumPayHours(\PDO $pdo, string $employeeId, string $from, string $to, ?array $includedDates): float
    {
        if ($includedDates !== null && count($includedDates) > 0) {
            $placeholders = implode(',', array_fill(0, count($includedDates), '?'));
            $sql = "SELECT COALESCE(SUM(actual_hours), 0) FROM attendance
                    WHERE employee_id = ? AND DATE(clock_in) IN ({$placeholders})";
            $stmt = $pdo->prepare($sql);
            $stmt->execute(array_merge([$employeeId], $includedDates));

            return round((float) $stmt->fetchColumn(), 2);
        }

        $stmt = $pdo->prepare(
            'SELECT COALESCE(SUM(actual_hours), 0) FROM attendance
             WHERE employee_id = :e AND DATE(clock_in) BETWEEN :ps AND :pe'
        );
        $stmt->execute(['e' => $employeeId, 'ps' => $from, 'pe' => $to]);

        return round((float) $stmt->fetchColumn(), 2);
    }

    /** @param array<string, float> $row */
    private function finalizePayslipAmounts(
        array $row,
        float $loanDeduction,
        float $cashAdvance,
        float $housingDeduction = 0.0
    ): array {
        $row['other_deductions'] = round(
            (float) ($row['adj_debits'] ?? 0) + $loanDeduction + $cashAdvance + $housingDeduction,
            2
        );

        return $this->applyNetPay($row);
    }

    private function housingDeductionForEmployee(string $employeeId): float
    {
        if (!Schema::hasColumn('employees', 'is_stay_in')) {
            return 0.0;
        }
        $stmt = Database::connection()->prepare(
            'SELECT is_stay_in, housing_deduction FROM employees WHERE id = :id LIMIT 1'
        );
        $stmt->execute(['id' => $employeeId]);
        $row = $stmt->fetch();
        if (!$row || !(int) ($row['is_stay_in'] ?? 0)) {
            return 0.0;
        }

        return max(0, round((float) ($row['housing_deduction'] ?? 0), 2));
    }

    /** @param array<string, float> $row */
    private function applyNetPay(array $row): array
    {
        $row['net_pay'] = max(0, round(
            (float) $row['gross_pay']
            - (float) $row['sss_amount']
            - (float) $row['philhealth_amount']
            - (float) $row['pagibig_amount']
            - (float) $row['tax_amount']
            - (float) $row['other_deductions'],
            2
        ));

        return $row;
    }

    public function deferEmployees(string $runId, array $employeeIds, ?string $note, ?string $userId): array
    {
        $run = $this->getRun($runId);
        if (!$run) {
            throw new \RuntimeException('Payroll run not found');
        }
        $this->assertRunOpenForDisbursement($run);

        $pdo = Database::connection();
        $deferred = 0;
        foreach ($employeeIds as $employeeId) {
            $employeeId = (string) $employeeId;
            if ($employeeId === '') {
                continue;
            }
            $payslipId = $this->existingPayslipId($runId, $employeeId);
            if ($payslipId && Schema::hasColumn('payslips', 'payment_status')) {
                $st = $pdo->prepare('SELECT payment_status FROM payslips WHERE id = :id');
                $st->execute(['id' => $payslipId]);
                $status = (string) ($st->fetchColumn() ?: 'ready');
                if ($status === 'paid') {
                    throw new \InvalidArgumentException('Cannot defer an employee who is already paid');
                }
                $pdo->prepare("UPDATE payslips SET payment_status = 'deferred' WHERE id = :id")
                    ->execute(['id' => $payslipId]);
            } elseif ($this->hasDeferralsTable()) {
                $pdo->prepare(
                    'INSERT INTO payroll_run_deferrals (id, payroll_run_id, employee_id, note, deferred_by)
                     VALUES (UUID(), :r, :e, :n, :by)
                     ON DUPLICATE KEY UPDATE note = VALUES(note), deferred_by = VALUES(deferred_by), deferred_at = NOW()'
                )->execute(['r' => $runId, 'e' => $employeeId, 'n' => $note, 'by' => $userId]);
            }
            $deferred++;
        }

        $this->syncRunDisbursementStatus($runId);

        return ['deferred' => $deferred, 'summary' => $this->disbursementSummary($runId)];
    }

    public function undeferEmployees(string $runId, array $employeeIds): array
    {
        $run = $this->getRun($runId);
        if (!$run) {
            throw new \RuntimeException('Payroll run not found');
        }
        $this->assertRunOpenForDisbursement($run);

        $pdo = Database::connection();
        $restored = 0;
        foreach ($employeeIds as $employeeId) {
            $employeeId = (string) $employeeId;
            if ($employeeId === '') {
                continue;
            }
            if ($this->hasDeferralsTable()) {
                $pdo->prepare(
                    'DELETE FROM payroll_run_deferrals WHERE payroll_run_id = :r AND employee_id = :e'
                )->execute(['r' => $runId, 'e' => $employeeId]);
            }
            $payslipId = $this->existingPayslipId($runId, $employeeId);
            if ($payslipId && Schema::hasColumn('payslips', 'payment_status')) {
                $pdo->prepare(
                    "UPDATE payslips SET payment_status = 'ready' WHERE id = :id AND payment_status = 'deferred'"
                )->execute(['id' => $payslipId]);
            }
            $restored++;
        }

        $this->syncRunDisbursementStatus($runId);

        return ['restored' => $restored, 'summary' => $this->disbursementSummary($runId)];
    }

    /** @return array{paid: int, emailed: int, skipped: int, failed: int, summary: array<string, mixed>} */
    public function paySelectedEmployees(string $runId, array $employeeIds, bool $sendPayslips, ?string $userId): array
    {
        $run = $this->getRun($runId);
        if (!$run) {
            throw new \RuntimeException('Payroll run not found');
        }
        $this->assertRunOpenForDisbursement($run);
        if (!Schema::hasColumn('payslips', 'payment_status')) {
            throw new \RuntimeException('Run database patch patch_payroll_selective_disbursement.sql first');
        }

        $pdo = Database::connection();
        $paid = 0;
        $paidIds = [];
        foreach ($employeeIds as $employeeId) {
            $employeeId = (string) $employeeId;
            $payslipId = $this->existingPayslipId($runId, $employeeId);
            if (!$payslipId) {
                throw new \InvalidArgumentException('Generate a payslip before paying this employee');
            }
            $st = $pdo->prepare('SELECT payment_status FROM payslips WHERE id = :id');
            $st->execute(['id' => $payslipId]);
            $status = (string) ($st->fetchColumn() ?: '');
            if ($status !== 'ready') {
                throw new \InvalidArgumentException('Only employees with ready payslips can be paid now');
            }
            $pdo->prepare(
                "UPDATE payslips SET payment_status = 'paid', paid_at = NOW() WHERE id = :id"
            )->execute(['id' => $payslipId]);
            $paidIds[] = $payslipId;
            $paid++;
        }

        $this->syncRunDisbursementStatus($runId);

        $emailResult = ['emailed' => 0, 'skipped' => 0, 'failed' => 0];
        if ($sendPayslips && $paidIds !== []) {
            $mailer = new PayslipMailService();
            foreach ($paidIds as $payslipId) {
                $result = $mailer->sendPayslip($payslipId, $userId);
                if (!empty($result['sent'])) {
                    $emailResult['emailed']++;
                } elseif (!empty($result['skipped'])) {
                    $emailResult['skipped']++;
                } else {
                    $emailResult['failed']++;
                }
            }
        }

        return [
            'paid' => $paid,
            'emailed' => $emailResult['emailed'],
            'skipped' => $emailResult['skipped'],
            'failed' => $emailResult['failed'],
            'summary' => $this->disbursementSummary($runId),
        ];
    }

    /** @return array<string, int|float> */
    public function disbursementSummary(string $runId): array
    {
        $run = $this->getRun($runId);
        if (!$run) {
            throw new \RuntimeException('Payroll run not found');
        }

        return $this->summarizeRosterEntries($this->buildRosterEntries($runId, $run));
    }

    /** @return 'pending'|'ready'|'paid'|'deferred' */
    public function disbursementStatusFor(string $runId, string $employeeId, ?array $payslip): string
    {
        if ($payslip && Schema::hasColumn('payslips', 'payment_status')) {
            $st = (string) ($payslip['payment_status'] ?? 'ready');
            if (in_array($st, ['ready', 'paid', 'deferred'], true)) {
                return $st;
            }
        } elseif ($payslip) {
            return 'ready';
        }
        if ($this->isDeferred($runId, $employeeId)) {
            return 'deferred';
        }

        return 'pending';
    }

    public function deferNoteFor(string $runId, string $employeeId): ?string
    {
        if (!$this->hasDeferralsTable()) {
            return null;
        }
        $stmt = Database::connection()->prepare(
            'SELECT note FROM payroll_run_deferrals WHERE payroll_run_id = :r AND employee_id = :e LIMIT 1'
        );
        $stmt->execute(['r' => $runId, 'e' => $employeeId]);
        $note = $stmt->fetchColumn();

        return is_string($note) && $note !== '' ? $note : null;
    }

    /**
     * @param list<array<string, mixed>> $items
     * @return array{items: list<array<string, mixed>>, total: int, page: int, limit: int, pages: int}
     */
    private function paginatedResult(array $items, int $total, int $page, int $limit): array
    {
        $pages = $total > 0 && $limit > 0 ? (int) ceil($total / $limit) : 0;

        return [
            'items' => $items,
            'total' => $total,
            'page' => $page,
            'limit' => $limit,
            'pages' => $pages,
        ];
    }

    private function syncRunDisbursementStatus(string $runId): void
    {
        $pdo = Database::connection();
        $totals = $pdo->prepare(
            'SELECT COALESCE(SUM(gross_pay), 0) AS g, COALESCE(SUM(net_pay), 0) AS n FROM payslips WHERE payroll_run_id = :id'
        );
        $totals->execute(['id' => $runId]);
        $sum = $totals->fetch() ?: ['g' => 0, 'n' => 0];

        $summary = $this->disbursementSummary($runId);
        $total = (int) ($summary['total_employees'] ?? 0);
        $paid = (int) ($summary['paid'] ?? 0);
        $deferred = (int) ($summary['deferred'] ?? 0);
        $ready = (int) ($summary['ready'] ?? 0);
        $pending = (int) ($summary['pending'] ?? 0);

        $cntStmt = $pdo->prepare('SELECT COUNT(*) FROM payslips WHERE payroll_run_id = :id');
        $cntStmt->execute(['id' => $runId]);
        $payslipCount = (int) $cntStmt->fetchColumn();

        $status = 'draft';
        if ($total > 0 && $paid + $deferred >= $total) {
            $status = 'paid';
        } elseif ($paid > 0 && ($ready > 0 || $pending > 0)) {
            $status = 'partially_paid';
        } elseif ($payslipCount > 0 || $paid > 0 || $ready > 0 || $deferred > 0) {
            $status = 'processing';
        }

        $sql = 'UPDATE payroll_runs SET total_gross = :g, total_net = :n, status = :st';
        if ($status === 'paid') {
            $sql .= ', processed_at = COALESCE(processed_at, NOW())';
        }
        $sql .= ' WHERE id = :id';
        $pdo->prepare($sql)->execute([
            'id' => $runId,
            'g' => $sum['g'],
            'n' => $sum['n'],
            'st' => $status,
        ]);
    }

    private function clearDeferral(string $runId, string $employeeId): void
    {
        if (!$this->hasDeferralsTable()) {
            return;
        }
        Database::connection()->prepare(
            'DELETE FROM payroll_run_deferrals WHERE payroll_run_id = :r AND employee_id = :e'
        )->execute(['r' => $runId, 'e' => $employeeId]);
    }

    private function hasDeferralsTable(): bool
    {
        return Schema::hasTable('payroll_run_deferrals');
    }

    private function isDeferred(string $runId, string $employeeId): bool
    {
        if (!$this->hasDeferralsTable()) {
            return false;
        }
        $stmt = Database::connection()->prepare(
            'SELECT 1 FROM payroll_run_deferrals WHERE payroll_run_id = :r AND employee_id = :e LIMIT 1'
        );
        $stmt->execute(['r' => $runId, 'e' => $employeeId]);

        return (bool) $stmt->fetchColumn();
    }

    /** @param array<string, mixed> $run */
    private function assertRunOpenForDisbursement(array $run): void
    {
        $status = (string) ($run['status'] ?? '');
        if (in_array($status, ['paid', 'cancelled'], true)) {
            throw new \RuntimeException('This payroll run is closed');
        }
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

    public function updateRun(string $id, array $data, ?string $actorUserId = null): ?array
    {
        $existing = $this->getRun($id);
        if (!$existing) {
            return null;
        }

        if (empty($data['status'])) {
            return $existing;
        }

        $status = (string) $data['status'];
        $allowed = ['draft', 'processing', 'partially_paid', 'approved', 'paid', 'cancelled'];
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

        $row = $this->getRun($id);
        if ($row && $status === 'paid' && !empty($data['send_payslips'])) {
            $row['payslip_delivery'] = (new PayslipMailService())->sendRunPayslips($id, $actorUserId);
        }

        return $row;
    }

    /** @return array{sent: int, skipped: int, failed: int, details: list<array<string, mixed>>} */
    public function sendRunPayslips(string $runId, ?string $actorUserId = null): array
    {
        return (new PayslipMailService())->sendRunPayslips($runId, $actorUserId);
    }

    /** @return array<string, mixed> */
    public function sendPayslip(string $payslipId, ?string $actorUserId = null): array
    {
        return (new PayslipMailService())->sendPayslip($payslipId, $actorUserId);
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
            'draft' => ['processing', 'cancelled'],
            'processing' => ['partially_paid', 'paid', 'approved', 'cancelled'],
            'partially_paid' => ['paid', 'processing', 'cancelled'],
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
            'SELECT ps.*, e.emp_number, e.first_name, e.last_name, e.status AS employment_status,
                    e.pay_basis, e.pay_rate,
                    pos.title AS position_title, d.name AS department_name,
                    pr.period_start, pr.period_end, pr.pay_date, pr.status AS run_status,
                    pr.pay_frequency, pr.run_type
             FROM payslips ps
             INNER JOIN employees e ON e.id = ps.employee_id
             LEFT JOIN positions pos ON pos.id = e.position_id
             LEFT JOIN departments d ON d.id = e.department_id
             INNER JOIN payroll_runs pr ON pr.id = ps.payroll_run_id
             WHERE ps.id = :id LIMIT 1'
        );
        $stmt->execute(['id' => $id]);
        $row = $stmt->fetch();
        if (!$row) {
            return null;
        }
        $loanDeduction = $this->loanDeductionForRun((string) $row['employee_id'], (string) $row['payroll_run_id']);
        $otherDeductions = (float) ($row['other_deductions'] ?? 0);
        $row['loan_deduction'] = $loanDeduction;

        $cashAdvance = 0.0;
        $tardiness = 0.0;
        foreach ((new PayrollAdjustmentService())->list((string) $row['employee_id'], (string) $row['payroll_run_id']) as $adj) {
            $type = (string) ($adj['adj_type'] ?? '');
            $amount = (float) ($adj['amount'] ?? 0);
            if ($type === 'advance') {
                $cashAdvance += $amount;
            } elseif ($type === 'penalty') {
                $tardiness += $amount;
            }
        }
        $row['cash_advance'] = round($cashAdvance, 2);
        $row['tardiness'] = round($tardiness, 2);
        $housing = $this->housingDeductionForEmployee((string) $row['employee_id']);
        if ($housing <= 0) {
            $housing = max(0, round($otherDeductions - $loanDeduction - $cashAdvance - $tardiness, 2));
        }
        $row['housing_deduction'] = $housing;
        $row['other_adjustments'] = max(0, round($otherDeductions - $loanDeduction - $housing, 2));

        return $row;
    }

    private function loanDeductionForRun(string $employeeId, string $payrollRunId): float
    {
        $stmt = Database::connection()->prepare(
            "SELECT COALESCE(SUM(lp.amount), 0) AS total
             FROM loan_payments lp
             INNER JOIN employee_loans el ON el.id = lp.loan_id
             WHERE el.employee_id = :eid AND lp.notes = :notes"
        );
        $stmt->execute([
            'eid' => $employeeId,
            'notes' => "Payroll deduction (run {$payrollRunId})",
        ]);

        return round((float) $stmt->fetchColumn(), 2);
    }
}
