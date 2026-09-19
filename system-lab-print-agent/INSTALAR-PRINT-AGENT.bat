@echo off
chcp 65001 >nul
title System Lab Print Agent - Instalador
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\install.ps1"
pause
