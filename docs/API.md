# Highway Grill HRMS — API

Base: `/api/index.php` (PATH_INFO or `?resource=`)

Auth: `Authorization: Bearer <token>` from `POST /auth/login`

## Auth
| Method | Path | Permission |
|--------|------|------------|
| POST | `/auth/login` | — |
| POST | `/auth/logout` | token |
| GET | `/auth/me` | token |

## Roles
| GET | `/roles` | token |
| GET | `/roles/{slug}` | token |
| GET | `/roles/{slug}/permissions` | token |

## Employees
| GET | `/employees` | employees.view |
| GET | `/employees/me` | token + employee linked |
| GET | `/employees/{id}` | employees.view |
| POST | `/employees` | employees.manage |
| PUT | `/employees/{id}` | employees.manage |
| DELETE | `/employees/{id}` | employees.manage (soft terminate) |

## Users
| GET/POST | `/users` | users.manage |
| GET/PUT | `/users/{id}` | users.manage |

## Reference (read-only dropdowns)
| GET | `/branches`, `/departments`, `/positions` | employees.view |

## Settings (admin writes)
| GET | `/settings/branches`, `/settings/departments` | employees.view |
| POST/PUT | `/settings/branches`, `/settings/branches/{id}` | settings.branches.manage |
| POST/PUT | `/settings/departments`, `/settings/departments/{id}` | settings.departments.manage |
| POST/PUT | `/settings/positions`, `/settings/positions/{id}` | settings.departments.manage |

## Attendance
| GET | `/attendance?date=&branch_id=` | attendance.view |
| GET | `/attendance/{id}` | attendance.view |
| GET | `/attendance/status` | attendance.self |
| POST | `/attendance/clock-in`, `/clock-out` | attendance.self |
| POST | `/attendance/manual` | attendance.manage |
| PUT | `/attendance/{id}` | attendance.manage |

## Leave
| GET | `/leave/types` | leave.view |
| POST | `/leave/types` | leave.manage |
| PUT | `/leave/{typeId}` | leave.manage |
| GET | `/leave/balances?employee_id=&year=` | leave.view (own if no approve) |
| GET | `/leave/requests` | leave.view |
| POST | `/leave/requests` | leave.apply |
| PUT | `/leave/{id}/review` | leave.approve |

## Payroll
| GET | `/payroll/runs` | payroll.view |
| GET | `/payroll/runs/{id}` | payroll.view |
| POST | `/payroll/runs` | payroll.manage |
| PUT | `/payroll/{runId}` | payroll.manage |
| POST | `/payroll/{runId}/generate-payslips` | payroll.manage |
| GET | `/payroll/payslips?run_id=` | payroll.view |
| GET | `/payroll/{payslipId}` | payroll.view |

## Shifts
| GET/POST | `/shifts/templates` | shifts.manage |
| GET/POST | `/shifts/schedules` | shifts.manage |
| GET/POST | `/shifts/assignments` | shifts.manage |
| DELETE | `/shifts/assignments/{id}` | shifts.manage |

## Dashboard
| GET | `/dashboard?branch_id=` | reports.view |

## Compliance
| GET | `/compliance/checklists` | compliance.view |
| GET | `/compliance/logs` | compliance.view |
| POST | `/compliance/logs` | compliance.view |
| GET | `/compliance/audit` | compliance.view |
