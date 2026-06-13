@echo off
setlocal

set "REPO_ROOT=%~dp0.."
set "COREPACK_HOME=%REPO_ROOT%\.corepack"
set "PNPM_HOME=%REPO_ROOT%\.pnpm-home"
set "PATH=%PNPM_HOME%;%PATH%"

if not exist "%COREPACK_HOME%" mkdir "%COREPACK_HOME%"
if not exist "%PNPM_HOME%" mkdir "%PNPM_HOME%"

corepack pnpm %*
exit /b %ERRORLEVEL%
