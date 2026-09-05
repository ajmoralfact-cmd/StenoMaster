@echo off
title StenoMaster — Professional Stenographer Platform
echo =====================================================================
echo    StenoMaster - Professional Stenographer Platform
echo    Listen. Type. Improve. Master Steno.
echo =====================================================================
echo.
echo Starting StenoMaster Server on port 8085...
start http://localhost:8085
python server.py 8085
pause
