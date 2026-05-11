@echo off
title DashAnalyzer ERP System
echo ====================================================
echo  DashAnalyzer - Starting All Servers...
echo ====================================================

echo.
echo [1] Starting Node.js Backend (Refactored MVC)...
start "DashAnalyzer - Backend" cmd /k "cd Backend && node server.js"

timeout /t 2 /nobreak > nul

echo [2] Starting React Frontend (Vite)...
start "DashAnalyzer - Frontend" cmd /k "cd Frontend && npm run dev"

echo.
echo All servers launching!
echo    Backend  - http://localhost:3000
echo    Frontend - http://localhost:5173
echo.
echo You can close this window.
exit
