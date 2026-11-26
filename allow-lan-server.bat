@echo off
title Opening Windows Firewall and Network Setup for The Verity Server...
cd /d "%~dp0"

:: Check for Administrator privileges, auto-elevate if needed
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [The Verity] Requesting Administrator privileges to configure Firewall...
    powershell -NoProfile -Command "Start-Process cmd -ArgumentList '/c \"\"%~f0\"\"' -Verb RunAs"
    exit /b
)

echo ========================================================
echo   Configuring Windows Firewall & Network for ComLab LAN
echo ========================================================
echo.

:: 1. Add Inbound Firewall Rules for TCP 3001 and UDP 39123 on all network profiles (Public, Private, Domain)
echo [1/4] Adding Windows Defender Firewall rules for TCP 3001 and UDP 39123...
netsh advfirewall firewall delete rule name="The Verity Server (TCP 3001)" >nul 2>&1
netsh advfirewall firewall delete rule name="The Verity LAN Discovery (UDP 39123)" >nul 2>&1
netsh advfirewall firewall delete rule name="The Verity Client Inbound (TCP 3001)" >nul 2>&1
netsh advfirewall firewall delete rule name="Node.js Server (TCP 3001)" >nul 2>&1

netsh advfirewall firewall add rule name="The Verity Server (TCP 3001)" dir=in action=allow protocol=TCP localport=3001 profile=any
netsh advfirewall firewall add rule name="The Verity LAN Discovery (UDP 39123)" dir=in action=allow protocol=UDP localport=39123 profile=any

:: Add rule for The Verity.exe and The Verity Admin.exe on all profiles
if exist "%LOCALAPPDATA%\Programs\The Verity\The Verity.exe" (
    netsh advfirewall firewall delete rule name="The Verity Application" >nul 2>&1
    netsh advfirewall firewall add rule name="The Verity Application" dir=in action=allow program="%LOCALAPPDATA%\Programs\The Verity\The Verity.exe" enable=yes profile=any >nul 2>&1
)
if exist "%LOCALAPPDATA%\Programs\The Verity Admin\The Verity Admin.exe" (
    netsh advfirewall firewall delete rule name="The Verity Admin Application" >nul 2>&1
    netsh advfirewall firewall add rule name="The Verity Admin Application" dir=in action=allow program="%LOCALAPPDATA%\Programs\The Verity Admin\The Verity Admin.exe" enable=yes profile=any >nul 2>&1
)

:: 2. Set all local and Ethernet network profiles to Private (so Windows doesn't block LAN communication)
echo [2/4] Setting ComLab Network Profile to Private (Trusted LAN)...
powershell -NoProfile -Command "Get-NetConnectionProfile | Where-Object { $_.InterfaceAlias -match 'Ethernet' } | Set-NetConnectionProfile -NetworkCategory Private -ErrorAction SilentlyContinue"

:: 3. Prioritize Wi-Fi for Internet while keeping Ethernet for offline ComLab router
echo [3/4] Setting network interface metrics (Wi-Fi = Internet Priority, Ethernet = ComLab LAN)...
netsh interface ipv4 set interface "Wi-Fi" metric=10 >nul 2>&1
netsh interface ipv4 set interface "Ethernet" metric=50 >nul 2>&1

:: 4. Designate this laptop as the Teacher Host Server
echo [4/4] Setting Host Server designation flag...
if not exist "%APPDATA%\The Verity" mkdir "%APPDATA%\The Verity" >nul 2>&1
echo host > "%APPDATA%\The Verity\host.flag" 2>nul
if not exist "%LOCALAPPDATA%\The Verity" mkdir "%LOCALAPPDATA%\The Verity" >nul 2>&1
echo host > "%LOCALAPPDATA%\The Verity\host.flag" 2>nul
echo host > "%~dp0server\host.flag" 2>nul
echo host > "%~dp0host.flag" 2>nul

echo.
echo ========================================================
echo   SUCCESS! 
echo   - TCP Port 3001 and UDP 39123 are OPEN on ALL profiles!
echo   - Ethernet connection marked as Private (Trusted LAN)!
echo   - Wi-Fi internet priority restored!
echo   - Teacher Host Server designation active!
echo ========================================================
echo.
timeout /t 3 >nul
exit /b
