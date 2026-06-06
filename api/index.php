<?php

declare(strict_types=1);

require_once __DIR__ . '/core/Env.php';
require_once __DIR__ . '/core/Database.php';
require_once __DIR__ . '/core/Response.php';
require_once __DIR__ . '/core/Request.php';
require_once __DIR__ . '/core/Auth.php';
require_once __DIR__ . '/core/AuditLog.php';
require_once __DIR__ . '/core/Schema.php';
require_once __DIR__ . '/modules/auth/AuthController.php';
require_once __DIR__ . '/modules/roles/RoleService.php';
require_once __DIR__ . '/modules/roles/RoleController.php';
require_once __DIR__ . '/modules/employees/EmployeeService.php';
require_once __DIR__ . '/modules/employees/EmployeeController.php';
require_once __DIR__ . '/modules/reference/ReferenceController.php';
require_once __DIR__ . '/modules/settings/SettingsService.php';
require_once __DIR__ . '/modules/settings/SettingsController.php';
require_once __DIR__ . '/modules/attendance/AttendanceService.php';
require_once __DIR__ . '/modules/attendance/AttendanceAutoService.php';
require_once __DIR__ . '/modules/attendance/AttendanceController.php';
require_once __DIR__ . '/modules/leave/LeaveService.php';
require_once __DIR__ . '/modules/leave/LeaveController.php';
require_once __DIR__ . '/modules/payroll/PayrollService.php';
require_once __DIR__ . '/modules/payroll/PayrollController.php';
require_once __DIR__ . '/modules/dashboard/DashboardService.php';
require_once __DIR__ . '/modules/dashboard/DashboardController.php';
require_once __DIR__ . '/modules/users/UserService.php';
require_once __DIR__ . '/modules/users/UserController.php';
require_once __DIR__ . '/modules/notifications/NotificationService.php';
require_once __DIR__ . '/modules/notifications/NotificationController.php';
require_once __DIR__ . '/modules/shifts/ShiftService.php';
require_once __DIR__ . '/modules/shifts/ShiftSwapService.php';
require_once __DIR__ . '/modules/shifts/ShiftController.php';
require_once __DIR__ . '/modules/compliance/ComplianceService.php';
require_once __DIR__ . '/modules/compliance/ComplianceController.php';
require_once __DIR__ . '/modules/overtime/OvertimeService.php';
require_once __DIR__ . '/modules/overtime/OvertimeController.php';
require_once __DIR__ . '/modules/announcements/AnnouncementService.php';
require_once __DIR__ . '/modules/announcements/AnnouncementController.php';
require_once __DIR__ . '/modules/documents/DocumentService.php';
require_once __DIR__ . '/modules/documents/DocumentController.php';
require_once __DIR__ . '/modules/fieldwork/FieldWorkService.php';
require_once __DIR__ . '/modules/fieldwork/FieldWorkController.php';
require_once __DIR__ . '/modules/loans/LoanService.php';
require_once __DIR__ . '/modules/loans/LoanController.php';
require_once __DIR__ . '/modules/geocode/GeocodeService.php';
require_once __DIR__ . '/modules/geocode/GeocodeController.php';

use Hg\Api\Core\Response;
use Hg\Api\Modules\Announcements\AnnouncementController;
use Hg\Api\Modules\Compliance\ComplianceController;
use Hg\Api\Modules\Documents\DocumentController;
use Hg\Api\Modules\Overtime\OvertimeController;
use Hg\Api\Modules\Dashboard\DashboardController;
use Hg\Api\Modules\Attendance\AttendanceController;
use Hg\Api\Modules\Auth\AuthController;
use Hg\Api\Modules\Employees\EmployeeController;
use Hg\Api\Modules\Leave\LeaveController;
use Hg\Api\Modules\Payroll\PayrollController;
use Hg\Api\Modules\Reference\ReferenceController;
use Hg\Api\Modules\Roles\RoleController;
use Hg\Api\Modules\Settings\SettingsController;
use Hg\Api\Modules\Users\UserController;
use Hg\Api\Modules\Fieldwork\FieldWorkController;
use Hg\Api\Modules\Geocode\GeocodeController;
use Hg\Api\Modules\Loans\LoanController;
use Hg\Api\Modules\Notifications\NotificationController;
use Hg\Api\Modules\Shifts\ShiftController;

$configPath = __DIR__ . '/config/config.php';
if (is_file($configPath)) {
    $config = require $configPath;
    header('Access-Control-Allow-Origin: ' . ($config['cors_origin'] ?? '*'));
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');
}

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$path = trim((string) ($_SERVER['PATH_INFO'] ?? ''), '/');
if ($path === '' && isset($_GET['resource'])) {
    $path = $_GET['resource'];
    if (!empty($_GET['slug'])) {
        $path .= '/' . $_GET['slug'];
    }
    if (!empty($_GET['action'])) {
        $path .= '/' . $_GET['action'];
    }
}

$segments = $path !== '' ? explode('/', $path) : [''];
$resource = $segments[0] ?? '';
$seg1 = $segments[1] ?? null;
$seg2 = $segments[2] ?? null;
$method = $_SERVER['REQUEST_METHOD'];

try {
    match ($resource) {
        '' => Response::json([
            'success' => true,
            'name' => 'Highway Grill HRMS API',
            'version' => '1.0',
            'resources' => [
                'auth', 'roles', 'employees', 'users', 'branches', 'departments', 'positions',
                'settings', 'attendance', 'leave', 'payroll', 'shifts', 'dashboard', 'compliance',
                'overtime', 'announcements', 'documents', 'field-work', 'loans', 'geocode', 'notifications',
            ],
        ]),
        'auth' => (new AuthController())->handle($method, $seg1),
        'roles' => (new RoleController())->handle($method, $seg1, $seg2),
        'employees' => (new EmployeeController())->handle($method, $seg1),
        'branches', 'departments', 'positions' => (new ReferenceController())->handle($resource, $method),
        'settings' => (new SettingsController())->handle($seg1 ?? '', $method, $seg2),
        'attendance' => (new AttendanceController())->handle($method, $seg1),
        'leave' => (new LeaveController())->handle($method, $seg1 ?? 'requests', $seg2),
        'payroll' => (new PayrollController())->handle($method, $seg1, $seg2),
        'dashboard' => (new DashboardController())->handle($method),
        'users' => (new UserController())->handle($method, $seg1),
        'notifications' => (new NotificationController())->handle($method, $seg1, $seg2),
        'shifts' => (new ShiftController())->handle($method, $seg1, $seg2),
        'compliance' => (new ComplianceController())->handle($method, $seg1, $seg2),
        'overtime' => (new OvertimeController())->handle($method, $seg1, $seg2),
        'loans' => (new LoanController())->handle($method, $seg1, $seg2),
        'announcements' => (new AnnouncementController())->handle($method, $seg1),
        'documents' => (new DocumentController())->handle($method, $seg1),
        'field-work' => (new FieldWorkController())->handle($method, $seg1, $seg2),
        'geocode' => (new GeocodeController())->handle($method, $seg1),
        default => Response::error('Unknown resource: ' . $resource, 404),
    };
} catch (Throwable $e) {
    Response::error($e->getMessage(), 500);
}
