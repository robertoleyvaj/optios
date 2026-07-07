@echo off
cd /d "%~dp0"
git add src/app/dashboard/expedientes/nuevo/page.tsx src/app/dashboard/ventas/nueva/page.tsx src/app/dashboard/expedientes/page.tsx "src/app/dashboard/expedientes/[id]/resumen/page.tsx" "src/app/dashboard/expedientes/[id]/hoja/page.tsx" src/components/Sidebar.tsx src/app/dashboard/analitica/page.tsx
git commit -m "expedientes: rediseno completo - historial timeline, stats 5col, sidebar acciones"
git push
echo.
echo Listo - Vercel desplegando en ~1 min
pause
