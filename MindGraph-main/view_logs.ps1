# Simple log viewer script for MindGraph
# Usage: .\view_logs.ps1 [tail_lines] [filter]

param(
    [int]$TailLines = 50,
    [string]$Filter = ""
)

# Find log directory - check script directory first
$logDir = Join-Path $PSScriptRoot "logs"
if (-not (Test-Path $logDir)) {
    # Try current working directory
    $logDir = Join-Path (Get-Location) "logs"
    if (-not (Test-Path $logDir)) {
        Write-Host "Log directory does not exist. Creating: $logDir"
        New-Item -ItemType Directory -Path $logDir -Force | Out-Null
    }
}

Write-Host "Checking log directory: $logDir"

# Find the latest log file (supports both app.log and app.TIMESTAMP.log)
$logFiles = Get-ChildItem $logDir -Filter "*.log" -File -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending
if ($logFiles.Count -eq 0) {
    Write-Host "No log files found in: $logDir"
    Write-Host "Waiting for log file to be created (checking every 2 seconds)..."
    $timeout = 60
    $elapsed = 0
    while ($elapsed -lt $timeout) {
        Start-Sleep -Seconds 2
        $logFiles = Get-ChildItem $logDir -Filter "*.log" -File -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending
        if ($logFiles.Count -gt 0) {
            Write-Host "`nLog file found!"
            break
        }
        $elapsed += 2
        if ($elapsed % 10 -eq 0) {
            Write-Host "Still waiting... ($elapsed/$timeout seconds)"
        }
    }
    if ($logFiles.Count -eq 0) {
        Write-Host "`nLog file still not created after $timeout seconds"
        Write-Host "This may mean:"
        Write-Host "  1. Service is not running"
        Write-Host "  2. Service has not written any logs yet"
        Write-Host "  3. Log directory is in a different location"
        Write-Host "`nTry making a request to the service to trigger log creation."
        exit 1
    }
}

$latestLog = $logFiles[0]
Write-Host ""
Write-Host "=" * 80
Write-Host "Log file: $($latestLog.Name)"
Write-Host "Path: $($latestLog.FullName)"
Write-Host "Last modified: $($latestLog.LastWriteTime)"
Write-Host "Size: $([math]::Round($latestLog.Length/1KB, 2)) KB"
Write-Host "=" * 80
Write-Host ""

if ($Filter) {
    Write-Host "Filtering for: '$Filter'"
    Write-Host "=" * 80
    Write-Host ""
    Get-Content $latestLog.FullName -Tail $TailLines -Encoding UTF8 -ErrorAction SilentlyContinue | Select-String $Filter
    Write-Host ""
    Write-Host "=" * 80
    Write-Host "Real-time monitoring (Press Ctrl+C to stop)"
    Write-Host "=" * 80
    Get-Content $latestLog.FullName -Wait -Encoding UTF8 -ErrorAction SilentlyContinue | Select-String $Filter
} else {
    Get-Content $latestLog.FullName -Tail $TailLines -Encoding UTF8 -ErrorAction SilentlyContinue
    Write-Host ""
    Write-Host "=" * 80
    Write-Host "Real-time monitoring (Press Ctrl+C to stop)"
    Write-Host "=" * 80
    Get-Content $latestLog.FullName -Wait -Encoding UTF8 -ErrorAction SilentlyContinue
}

