@echo off
setlocal
cd /d "%~dp0"

echo ==========================================
echo   Ticketing Tool - k6 Load Testing Suite
echo ==========================================

set TARGET=%1
if "%TARGET%"=="" set TARGET=auth

powershell -ExecutionPolicy Bypass -File "%~dp0run-load-tests.ps1" -Target %TARGET%

pause

