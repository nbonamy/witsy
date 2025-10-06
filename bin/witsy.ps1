# Enable strict mode for safety
Set-StrictMode -Version Latest

# Set environment variables
$env:ELECTRON_RUN_AS_NODE = "1"

# Get the directory of this script
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition

# Find the latest "app-*" directory (reverse alphabetically = highest version)
$AppDirs = Get-ChildItem -Path $ScriptDir -Directory -Filter "app-*" | Sort-Object Name -Descending

if ($AppDirs.Count -eq 0) {
    Write-Host "Error: Could not find Witsy installation"
    exit 1
}

$LatestApp = $AppDirs[0].FullName

# Build the paths
$ExePath = Join-Path $LatestApp "Witsy.exe"
$CliPath = Join-Path $LatestApp "resources\cli\cli.js"

# Execute the command
& $ExePath --no-deprecation $CliPath @args
exit $LASTEXITCODE
