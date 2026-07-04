@echo off
cd /d "%~dp0"
git add src/app/dashboard/expedientes/page.tsx
git commit -m "Fix: cargar todos los pacientes con paginacion + ventas por paciente"
git push
echo.
echo ✅ Listo — Vercel desplegando en ~1 min
pause
