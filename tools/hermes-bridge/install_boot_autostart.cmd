@echo off
setlocal EnableDelayedExpansion

title Installation du Demarrage Automatique au Boot - OpenNova-Finance

echo ====================================================================
echo   INSTALLATION DU DEMARRAGE AUTOMATIQUE AU BOOT (SANS DEVERROUILLAGE)
echo   OpenNova-Finance ^& Agents Hermes / Muse
echo ====================================================================
echo.

:: Verification des privileges administrateur
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [i] Privileges administrateur requis pour enregistrer une tache systeme au boot.
    echo [i] Demande d'elevation en cours via UAC...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process cmd.exe -ArgumentList '/c `\"%~f0`\"' -Verb RunAs"
    exit /b
)

set REPO=C:\Users\petit\Documents\GitHub\OpenNova-Finance
set SERVICE_SCRIPT=%REPO%\tools\hermes-bridge\opennova_service.ps1
set STARTUP_DIR=C:\Users\petit\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup
set STARTUP_CMD=%STARTUP_DIR%\OpenNova-Demarrage-Session.cmd

echo [1/3] Creation de la tache planifiee systeme 'OpenNova_Boot_Daemon' (Au demarrage du PC)...
schtasks /create /tn "OpenNova_Boot_Daemon" /tr "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File \"%SERVICE_SCRIPT%\" -Action boot" /sc ONSTART /ru "SYSTEM" /rl HIGHEST /f

if %errorlevel% equ 0 (
    echo   [+] Tache planifiee systeme creee avec succes.
) else (
    echo   [!] Echec de la creation de la tache ONSTART.
)

echo [2/3] Configuration des taches planifiees Hermes et Muse (StartWhenAvailable = True)...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$tasks = @('OpenNova_Hermes_Sentinel', 'OpenNova_Nova_Pickup', 'OpenNova_Hermes_Briefing'); foreach ($t in $tasks) { $obj = Get-ScheduledTask -TaskName $t -ErrorAction SilentlyContinue; if ($obj) { $obj.Settings.StartWhenAvailable = $true; Set-ScheduledTask -InputObject $obj >$null; Write-Host \"  [+] $t mis a jour (rattrapage automatique apres extinction active)\" } }"

echo [3/3] Ajout du lanceur de secours au dossier de demarrage utilisateur (shell:startup)...
(
echo @echo off
echo powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%SERVICE_SCRIPT%" -Action start
) > "%STARTUP_CMD%"

if exist "%STARTUP_CMD%" (
    echo   [+] Raccourci cree dans shell:startup : %STARTUP_CMD%
)

echo.
echo ====================================================================
echo   [✓] INSTALLATION REUSSIE !
echo.
echo   Desormais, lorsque vous allumez votre ordinateur :
echo   - OpenNova-Finance demarre aussitot (port 3000).
echo   - Hermes et Muse s'initialisent et scrutent les marches.
echo   - Le tout s'execute SANS MEME DEVOIR DEVERROUILLER VOTRE SESSION !
echo.
echo   A tout moment, vous pouvez arreter l'ensemble d'un clic
echo   grace au fichier 'STOP-OPENNOVA-ET-HERMES.bat' sur votre Bureau.
echo ====================================================================
echo.
pause
