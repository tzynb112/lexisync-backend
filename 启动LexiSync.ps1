# LexiSync 启动脚本
Write-Host "=== LexiSync 启动 ===" -ForegroundColor Cyan

$ProjectRoot = "D:\trae\LexiSync"
$BackendDir = "$ProjectRoot\backend"
$FrontendDir = "$ProjectRoot\frontend"
$PythonPath = "C:\Python314\python.exe"

# 1. 终止所有旧进程
Write-Host "[1/4] 清理旧进程..." -ForegroundColor Yellow
taskkill /F /IM node.exe 2>$null | Out-Null
Start-Sleep 2

# 2. 清除前端缓存
Write-Host "[2/4] 清除前端缓存..." -ForegroundColor Yellow
if (Test-Path "$FrontendDir\.next") {
    Remove-Item -Recurse -Force "$FrontendDir\.next" -ErrorAction SilentlyContinue
}

# 3. 启动后端
Write-Host "[3/4] 启动后端 (端口 8000)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$BackendDir'; $PythonPath -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"

# 4. 启动前端
Write-Host "[4/4] 启动前端 (端口 3000)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$FrontendDir'; npm run dev"

Write-Host ""
Write-Host "=== LexiSync 启动完成 ===" -ForegroundColor Green
Write-Host "前端: http://localhost:3000" -ForegroundColor Cyan
Write-Host "后端: http://localhost:8000" -ForegroundColor Cyan
Write-Host ""
Write-Host "按任意键关闭此窗口..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
