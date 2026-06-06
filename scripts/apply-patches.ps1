# Apply incremental SQL patches (safe on existing DB)
$mysql = "C:\xampp\mysql\bin\mysql.exe"
$root = Split-Path $PSScriptRoot -Parent
if (-not (Test-Path $mysql)) {
    Write-Error "MySQL not found at $mysql. Start XAMPP MySQL first."
    exit 1
}

$patches = @(
    "patch_relink_users.sql",
    "patch_employee_permissions.sql",
    "patch_field_work.sql",
    "patch_loans.sql",
    "patch_geocode_address.sql"
)

foreach ($name in $patches) {
    $file = Join-Path $root "database\$name"
    if (-not (Test-Path $file)) { continue }
    Write-Host "Applying $name ..."
    & $mysql -u root -e "SOURCE $($file -replace '\\','/')" 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Warning "$name may have partially applied (duplicate column is OK)."
    }
}

Write-Host "Patches done. Re-login in the app if permissions changed."
