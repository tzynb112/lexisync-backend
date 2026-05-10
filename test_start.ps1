# 最简化测试 - 逐行输出看哪里出错
Write-Host "Step 1: Script started" -ForegroundColor Green

try {
    $ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
    Write-Host "Step 2: ProjectRoot = $ProjectRoot" -ForegroundColor Green
    
    $BackendDir = Join-Path $ProjectRoot "backend"
    Write-Host "Step 3: BackendDir = $BackendDir" -ForegroundColor Green
    
    $FrontendDir = Join-Path $ProjectRoot "frontend"
    Write-Host "Step 4: FrontendDir = $FrontendDir" -ForegroundColor Green
    
    $PythonPath = "C:\Python314\python.exe"
    Write-Host "Step 5: PythonPath = $PythonPath" -ForegroundColor Green
    
    if (Test-Path $PythonPath) {
        Write-Host "Step 6: Python exists" -ForegroundColor Green
    } else {
        Write-Host "Step 6: Python NOT found!" -ForegroundColor Red
    }
    
    if (Test-Path $BackendDir) {
        Write-Host "Step 7: Backend dir exists" -ForegroundColor Green
    } else {
        Write-Host "Step 7: Backend dir NOT found!" -ForegroundColor Red
    }
    
    if (Test-Path $FrontendDir) {
        Write-Host "Step 8: Frontend dir exists" -ForegroundColor Green
    } else {
        Write-Host "Step 8: Frontend dir NOT found!" -ForegroundColor Red
    }
    
    Write-Host "Step 9: Trying to start backend..." -ForegroundColor Yellow
    $proc = Start-Process -FilePath $PythonPath -ArgumentList "-m", "uvicorn", "app.main:app", "--reload", "--host", "0.0.0.0", "--port", "8000" -WorkingDirectory $BackendDir -WindowStyle Hidden -PassThru
    Write-Host "Step 10: Backend started, PID = $($proc.Id)" -ForegroundColor Green
    
    Write-Host "Step 11: Trying to start frontend..." -ForegroundColor Yellow
    $proc2 = Start-Process -FilePath "cmd.exe" -ArgumentList "/c", "npm", "run", "dev", "--", "-p", "3001" -WorkingDirectory $FrontendDir -WindowStyle Hidden -PassThru
    Write-Host "Step 12: Frontend started, PID = $($proc2.Id)" -ForegroundColor Green
    
    Write-Host "All done!" -ForegroundColor Green
    
} catch {
    Write-Host "ERROR: $_" -ForegroundColor Red
    Write-Host "Stack: $($_.ScriptStackTrace)" -ForegroundColor Red
}

Read-Host "Press Enter to exit"
