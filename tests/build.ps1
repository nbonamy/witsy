
# Remove directories
Remove-Item -Recurse -Force "out/*win32-x64*"
Remove-Item -Recurse -Force "out/make/zip/win32/x64/*"

# Read the build number from the file
$BUILD_NUMBER_FILE = "./build/build_number.txt"
$BUILD_NUMBER = Get-Content $BUILD_NUMBER_FILE
$env:BUILD_NUMBER = $BUILD_NUMBER

# Extract version from package.json
$packageJsonContent = Get-Content -Raw -Path "package.json"
$VERSION = ($packageJsonContent | ConvertFrom-Json).version

# Run the electron-forge package command
npx electron-forge package -p win32 -a x64

# Create directory if not exists
New-Item -ItemType Directory -Force -Path "out/make/zip/win32/x64"

# Change directory and create a zip file
Set-Location -Path "out"
Compress-Archive -Path "Witsy-win32-x64" -DestinationPath "make/zip/win32/x64/Witsy-win32-x64-$VERSION.zip" -Force
