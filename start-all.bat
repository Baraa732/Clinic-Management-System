@echo off
echo Starting Clinic Auth System...
echo.

echo [1/3] Starting Auth Service on TCP port 4001...
start "Auth Service" cmd /k "cd /d %~dp0auth-service && npm run start:dev"

timeout /t 3 /nobreak >nul

echo [2/3] Starting Users Service on TCP port 4002...
start "Users Service" cmd /k "cd /d %~dp0users-service && npm run start:dev"

timeout /t 3 /nobreak >nul

echo [3/3] Starting API Gateway on HTTP port 3000...
start "API Gateway" cmd /k "cd /d %~dp0api-gateway && npm run start:dev"

echo.
echo All services started!
echo API Gateway: http://localhost:3000/api/v1
echo Auth Service: TCP localhost:4001
echo Users Service: TCP localhost:4002
echo.
pause
