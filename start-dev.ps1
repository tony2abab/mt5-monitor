# MT5 Monitor Development Startup Script
# 啟動本地開發環境

param(
    [switch]$Backend,
    [switch]$Frontend,
    [switch]$All
)

$ErrorActionPreference = "Stop"

function Write-ColorOutput($ForegroundColor, $Message) {
    $fc = $host.UI.RawUI.ForegroundColor
    $host.UI.RawUI.ForegroundColor = $ForegroundColor
    Write-Output $Message
    $host.UI.RawUI.ForegroundColor = $fc
}

function Start-Backend {
    Write-ColorOutput Cyan "===========================================" 
    Write-ColorOutput Cyan "Starting Backend Server..."
    Write-ColorOutput Cyan "==========================================="
    Write-Output ""
    
    if (!(Test-Path "backend/node_modules")) {
        Write-ColorOutput Yellow "Installing backend dependencies..."
        Set-Location backend
        npm install
        Set-Location ..
    }
    
    if (!(Test-Path "backend/.env")) {
        Write-ColorOutput Yellow "Creating backend .env from example..."
        Copy-Item ".env.example" "backend/.env"
        Write-ColorOutput Red "⚠️  Please edit backend/.env with your configuration!"
    }
    
    Set-Location backend
    Write-ColorOutput Green "✓ Starting backend on http://localhost:8080"
    npm run dev
}

function Start-Frontend {
    Write-ColorOutput Cyan "===========================================" 
    Write-ColorOutput Cyan "Starting Frontend Development Server..."
    Write-ColorOutput Cyan "==========================================="
    Write-Output ""
    
    if (!(Test-Path "frontend/node_modules")) {
        Write-ColorOutput Yellow "Installing frontend dependencies..."
        Set-Location frontend
        npm install
        Set-Location ..
    }
    
    if (!(Test-Path "frontend/.env")) {
        Write-ColorOutput Yellow "Creating frontend .env from example..."
        Copy-Item "frontend/.env.example" "frontend/.env"
    }
    
    Set-Location frontend
    Write-ColorOutput Green "✓ Starting frontend on http://localhost:3000"
    npm run dev
}

function Start-All {
    Write-ColorOutput Cyan "===========================================" 
    Write-ColorOutput Cyan "MT5 Monitor - Full Development Environment"
    Write-ColorOutput Cyan "==========================================="
    Write-Output ""
    
    # Check dependencies
    Write-ColorOutput Yellow "Checking dependencies..."
    
    if (!(Test-Path "backend/node_modules")) {
        Write-ColorOutput Yellow "Installing backend dependencies..."
        Set-Location backend
        npm install
        Set-Location ..
    }
    
    if (!(Test-Path "frontend/node_modules")) {
        Write-ColorOutput Yellow "Installing frontend dependencies..."
        Set-Location frontend
        npm install
        Set-Location ..
    }
    
    # Check .env files
    if (!(Test-Path ".env")) {
        Write-ColorOutput Yellow "Creating .env from example..."
        Copy-Item ".env.example" ".env"
        Write-ColorOutput Red "⚠️  Please edit .env with your configuration!"
    }
    
    Write-Output ""
    Write-ColorOutput Green "✓ All dependencies installed"
    Write-Output ""
    Write-ColorOutput Cyan "Starting services..."
    Write-Output ""
    Write-ColorOutput White "  Backend:  http://localhost:8080"
    Write-ColorOutput White "  Frontend: http://localhost:3000"
    Write-Output ""
    Write-ColorOutput Yellow "Opening two new terminal windows..."
    Write-Output ""
    
    # Start backend in new window
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD'; Write-Host 'MT5 Monitor Backend' -ForegroundColor Cyan; cd backend; npm run dev"
    
    # Wait a bit
    Start-Sleep -Seconds 2
    
    # Start frontend in new window
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD'; Write-Host 'MT5 Monitor Frontend' -ForegroundColor Cyan; cd frontend; npm run dev"
    
    Write-ColorOutput Green "✓ Services started in separate windows"
    Write-Output ""
    Write-ColorOutput Yellow "Next steps:"
    Write-Output "  1. Wait for both servers to start (check the new windows)"
    Write-Output "  2. Open http://localhost:3000 in your browser"
    Write-Output "  3. Run .\test-api.ps1 to test the API"
    Write-Output "  4. Attach MT4/MT5 EA with the monitor client"
}

# Main logic
if (!$Backend -and !$Frontend -and !$All) {
    Write-ColorOutput Yellow "Usage:"
    Write-Output "  .\start-dev.ps1 -All        # Start both backend and frontend"
    Write-Output "  .\start-dev.ps1 -Backend    # Start backend only"
    Write-Output "  .\start-dev.ps1 -Frontend   # Start frontend only"
    Write-Output ""
    exit 1
}

if ($All) {
    Start-All
} elseif ($Backend) {
    Start-Backend
} elseif ($Frontend) {
    Start-Frontend
}
