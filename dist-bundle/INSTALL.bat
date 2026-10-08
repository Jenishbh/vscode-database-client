@echo off
setlocal enabledelayedexpansion
title Database Client - Installer

echo.
echo   Database Client - Installer
echo   ======================================
echo.

rem --- find the .vsix sitting next to this script -------------------------
set "VSIX="
for %%F in ("%~dp0*.vsix") do set "VSIX=%%~fF"

if not defined VSIX (
  echo   [X] No .vsix file found next to this script.
  echo.
  echo       Keep INSTALL.bat and vscode-database-client-*.vsix in the
  echo       same folder, then run this again.
  goto :done
)

echo   Extension : %VSIX%

rem --- find the VS Code CLI ----------------------------------------------
rem The CLI is the only path that reliably installs a locally built .vsix.
set "CODE="

for %%P in (
  "%LOCALAPPDATA%\Programs\Microsoft VS Code\bin\code.cmd"
  "%ProgramFiles%\Microsoft VS Code\bin\code.cmd"
  "%ProgramFiles(x86)%\Microsoft VS Code\bin\code.cmd"
  "%LOCALAPPDATA%\Programs\Microsoft VS Code Insiders\bin\code-insiders.cmd"
  "%ProgramFiles%\Microsoft VS Code Insiders\bin\code-insiders.cmd"
) do (
  if not defined CODE if exist "%%~P" set "CODE=%%~P"
)

rem fall back to whatever owns 'code' on PATH
if not defined CODE (
  for /f "delims=" %%C in ('where code 2^>nul') do (
    if not defined CODE set "CODE=%%C"
  )
)

if not defined CODE (
  echo.
  echo   [X] Visual Studio Code was not found.
  echo.
  echo       Install it from https://code.visualstudio.com/ and run this again.
  echo       If VS Code is installed somewhere unusual, you can install manually:
  echo.
  echo         code --install-extension "%VSIX%"
  goto :done
)

echo   VS Code   : %CODE%
echo.
echo   Installing...
echo.

call "%CODE%" --install-extension "%VSIX%" --force
if errorlevel 1 (
  echo.
  echo   [X] Install failed. The output above says why.
  goto :done
)

echo.
echo   [OK] Installed.
echo.
echo   Next steps
echo     1. Restart VS Code.
echo     2. Look for "Database" in the activity bar on the left.
echo     3. Add a connection with the + button. Nothing is set up in advance.
echo.
echo   Nothing else to install: every driver and the Java runtime that JDBC
echo   connections need are packaged with the extension.

:done
echo.
echo   Press any key to close...
pause >nul
endlocal
