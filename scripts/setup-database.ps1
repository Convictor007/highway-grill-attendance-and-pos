# Fresh HRMS database: schema (drop + create tables) + seed
$mysql = "C:\xampp\mysql\bin\mysql.exe"
$root = Split-Path $PSScriptRoot -Parent
if (-not (Test-Path $mysql)) {
    Write-Error "MySQL not found at $mysql. Start XAMPP MySQL first."
    exit 1
}
$schema = Join-Path $root "database\schema.sql"
$seed = Join-Path $root "database\seed.sql"
Write-Host "Applying schema (drops highway_grill_hrms)..."
& $mysql -u root -e "SOURCE $($schema -replace '\\','/')"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Host "Applying seed..."
& $mysql -u root -e "SOURCE $($seed -replace '\\','/')"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Host "Done. Test logins: php scripts\test-login.php"
