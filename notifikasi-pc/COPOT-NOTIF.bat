@echo off
title Copot notifikasi MCC
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0MCC-Notif.ps1" -Copot
echo.
pause
