@echo off
echo Running Forge AI Auto-Deploy...
powershell -ExecutionPolicy Bypass -File "%~dp0scripts\install_to_forge_core.ps1"
pause
