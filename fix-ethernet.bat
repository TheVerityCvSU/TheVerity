@echo off
echo ========================================================
echo   Configuring Ethernet Adapter for Automatic DHCP
echo ========================================================
netsh interface ipv4 set address name="Ethernet" source=dhcp
netsh interface ipv4 set dns name="Ethernet" source=dhcp
ipconfig /renew Ethernet
echo.
echo ========================================================
echo   Ethernet has been configured!
echo   Here are your active IP addresses:
echo ========================================================
ipconfig | findstr /i "IPv4"
echo ========================================================
echo.
echo Check the IPv4 Address under "Ethernet adapter Ethernet".
echo That is the IP you must type on the other laptop!
echo.
pause
