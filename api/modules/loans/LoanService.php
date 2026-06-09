<?php

declare(strict_types=1);

namespace Hg\Api\Modules\Loans;

use Hg\Api\Core\Database;
use Hg\Api\Modules\Notifications\NotificationService;

final class LoanService
{
    private const MIN_PRINCIPAL = 100.0;

    public function __construct(
        private readonly NotificationService $notifications = new NotificationService(),
    ) {}

    public function list(?string $employeeId = null, ?string $branchId = null): array
    {
        $sql = 'SELECT l.*, e.emp_number, e.first_name, e.last_name
                FROM employee_loans l
                INNER JOIN employees e ON e.id = l.employee_id
                WHERE 1=1';
        $params = [];
        if ($employeeId) {
            $sql .= ' AND l.employee_id = :eid';
            $params['eid'] = $employeeId;
        }
        if ($branchId) {
            $sql .= ' AND e.branch_id = :bid';
            $params['bid'] = $branchId;
        }
        $sql .= ' ORDER BY l.created_at DESC';
        $stmt = Database::connection()->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll();
    }

    public function get(string $id): ?array
    {
        $stmt = Database::connection()->prepare(
            'SELECT l.*, e.emp_number, e.first_name, e.last_name
             FROM employee_loans l
             INNER JOIN employees e ON e.id = l.employee_id
             WHERE l.id = :id LIMIT 1'
        );
        $stmt->execute(['id' => $id]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public function payments(string $loanId): array
    {
        $stmt = Database::connection()->prepare(
            'SELECT * FROM loan_payments WHERE loan_id = :lid ORDER BY paid_on DESC'
        );
        $stmt->execute(['lid' => $loanId]);
        return $stmt->fetchAll();
    }

    public function apply(array $data): array
    {
        $principal = round((float) ($data['principal'] ?? 0), 2);
        if ($principal < self::MIN_PRINCIPAL) {
            throw new \InvalidArgumentException('Minimum amount is ₱' . number_format(self::MIN_PRINCIPAL, 0));
        }

        $loanType = (string) ($data['loan_type'] ?? 'salary');
        if (!in_array($loanType, ['salary', 'cash_advance'], true)) {
            throw new \InvalidArgumentException('loan_type must be salary or cash_advance');
        }

        $repayment = $this->resolveRepayment($data);
        $payPeriods = $repayment['pay_periods'];
        $monthly = round($principal / $payPeriods, 2);

        $purpose = trim((string) ($data['purpose'] ?? ''));
        $id = Database::uuid();
        Database::connection()->prepare(
            'INSERT INTO employee_loans (
                id, employee_id, loan_type, principal, balance, term_months,
                repayment_schedule, term_duration, monthly_deduction, purpose, status
             )
             VALUES (
                :id, :eid, :type, :principal, :balance, :term,
                :schedule, :duration, :monthly, :purpose, :st
             )'
        )->execute([
            'id' => $id,
            'eid' => $data['employee_id'],
            'type' => $loanType,
            'principal' => $principal,
            'balance' => $principal,
            'term' => $payPeriods,
            'schedule' => $repayment['repayment_schedule'],
            'duration' => $repayment['term_duration'],
            'monthly' => $monthly,
            'purpose' => $purpose !== '' ? $purpose : null,
            'st' => 'pending',
        ]);

        return $this->get($id) ?? [];
    }

    /**
     * @param array<string, mixed> $data
     * @return array{repayment_schedule: string, term_duration: int, pay_periods: int}
     */
    private function resolveRepayment(array $data): array
    {
        $schedule = (string) ($data['repayment_schedule'] ?? 'semi_monthly');
        if (!in_array($schedule, ['semi_monthly', 'one_month'], true)) {
            throw new \InvalidArgumentException('repayment_schedule must be semi_monthly or one_month');
        }

        if ($schedule === 'one_month') {
            return [
                'repayment_schedule' => 'one_month',
                'term_duration' => 1,
                'pay_periods' => 2,
            ];
        }

        $duration = (int) ($data['term_duration'] ?? 2);
        if ($duration < 1 || $duration > 24) {
            throw new \InvalidArgumentException('term_duration must be between 1 and 24 semi-monthly cutoffs');
        }

        return [
            'repayment_schedule' => 'semi_monthly',
            'term_duration' => $duration,
            'pay_periods' => $duration,
        ];
    }

    public function review(string $id, string $status, string $reviewerUserId): ?array
    {
        $loan = $this->get($id);
        if (!$loan || $loan['status'] !== 'pending') {
            return null;
        }
        if (!in_array($status, ['approved', 'rejected'], true)) {
            throw new \RuntimeException('status must be approved or rejected');
        }
        $newStatus = $status === 'approved' ? 'active' : 'rejected';
        Database::connection()->prepare(
            'UPDATE employee_loans SET status = :st, approved_by = :by, approved_at = NOW() WHERE id = :id'
        )->execute(['st' => $newStatus, 'by' => $reviewerUserId, 'id' => $id]);
        $row = $this->get($id);
        if ($row) {
            $this->notifyLoanDecision($row, $status);
        }
        return $row;
    }

    public function recordPayment(string $loanId, array $data): ?array
    {
        $loan = $this->get($loanId);
        if (!$loan || !in_array($loan['status'], ['active', 'approved'], true)) {
            return null;
        }
        $amount = round((float) ($data['amount'] ?? 0), 2);
        if ($amount <= 0) {
            throw new \InvalidArgumentException('amount must be positive');
        }
        $paidOn = (string) ($data['paid_on'] ?? date('Y-m-d'));
        $pdo = Database::connection();
        $pdo->beginTransaction();
        try {
            $paymentId = Database::uuid();
            $pdo->prepare(
                'INSERT INTO loan_payments (id, loan_id, amount, paid_on, notes)
                 VALUES (:id, :lid, :amt, :on, :notes)'
            )->execute([
                'id' => $paymentId,
                'lid' => $loanId,
                'amt' => $amount,
                'on' => $paidOn,
                'notes' => $data['notes'] ?? null,
            ]);
            $newBalance = max(0, round((float) $loan['balance'] - $amount, 2));
            $newStatus = $newBalance <= 0 ? 'paid' : 'active';
            $pdo->prepare(
                'UPDATE employee_loans SET balance = :bal, status = :st WHERE id = :id'
            )->execute(['bal' => $newBalance, 'st' => $newStatus, 'id' => $loanId]);
            $pdo->commit();
        } catch (\Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }
        $stmt = Database::connection()->prepare('SELECT * FROM loan_payments WHERE id = :id');
        $stmt->execute(['id' => $paymentId]);
        return $stmt->fetch() ?: null;
    }

    public function reversePayrollDeductions(string $payrollRunId): void
    {
        $note = "Payroll deduction (run {$payrollRunId})";
        $pdo = Database::connection();
        $stmt = $pdo->prepare('SELECT id, loan_id, amount FROM loan_payments WHERE notes = :notes');
        $stmt->execute(['notes' => $note]);
        foreach ($stmt->fetchAll() as $payment) {
            $loanStmt = $pdo->prepare('SELECT balance, status FROM employee_loans WHERE id = :id LIMIT 1');
            $loanStmt->execute(['id' => $payment['loan_id']]);
            $loan = $loanStmt->fetch();
            if (!$loan) {
                continue;
            }
            $newBalance = round((float) $loan['balance'] + (float) $payment['amount'], 2);
            $pdo->prepare(
                'UPDATE employee_loans SET balance = :bal, status = :st WHERE id = :id'
            )->execute([
                'bal' => $newBalance,
                'st' => $newBalance > 0 ? 'active' : $loan['status'],
                'id' => $payment['loan_id'],
            ]);
            $pdo->prepare('DELETE FROM loan_payments WHERE id = :id')->execute(['id' => $payment['id']]);
        }
    }

    public function estimatedPayrollDeduction(string $employeeId): float
    {
        $stmt = Database::connection()->prepare(
            "SELECT balance, monthly_deduction FROM employee_loans
             WHERE employee_id = :eid AND status = 'active' AND balance > 0"
        );
        $stmt->execute(['eid' => $employeeId]);
        $total = 0.0;
        foreach ($stmt->fetchAll() as $loan) {
            $total += min((float) $loan['monthly_deduction'], (float) $loan['balance']);
        }

        return round($total, 2);
    }

    public function applyPayrollDeduction(string $employeeId, string $payrollRunId, string $payDate): float
    {
        $pdo = Database::connection();
        $stmt = $pdo->prepare(
            "SELECT id, balance, monthly_deduction FROM employee_loans
             WHERE employee_id = :eid AND status = 'active' AND balance > 0"
        );
        $stmt->execute(['eid' => $employeeId]);
        $total = 0.0;
        foreach ($stmt->fetchAll() as $loan) {
            $deduct = min((float) $loan['monthly_deduction'], (float) $loan['balance']);
            if ($deduct <= 0) {
                continue;
            }
            $note = "Payroll deduction (run {$payrollRunId})";
            $exists = $pdo->prepare(
                'SELECT id FROM loan_payments WHERE loan_id = :lid AND notes = :notes LIMIT 1'
            );
            $exists->execute(['lid' => $loan['id'], 'notes' => $note]);
            if ($exists->fetch()) {
                continue;
            }
            $paymentId = Database::uuid();
            $pdo->prepare(
                'INSERT INTO loan_payments (id, loan_id, amount, paid_on, notes)
                 VALUES (:id, :lid, :amt, :on, :notes)'
            )->execute([
                'id' => $paymentId,
                'lid' => $loan['id'],
                'amt' => $deduct,
                'on' => $payDate,
                'notes' => $note,
            ]);
            $newBalance = max(0, round((float) $loan['balance'] - $deduct, 2));
            $pdo->prepare(
                'UPDATE employee_loans SET balance = :bal, status = :st WHERE id = :id'
            )->execute([
                'bal' => $newBalance,
                'st' => $newBalance <= 0 ? 'paid' : 'active',
                'id' => $loan['id'],
            ]);
            $total += $deduct;
        }
        return round($total, 2);
    }

    private function repaymentSummary(array $loan): string
    {
        $schedule = (string) ($loan['repayment_schedule'] ?? 'semi_monthly');
        if ($schedule === 'one_month') {
            return 'Term: 1 month (2 cutoffs).';
        }
        $duration = (int) ($loan['term_duration'] ?? $loan['term_months'] ?? 1);

        return "Term: {$duration} semi-monthly cutoff" . ($duration === 1 ? '' : 's') . '.';
    }

    private function notifyLoanDecision(array $loan, string $status): void
    {
        $userId = $this->notifications->userIdForEmployee((string) $loan['employee_id']);
        if (!$userId) {
            return;
        }
        $amount = number_format((float) $loan['principal'], 2);
        $term = $this->repaymentSummary($loan);
        if ($status === 'approved') {
            $this->notifications->create(
                $userId,
                'loan_approved',
                'Loan approved',
                "Your loan application for ₱{$amount} was approved. {$term} Deduction per cutoff: ₱{$loan['monthly_deduction']}.",
                $loan['id'],
                '/loans'
            );
            return;
        }
        $this->notifications->create(
            $userId,
            'loan_rejected',
            'Loan declined',
            "Your loan application for ₱{$amount} was declined.",
            $loan['id'],
            '/loans'
        );
    }
}
