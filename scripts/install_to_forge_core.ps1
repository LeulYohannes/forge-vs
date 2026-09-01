# ==============================================================================
# Forge AI: Automated 1-Click Installer for Backend & Company Dashboard
# ==============================================================================

$ErrorActionPreference = "Stop"

$CorePath = "C:\Users\leuly\Forge_AI_core"
$EnginePath = Join-Path $CorePath "engine"
$UiPath = Join-Path $CorePath "ui"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Split-Path -Parent $ScriptDir

Write-Host "Starting Forge AI Backend and Dashboard Deployment..." -ForegroundColor Cyan

# 1. Ensure destination directories exist
$EngineDbDir = Join-Path $EnginePath "src\db"
$EngineNodesDir = Join-Path $EnginePath "src\nodes"
$EngineRoutesDir = Join-Path $EnginePath "src\routes"

$UiCompanyDashboardDir = Join-Path $UiPath "src\app\company\dashboard"
$UiCompanySignupDir = Join-Path $UiPath "src\app\company\signup"
$UiCompanyLoginDir = Join-Path $UiPath "src\app\company\login"

New-Item -ItemType Directory -Force -Path $EngineDbDir | Out-Null
New-Item -ItemType Directory -Force -Path $EngineNodesDir | Out-Null
New-Item -ItemType Directory -Force -Path $EngineRoutesDir | Out-Null

New-Item -ItemType Directory -Force -Path $UiCompanyDashboardDir | Out-Null
New-Item -ItemType Directory -Force -Path $UiCompanySignupDir | Out-Null
New-Item -ItemType Directory -Force -Path $UiCompanyLoginDir | Out-Null

# 2. Copy Backend Engine Files
Write-Host "Copying Backend Files to $EnginePath..." -ForegroundColor Yellow

Copy-Item (Join-Path $RepoRoot "reference\backend\supabase_db.py") (Join-Path $EngineDbDir "supabase.py") -Force
Copy-Item (Join-Path $RepoRoot "reference\backend\ticket_generator.py") (Join-Path $EngineNodesDir "ticket_generator.py") -Force
Copy-Item (Join-Path $RepoRoot "reference\backend\routes_companies.py") (Join-Path $EngineRoutesDir "companies.py") -Force
Copy-Item (Join-Path $RepoRoot "reference\backend\routes_assignments.py") (Join-Path $EngineRoutesDir "assignments.py") -Force
Copy-Item (Join-Path $RepoRoot "reference\backend\routes_evaluate.py") (Join-Path $EngineRoutesDir "evaluate.py") -Force

# Create __init__.py files if missing
@($EngineDbDir, $EngineRoutesDir) | ForEach-Object {
    $init = Join-Path $_ "__init__.py"
    if (-not (Test-Path $init)) { New-Item -ItemType File -Path $init -Force | Out-Null }
}

# 3. Update engine/api.py
$UpdatedApiPy = @'
import sys
import os
from pathlib import Path

# Add engine directory to Python path
engine_dir = Path(__file__).resolve().parent
sys.path.insert(0, str(engine_dir))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from src.routes.companies import router as companies_router
from src.routes.assignments import router as assignments_router
from src.routes.evaluate import router as evaluate_router

app = FastAPI(title="Forge AI Engine", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routes
app.include_router(companies_router)
app.include_router(assignments_router)
app.include_router(evaluate_router)

@app.get("/")
def read_root():
    return {"message": "Forge AI Engine is running", "status": "ready"}
'@

Set-Content -Path (Join-Path $EnginePath "api.py") -Value $UpdatedApiPy -Encoding UTF8
Write-Host "Backend API updated successfully!" -ForegroundColor Green

# 4. Copy Dashboard UI Files
Write-Host "Copying Dashboard Pages to $UiPath..." -ForegroundColor Yellow

Copy-Item (Join-Path $RepoRoot "reference\dashboard\company_dashboard_page.tsx") (Join-Path $UiCompanyDashboardDir "page.tsx") -Force
Copy-Item (Join-Path $RepoRoot "reference\dashboard\company_signup_page.tsx") (Join-Path $UiCompanySignupDir "page.tsx") -Force
Copy-Item (Join-Path $RepoRoot "reference\dashboard\company_login_page.tsx") (Join-Path $UiCompanyLoginDir "page.tsx") -Force

Write-Host "Company Dashboard Pages installed successfully!" -ForegroundColor Green
Write-Host "ALL DONE! Your Backend and Company Dashboard are fully deployed to Forge_AI_core!" -ForegroundColor Green
