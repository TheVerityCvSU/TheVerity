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
echo Student PCs will automatically discover and connect to:
echo   http://192.168.254.101:3001 (Ethernet / ComLab Router)
echo.
echo Keep this window open during lab sessions.
echo ========================================================
echo.

:: Ensure port 3001 is free from any previous stuck process
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3001 ^| findstr LISTENING') do (
    echo [Notice] Freeing busy port 3001 (PID %%a)...
    taskkill /f /pid %%a >nul 2>&1
)

set IS_LAN_HOST=true
node server/server.js

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Server stopped with error code %errorlevel%.
    pause
)
