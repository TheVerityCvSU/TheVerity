@echo off
title Revert Ethernet to Automatic DHCP
cd /d "%~dp0"

:: Check for Administrator privileges, auto-elevate if needed
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo Requesting Administrator privileges...
    powershell -NoProfile -Command "Start-Process cmd -ArgumentList '/c \"\"%~f0\"\"' -Verb RunAs"
    exit /b
)

echo ========================================================
echo   Configuring Ethernet Adapter for Automatic DHCP
echo ========================================================
netsh interface ipv4 set address name="Ethernet" source=dhcp >nul 2>&1
netsh interface ipv4 set dns name="Ethernet" source=dhcp >nul 2>&1
ipconfig /renew Ethernet >nul 2>&1
echo.
echo ========================================================
echo   Ethernet has been restored to Automatic (DHCP)!
echo ========================================================
echo.
pause
