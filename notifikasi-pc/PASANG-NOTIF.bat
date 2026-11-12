@echo off
title Pasang notifikasi MCC
echo Memasang notifikasi MCC Spare Part (berjalan walaupun browser ditutup)...
echo.
set SERVER=http://192.168.100.1:3000
set /p SERVER=Alamat server MCC [tekan Enter untuk http://192.168.100.1:3000]: 
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0MCC-Notif.ps1" -Pasang -Server "%SERVER%"
echo.
pause
