@echo off
title The Verity - ComLab LAN Host Server
color 0A
cd /d "%~dp0"

echo ========================================================
echo   [The Verity] Starting ComLab Host Server...
echo ========================================================
echo.
echo Mode: Dedicated LAN Host (UDP Discovery Beacon Active)
echo Port: 3001
echo.
echo Student PCs on the same LAN will automatically discover and connect to port 3001.
echo.
echo Keep this window open during lab sessions.
echo ========================================================
echo.

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH.
    pause
    exit /b 1
)

if not exist "server\node_modules" (
    echo [Notice] Installing server dependencies first...
    npm --prefix server install --omit=dev
)

:: Ensure port 3001 is free from any previous stuck process (skip PID 0)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3001 " ^| findstr LISTENING') do (
    if not "%%a"=="0" (
        echo [Notice] Freeing busy port 3001 (PID %%a)...
        taskkill /f /pid %%a >nul 2>&1
    )
)

set IS_LAN_HOST=true
node server/server.js

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Server stopped with error code %errorlevel%.
    pause
)
