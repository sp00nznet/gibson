@echo off
rem GIBSON quick start. Checks Node, installs the packages, makes a shortcut.
rem Runs exactly the steps in README "Step by step". Safe to rerun: done steps are skipped.
setlocal
cd /d "%~dp0"
set LOG=%~dp0setup.log
echo GIBSON setup %date% %time% > "%LOG%"
echo.
echo   ===  G I B S O N  ===   jacking in...
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo Node.js is not installed. GIBSON needs it to run ^(about 30 MB, from nodejs.org via winget^).
  choice /m "Install Node.js LTS now"
  if errorlevel 2 ( echo Install Node.js 20 or newer from https://nodejs.org, then run Setup.cmd again. & goto :fail )
  winget install -e --id OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements >> "%LOG%" 2>&1
  if errorlevel 1 ( echo Node.js did not install. Details are in %LOG% & goto :fail )
  echo Node.js installed. Close this window and run Setup.cmd again so the new PATH is picked up.
  pause & exit /b 0
)
for /f %%v in ('node -v') do echo Node %%v found.

if exist "node_modules\electron\dist\electron.exe" if exist "node_modules\node-pty" (
  echo Packages already installed, skipping.
  goto :check
)
echo Installing packages ^(Electron and the terminal pieces, about 250 MB^)...
call npm install >> "%LOG%" 2>&1
if errorlevel 1 ( echo npm install failed. Details are in %LOG% & goto :fail )

:check
call npm test >> "%LOG%" 2>&1
if errorlevel 1 ( echo The self-check failed. Details are in %LOG% & goto :fail )
echo Self-check passed.

where ollama >nul 2>&1
if not errorlevel 1 (
  ollama list 2>nul | findstr /b /c:"llama3.2:3b" >nul
  if errorlevel 1 (
    echo Ollama is installed. NYX can use a small local model to talk ^(llama3.2:3b, about 2 GB^).
    choice /m "Download it now"
    if not errorlevel 2 ollama pull llama3.2:3b
  )
)

powershell -NoProfile -Command "$s=(New-Object -ComObject WScript.Shell).CreateShortcut('%~dp0GIBSON.lnk'); $s.TargetPath='%~dp0node_modules\electron\dist\electron.exe'; $s.Arguments='\"%~dp0.\"'; $s.WorkingDirectory='%~dp0'; $s.IconLocation='%~dp0build\icon.ico'; $s.Save()" >> "%LOG%" 2>&1
echo.
echo Done. Double-click GIBSON.lnk in this folder to jack in.
echo.
pause
exit /b 0

:fail
echo.
pause
exit /b 1
