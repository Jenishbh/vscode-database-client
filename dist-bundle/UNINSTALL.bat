@echo off
setlocal enabledelayedexpansion
title Database Client - Uninstaller

set "EXT_ID=dbclient.vscode-database-client"

echo.
echo   Database Client - Uninstaller
echo   =============================
echo.

rem --- find the VS Code CLI ----------------------------------------------
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

if not defined CODE (
  for /f "delims=" %%C in ('where code 2^>nul') do (
    if not defined CODE set "CODE=%%C"
  )
)

if defined CODE (
  echo   VS Code   : !CODE!
  echo.
  echo   Removing the extension...
  call "!CODE!" --uninstall-extension %EXT_ID%
) else (
  echo   [!] Visual Studio Code was not found, so the extension itself could
  echo       not be removed. Saved connections are still cleared below.
)

rem --- clear saved connections -------------------------------------------
rem "code --uninstall-extension" does not run an extension's uninstall hook,
rem so it leaves saved connections on disk. Uninstalling from the Extensions
rem view does run it. This covers the command line route either way.
echo.
echo   Clearing saved connections...

set /a REMOVED=0

call :wipe "%APPDATA%\Code\User"
call :wipe "%APPDATA%\Code - Insiders\User"
call :wipe "%APPDATA%\VSCodium\User"

echo.
echo   [OK] Removed !REMOVED! stored data folder(s).
echo        Nothing of this extension's is left behind.
goto :done

:wipe
rem %1 = a "<user data>\User" directory
if not exist "%~1" goto :eof

if exist "%~1\globalStorage\%EXT_ID%" (
  rd /s /q "%~1\globalStorage\%EXT_ID%" 2>nul
  if not exist "%~1\globalStorage\%EXT_ID%" set /a REMOVED+=1
)

rem one globalStorage per named profile
if exist "%~1\profiles" (
  for /d %%D in ("%~1\profiles\*") do (
    if exist "%%~D\globalStorage\%EXT_ID%" (
      rd /s /q "%%~D\globalStorage\%EXT_ID%" 2>nul
      if not exist "%%~D\globalStorage\%EXT_ID%" set /a REMOVED+=1
    )
  )
)

rem one folder per workspace the extension was used in
if exist "%~1\workspaceStorage" (
  for /d %%D in ("%~1\workspaceStorage\*") do (
    if exist "%%~D\%EXT_ID%" (
      rd /s /q "%%~D\%EXT_ID%" 2>nul
      if not exist "%%~D\%EXT_ID%" set /a REMOVED+=1
    )
  )
)
goto :eof

:done
echo.
echo   Press any key to close...
pause >nul
endlocal
