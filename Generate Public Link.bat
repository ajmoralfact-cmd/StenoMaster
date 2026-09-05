@echo off
title StenoMaster - Public Link Generator
cd /d "%~dp0"

echo ========================================================
echo   Starting StenoMaster Server and Generating Public Link...
echo ========================================================

start "" /b "C:\Users\intel\AppData\Local\Programs\Python\Python312\python.exe" "server.py" 8085
timeout /t 2 /nobreak >nul

echo Starting Cloudflare HTTPS Public Tunnel...
"C:\Program Files (x86)\cloudflared\cloudflared.exe" tunnel --url http://localhost:8085

pause
