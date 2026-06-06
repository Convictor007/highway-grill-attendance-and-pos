<?php

declare(strict_types=1);

namespace Hg\Api\Modules\Loans;

use Hg\Api\Core\Database;
use Hg\Api\Modules\Notifications\NotificationService;

final class LoanService
{
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
        $principal = (float) $data['principal'];
        $term = max(1, (int) ($data['term_months'] ?? 6));
        $monthly = round($principal / $term, 2);
        $id = Database::uuid();
        Database::connection()->prepare(
            'INSERT INTO employee_loans (id, employee_id, loan_type, principal, balance, term_months, monthly_deduction, purpose, status)
             VALUES (:id, :eid, :type, :principal, :balance, :term, :monthly, :purpose, :st)'
        )->execute([
            'id' => $id,
            'eid' => $data['employee_id'],
            'type' => $data['loan_type'] ?? 'salary',
            'principal' => $principal,
            'balance' => $principal,
            'term' => $term,
            'monthly' => $monthly,
            'purpose' => $data['purpose'] ?? null,
            'st' => 'pending',
        ]);
        return $this->get($id) ?? [];
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

    private function notifyLoanDecision(array $loan, string $status): void
    {
        $userId = $this->notifications->userIdForEmployee((string) $loan['employee_id']);
        if (!$userId) {
            return;
        }
        $amount = number_format((float) $loan['principal'], 2);
        if ($status === 'approved') {
            $this->notifications->create(
                $userId,
                'loan_approved',
                'Loan approved',
                "Your loan application for ₱{$amount} was approved. Monthly deduction: ₱{$loan['monthly_deduction']}.",
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
