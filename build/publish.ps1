
# Detect the system architecture
$architecture = $Env:PROCESSOR_ARCHITECTURE.ToLower()
if ($architecture -eq "amd64") { $architecture = "x64" }
Write-Host "Detected architecture: $architecture"

# Extract version from package.json
$packageJsonContent = Get-Content -Raw -Path "package.json"
$version = ($packageJsonContent | ConvertFrom-Json).version
Write-Host "Version: $version"

# Upload
gh release upload v$version "out\make\squirrel.windows\$architecture\Witsy-$version-win32-$architecture Setup.exe" "out\make\squirrel.windows\$architecture\witsy-$version-win32-$architecture-full.nupkg"
