# Enable strict mode for safety
Set-StrictMode -Version Latest

# Set console output encoding to UTF-8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host ""
Write-Host "Witsy CLI on Windows is still under development."
Write-Host "Stay tuned for updates!"
Write-Host ""
exit 1

# Get the directory of this script
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition

# Find the latest "app-*" directory (reverse alphabetically = highest version)
$AppDirs = @(Get-ChildItem -Path $ScriptDir -Directory -Filter "app-*" | Sort-Object Name -Descending)

if ($AppDirs.Count -eq 0) {
    Write-Host "Error: Could not find Witsy installation"
    exit 1
}

$LatestApp = $AppDirs[0].FullName
$CliPath = Join-Path $LatestApp "resources\cli\cli.js"

# Check if Node.js is available
$nodeCmd = Get-Command node -ErrorAction SilentlyContinue

if ($nodeCmd) {
    # Node.js is available, use it
    & node --no-deprecation $CliPath @args
    exit $LASTEXITCODE
}

# Node.js not found, show error message
Write-Host ""
Write-Host "Witsy CLI requires Node.js to run on Windows."
Write-Host ""
Write-Host "Please install Node.js from: https://nodejs.org/dist/v22.12.0/node-v22.12.0-x64.msi"
Write-Host ""
Write-Host "After installation, restart your terminal and try again."
Write-Host ""
exit 1
