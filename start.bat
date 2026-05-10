@echo off
title LexiSync Launcher
echo LexiSync Launcher - Starting...
echo.

set "PYTHON=C:\Python314\python.exe"

if not exist "%PYTHON%" (
    echo ERROR: Python not found at %PYTHON%
    pause
    exit /b 1
)

echo [OK] Python found
echo.

echo [1/2] Starting backend on port 8000...
start "LexiSync-Backend" cmd /k "cd /d %~dp0backend && %PYTHON% -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"

echo [2/2] Starting frontend on port 3000...
start "LexiSync-Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo ==========================================
echo  Backend:  http://localhost:8000
echo  Frontend: http://localhost:3000
echo ==========================================
echo.
echo Close this window anytime, services keep running.

timeout /t 2 >nul
start http://localhost:3000
pause
