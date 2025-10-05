@echo off
setlocal
set ELECTRON_RUN_AS_NODE=1
"%~dp0..\Witsy.exe" "%~dp0..\resources\cli.js" %*
IF %ERRORLEVEL% NEQ 0 EXIT /b %ERRORLEVEL%
endlocal
