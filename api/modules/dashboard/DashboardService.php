<?php

declare(strict_types=1);

namespace Hg\Api\Modules\Dashboard;

use Hg\Api\Core\Database;

final class DashboardService
{
    public function summary(?string $branchId = null): array
    {
        $pdo = Database::connection();
        $today = date('Y-m-d');

        $empSql = "SELECT COUNT(*) FROM employees WHERE status = 'active'";
        $params = [];
        if ($branchId) {
            $empSql .= ' AND branch_id = :b';
            $params['b'] = $branchId;
        }
        $stmt = $pdo->prepare($empSql);
        $stmt->execute($params);
        $activeEmployees = (int) $stmt->fetchColumn();

        $attSql = 'SELECT COUNT(DISTINCT a.employee_id) FROM attendance a
                   INNER JOIN employees e ON e.id = a.employee_id
                   WHERE DATE(a.clock_in) = :d';
        if ($branchId) {
            $attSql .= ' AND e.branch_id = :b';
        }
        $stmt = $pdo->prepare($attSql);
        $stmt->execute(array_merge(['d' => $today], $branchId ? ['b' => $branchId] : []));
        $presentToday = (int) $stmt->fetchColumn();

        $openSql = 'SELECT COUNT(*) FROM attendance a
                    INNER JOIN employees e ON e.id = a.employee_id
                    WHERE a.clock_out IS NULL';
        if ($branchId) {
            $openSql .= ' AND e.branch_id = :b';
        }
        $stmt = $pdo->prepare($openSql);
        $stmt->execute($branchId ? ['b' => $branchId] : []);
        $stillClockedIn = (int) $stmt->fetchColumn();

        $leaveSql = "SELECT COUNT(*) FROM leave_requests WHERE status = 'pending'";
        $pendingLeave = (int) $pdo->query($leaveSql)->fetchColumn();

        $draftPayrollSql = "SELECT COUNT(*) FROM payroll_runs WHERE status = 'draft'";
        $draftParams = [];
        if ($branchId) {
            $draftPayrollSql .= ' AND branch_id = :b';
            $draftParams['b'] = $branchId;
        }
        $stmt = $pdo->prepare($draftPayrollSql);
        $stmt->execute($draftParams);
        $draftPayroll = (int) $stmt->fetchColumn();

        $monthStart = date('Y-m-01');
        $hrsSql = 'SELECT COALESCE(SUM(a.actual_hours), 0)
                   FROM attendance a
                   INNER JOIN employees e ON e.id = a.employee_id
                   WHERE DATE(a.clock_in) BETWEEN :ms AND :d';
        $hrsParams = ['ms' => $monthStart, 'd' => $today];
        if ($branchId) {
            $hrsSql .= ' AND e.branch_id = :b';
            $hrsParams['b'] = $branchId;
        }
        $stmt = $pdo->prepare($hrsSql);
        $stmt->execute($hrsParams);
        $monthHours = round((float) $stmt->fetchColumn(), 1);

        $pendingLoansSql = "SELECT COUNT(*) FROM employee_loans WHERE status = 'pending'";
        $pendingLoans = 0;
        try {
            $pendingLoans = (int) $pdo->query($pendingLoansSql)->fetchColumn();
        } catch (\Throwable) {
            // table may not exist on older DBs
        }

        return [
            'date' => $today,
            'active_employees' => $activeEmployees,
            'present_today' => $presentToday,
            'still_clocked_in' => $stillClockedIn,
            'pending_leave' => $pendingLeave,
            'draft_payroll_runs' => $draftPayroll,
            'month_hours' => $monthHours,
            'pending_loans' => $pendingLoans,
            'attendance_rate_today' => $activeEmployees > 0
                ? round(($presentToday / $activeEmployees) * 100, 1)
                : 0,
        ];
    }

    public function orgMasterlist(?string $branchId = null): array
    {
        $sql = 'SELECT e.id, e.emp_number, e.first_name, e.last_name, e.email, e.phone,
                       e.hire_date, e.employment_type, e.status,
                       b.name AS branch_name, d.name AS department_name, p.title AS position_title
                FROM employees e
                LEFT JOIN branches b ON b.id = e.branch_id
                LEFT JOIN departments d ON d.id = e.department_id
                LEFT JOIN positions p ON p.id = e.position_id
                WHERE e.status IN (\'active\', \'on_leave\')';
        $params = [];
        if ($branchId) {
            $sql .= ' AND e.branch_id = :b';
            $params['b'] = $branchId;
        }
        $sql .= ' ORDER BY b.name, d.name, e.last_name, e.first_name';
        $stmt = Database::connection()->prepare($sql);
        $stmt->execute($params);

        return $stmt->fetchAll();
    }
}
