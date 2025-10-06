@echo off
setlocal EnableDelayedExpansion
set ELECTRON_RUN_AS_NODE=1

REM Find the latest app-* folder (sorted reverse alphabetically to get highest version)
for /f "delims=" %%i in ('dir /b /ad /o-n "%~dp0app-*" 2^>nul') do (
    set LATEST_APP=%%i
    goto :found
)

echo Error: Could not find Witsy installation
exit /b 1

:found
"%~dp0!LATEST_APP!\Witsy.exe" "%~dp0!LATEST_APP!\resources\cli\cli.js" %*
exit /b %ERRORLEVEL%
