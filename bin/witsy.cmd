@echo off
setlocal EnableDelayedExpansion

REM Find the latest app-* folder (sorted reverse alphabetically to get highest version)
for /f "delims=" %%i in ('dir /b /ad /o-n "%~dp0app-*" 2^>nul') do (
    set LATEST_APP=%%i
    goto :found
)

echo Error: Could not find Witsy installation
exit /b 1

:found
set CLI_PATH=%~dp0!LATEST_APP!\resources\cli\cli.js

REM Check if Node.js is available
where node >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    REM Node.js is available, use it
    node --no-deprecation "%CLI_PATH%" %*
    exit /b %ERRORLEVEL%
)

REM Node.js not found, show error message
echo.
echo Witsy CLI requires Node.js to run on Windows.
echo.
echo Please install Node.js from: https://nodejs.org/dist/v22.12.0/node-v22.12.0-x64.msi
echo.
echo After installation, restart your terminal and try again.
echo.
exit /b 1
