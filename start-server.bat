@echo off
title The Verity Server
cd /d "%~dp0"
echo ========================================================
echo   THE VERITY - Secure Examination ^& LMS Server
echo ========================================================
echo Starting backend server and serving web app...
echo.
node server/server.js
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Server stopped with error code %errorlevel%.
    pause
)
