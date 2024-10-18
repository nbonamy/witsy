# Detect the system architecture
$architecture = if ([Environment]::Is64BitOperatingSystem) {
  if ((Get-WmiObject -Class Win32_Processor).AddressWidth -eq 64) {
      "x64"
  } else {
      "arm64" # Assuming arm64 if not x64; this might need adjustment based on specific arm detection
  }
} else {
  "x86" # For 32-bit systems, update as necessary
}

# Log detected architecture
Write-Host "Detected architecture: $architecture"

# Remove directories based on architecture
Remove-Item -Recurse -Force "out/*win32-$architecture*"
Remove-Item -Recurse -Force "out/make/zip/win32/$architecture/*"

# Read the build number from the file
$build_number_file = "./build/build_number.txt"
$build_number = Get-Content $build_number_file
$env:BUILD_NUMBER = $build_number
Write-Host "Build number: $build_number"

# Extract version from package.json
$packageJsonContent = Get-Content -Raw -Path "package.json"
$version = ($packageJsonContent | ConvertFrom-Json).version
Write-Host "Version: $version"

# Run the electron-forge package command with architecture
npx electron-forge package -p win32 -a $architecture

# Create directory if not exists based on architecture
New-Item -ItemType Directory -Force -Path "out/make/zip/win32/$architecture"

# Change directory and create a zip file based on architecture
Set-Location -Path "out"
Compress-Archive -Path "Witsy-win32-$architecture" -DestinationPath "make/zip/win32/$architecture/Witsy-win32-$architecture-$version.zip" -Force
