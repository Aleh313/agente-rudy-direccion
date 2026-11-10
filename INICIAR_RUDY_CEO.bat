@echo off
title Rudy Greyrat - Director General & CEO (Electronicat)
color 0E
cd /d "%~dp0"

echo =======================================================
echo    RUDY GREYRAT - DIRECTOR GENERAL & ESTRATEGA CEO
echo    Electronicat - Oficina Virtual y Taller Central
echo =======================================================
echo.
echo [*] Iniciando servidor del Agente 01 (Rudy CEO)...
echo [*] Abriendo interfaz ejecutiva y comando central en el navegador...
echo.

start "" "http://localhost:3001"
node server.js
pause