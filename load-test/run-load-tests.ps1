param (
    [string]$Target = "auth",
    [string]$Url = "http://localhost:4000/api"
)

$binDir = Join-Path $PSScriptRoot "bin"
$k6Path = Join-Path $binDir "k6.exe"

# Automatically download k6 if not present
if (-not (Test-Path $k6Path)) {
    Write-Host "k6 binary not found. Downloading k6 v0.56.0 for Windows..." -ForegroundColor Cyan
    New-Item -ItemType Directory -Force -Path $binDir | Out-Null
    $zipPath = Join-Path $binDir "k6.zip"
    $downloadUrl = "https://github.com/grafana/k6/releases/download/v0.56.0/k6-v0.56.0-windows-amd64.zip"
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Invoke-WebRequest -Uri $downloadUrl -OutFile $zipPath
    Expand-Archive -Path $zipPath -DestinationPath $binDir -Force
    $extractedExe = Join-Path $binDir "k6-v0.56.0-windows-amd64\k6.exe"
    if (Test-Path $extractedExe) {
        Move-Item -Path $extractedExe -Destination $k6Path -Force
        Remove-Item (Join-Path $binDir "k6-v0.56.0-windows-amd64") -Recurse -Force
    }
    Remove-Item $zipPath -Force
    Write-Host "k6 successfully downloaded and configured at $k6Path" -ForegroundColor Green
}

$scriptMap = @{
    "auth"    = "scripts\auth-load-test.js"
    "issues"  = "scripts\issues-load-test.js"
    "kanban"  = "scripts\kanban-load-test.js"
    "search"  = "scripts\search-load-test.js"
    "stress"  = "scripts\full-system-stress-test.js"
    "all"     = "all"
}

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  Ticketing Tool - k6 Load Testing Suite  " -ForegroundColor Yellow
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Target API URL : $Url" -ForegroundColor Green
Write-Host "Selected Test  : $Target" -ForegroundColor Green
Write-Host "------------------------------------------"

if ($Target -eq "all") {
    $tests = @("auth", "issues", "kanban", "search", "stress")
    foreach ($t in $tests) {
        $script = Join-Path $PSScriptRoot $scriptMap[$t]
        Write-Host "`n>>> Running: $t load test ($script)..." -ForegroundColor Magenta
        & $k6Path run -e TARGET_URL=$Url $script
    }
} else {
    if (-not $scriptMap.ContainsKey($Target)) {
        Write-Host "Unknown target '$Target'. Choose one of: auth, issues, kanban, search, stress, all" -ForegroundColor Red
        exit 1
    }
    $script = Join-Path $PSScriptRoot $scriptMap[$Target]
    Write-Host "`n>>> Running: $Target load test ($script)..." -ForegroundColor Magenta
    & $k6Path run -e TARGET_URL=$Url $script
}

Write-Host "`n==========================================" -ForegroundColor Cyan
Write-Host "         Load Testing Complete!           " -ForegroundColor Yellow
Write-Host "==========================================" -ForegroundColor Cyan
