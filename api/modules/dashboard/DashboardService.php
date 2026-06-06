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

        $draftPayroll = (int) $pdo->query(
            "SELECT COUNT(*) FROM payroll_runs WHERE status = 'draft'"
        )->fetchColumn();

        return [
            'date' => $today,
            'active_employees' => $activeEmployees,
            'present_today' => $presentToday,
            'still_clocked_in' => $stillClockedIn,
            'pending_leave' => $pendingLeave,
            'draft_payroll_runs' => $draftPayroll,
        ];
    }
}
