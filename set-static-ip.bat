@echo off
title The Verity - Set Static IP (192.168.254.100) and Private Network
cd /d "%~dp0"

:: Check for Administrator privileges, auto-elevate if needed
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [The Verity] Requesting Administrator privileges...
    powershell -NoProfile -Command "Start-Process cmd -ArgumentList '/c \"\"%~f0\"\"' -Verb RunAs"
    exit /b
)

echo ========================================================
echo   Configuring Ethernet as Host Server: 192.168.254.100
echo ========================================================
echo.

:: 1. Set Static IP 192.168.254.100 with Subnet Mask 255.255.255.0 (No gateway, so Wi-Fi handles internet)
echo [1/3] Setting Static IP 192.168.254.100 on Ethernet...
netsh interface ipv4 set address name="Ethernet" static 192.168.254.100 255.255.255.0 none >nul 2>&1

:: 2. Set Network Profile to Private (changes Unidentified Public to Private Trusted LAN)
echo [2/3] Setting Ethernet network profile to Private (Trusted LAN)...
powershell -NoProfile -Command "Get-NetConnectionProfile | Where-Object { $_.InterfaceAlias -match 'Ethernet' } | Set-NetConnectionProfile -NetworkCategory Private -ErrorAction SilentlyContinue"

:: 3. Ensure Inbound Firewall rules exist for port 3001 and UDP 39123 on all profiles
echo [3/3] Verifying Windows Defender Firewall rules...
netsh advfirewall firewall delete rule name="The Verity Server (TCP 3001)" >nul 2>&1
netsh advfirewall firewall delete rule name="The Verity LAN Discovery (UDP 39123)" >nul 2>&1
netsh advfirewall firewall add rule name="The Verity Server (TCP 3001)" dir=in action=allow protocol=TCP localport=3001 profile=any >nul 2>&1
netsh advfirewall firewall add rule name="The Verity LAN Discovery (UDP 39123)" dir=in action=allow protocol=UDP localport=39123 profile=any >nul 2>&1

:: Prioritize Wi-Fi for Internet
netsh interface ipv4 set interface "Wi-Fi" metric=10 >nul 2>&1
netsh interface ipv4 set interface "Ethernet" metric=50 >nul 2>&1

echo.
echo ========================================================
echo   SUCCESS!
echo   - Ethernet IP is locked to: 192.168.254.100
echo   - Network Category: Private (Trusted LAN)
echo   - TCP Port 3001 and UDP 39123 are OPEN on all profiles!
echo   - Wi-Fi internet priority: Active
echo ========================================================
echo.
pause
