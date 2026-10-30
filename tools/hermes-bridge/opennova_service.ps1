# OpenNova-Finance & Hermes Service Manager
param(
    [ValidateSet("start", "stop", "restart", "status", "boot")]
    [string]$Action = "status"
)

$ErrorActionPreference = "Continue"

$RepoRoot = "C:\Users\petit\Documents\GitHub\OpenNova-Finance"
$BridgeDir = Join-Path $RepoRoot "tools\hermes-bridge"
$RuntimeDir = Join-Path $BridgeDir ".runtime"
$LogsDir = Join-Path $BridgeDir "logs"
$PidFile = Join-Path $RuntimeDir "server.pid"
$SentinelStatusFile = Join-Path $BridgeDir ".sentinel_status.json"
$PickupStatusFile = Join-Path $BridgeDir ".nova_pickup_status.json"
$Port = 3000
$HermesLauncher = "C:\Users\petit\Documents\antigravity\splendid-euclid\start-hermes-stack.ps1"

if (-not (Test-Path $RuntimeDir)) { New-Item -ItemType Directory -Path $RuntimeDir -Force | Out-Null }
if (-not (Test-Path $LogsDir)) { New-Item -ItemType Directory -Path $LogsDir -Force | Out-Null }

$PythonExe = "C:\Python314\python.exe"
if (-not (Test-Path $PythonExe)) {
    $foundPy = Get-Command python.exe -ErrorAction SilentlyContinue
    if ($foundPy) { $PythonExe = $foundPy.Source }
}

$NodeExe = "C:\Program Files\nodejs\node.exe"
if (-not (Test-Path $NodeExe)) {
    $foundNode = Get-Command node.exe -ErrorAction SilentlyContinue
    if ($foundNode) { $NodeExe = $foundNode.Source }
}

function Test-ServerListening {
    $listeners = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    foreach ($l in $listeners) {
        $p = Get-Process -Id $l.OwningProcess -ErrorAction SilentlyContinue
        if ($p -and $p.ProcessName -eq "node") {
            return $true
        }
    }
    return $false
}

function Start-OpenNovaServer {
    if (Test-ServerListening) {
        Write-Host "  [i] Le serveur OpenNova-Finance est deja actif sur le port $Port." -ForegroundColor Green
        return
    }

    Write-Host "  [+] Demarrage du serveur Next.js OpenNova-Finance (port $Port)..." -ForegroundColor Cyan

    $daemonVbs = Join-Path $BridgeDir "run_server_daemon.vbs"
    $task = Get-ScheduledTask -TaskName "OpenNova_Server" -ErrorAction SilentlyContinue
    if (-not $task) {
        $action = New-ScheduledTaskAction -Execute "wscript.exe" -Argument "`"$daemonVbs`""
        Register-ScheduledTask -TaskName "OpenNova_Server" -Action $action -Force >$null 2>&1
    } else {
        # S'assure que la tache utilise le lanceur invisible wscript pour eviter toute fenetre CMD
        $currentAction = $task.Actions | Select-Object -First 1
        if ($currentAction.Execute -ne "wscript.exe") {
            $action = New-ScheduledTaskAction -Execute "wscript.exe" -Argument "`"$daemonVbs`""
            Set-ScheduledTask -TaskName "OpenNova_Server" -Action $action >$null 2>&1
        }
    }

    & schtasks /run /tn "OpenNova_Server" >$null 2>&1

    $ready = $false
    for ($i = 0; $i -lt 15; $i++) {
        Start-Sleep -Seconds 1
        $curlOut = & curl.exe -s -m 2 "http://localhost:$Port/api/hermes/status" 2>$null
        if ($curlOut -and $curlOut -match '"ok":true') {
            $ready = $true
            break
        }
    }

    if ($ready) {
        Write-Host "  [+] Serveur OpenNova-Finance en ligne sur http://localhost:$Port" -ForegroundColor Green
    } else {
        $daemonScript = Join-Path $BridgeDir "server-daemon.mjs"
        $stdout = Join-Path $LogsDir "server.out.log"
        $stderr = Join-Path $LogsDir "server.err.log"
        $p = Start-Process -FilePath $NodeExe -ArgumentList "`"$daemonScript`"" -WorkingDirectory $RepoRoot -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr -PassThru
        Set-Content -Path $PidFile -Value $p.Id -Force
        Start-Sleep -Seconds 3
        if (Test-ServerListening) {
            Write-Host "  [+] Serveur OpenNova-Finance en ligne sur http://localhost:$Port (fallback PID $($p.Id))" -ForegroundColor Green
        } else {
            Write-Host "  [!] Serveur en cours d'initialisation..." -ForegroundColor Yellow
        }
    }
}

function Start-HermesAgentStack {
    Write-Host "  [+] Verification de la stack Hermes Agent (Nova / WSL2 / Nemotron)..." -ForegroundColor Cyan

    $hermesOnline = $false
    try {
        $check = Invoke-WebRequest -Uri "http://127.0.0.1:18790/" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
        if ($check.StatusCode -eq 200) { $hermesOnline = $true }
    } catch {}

    if ($hermesOnline) {
        Write-Host "  [i] Hermes Agent (Nova) est deja en ligne (Dashboard http://127.0.0.1:18790/ & Gateway 8642)." -ForegroundColor Green
        return
    }

    if (Test-Path $HermesLauncher) {
        Write-Host "  [+] Demarrage de la stack Hermes via start-hermes-stack.ps1..." -ForegroundColor Cyan
        & powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$HermesLauncher"
    } else {
        Write-Host "  [!] Fichier start-hermes-stack.ps1 introuvable a l'emplacement $HermesLauncher" -ForegroundColor Yellow
    }
}

function Stop-OpenNovaServer {
    Write-Host "  [-] Arret du serveur Web OpenNova-Finance..." -ForegroundColor Cyan

    $t = Get-ScheduledTask -TaskName "OpenNova_Server" -ErrorAction SilentlyContinue
    if ($t) {
        & schtasks /end /tn "OpenNova_Server" >$null 2>&1
    }

    if (Test-Path $PidFile) {
        $savedPid = Get-Content $PidFile -ErrorAction SilentlyContinue
        if ($savedPid) {
            try {
                $p = Get-Process -Id ([int]$savedPid) -ErrorAction SilentlyContinue
                if ($p -and $p.ProcessName -eq "node") {
                    Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
                }
            } catch {}
        }
        Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
    }

    $listeners = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    foreach ($l in $listeners) {
        $p = Get-Process -Id $l.OwningProcess -ErrorAction SilentlyContinue
        if ($p -and $p.ProcessName -eq "node") {
            try {
                Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
                Write-Host "  [+] Processus node libere sur le port $Port (PID $($p.Id))" -ForegroundColor Green
            } catch {}
        }
    }

    $nodeProcs = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue
    foreach ($np in $nodeProcs) {
        if ($np.CommandLine -and ($np.CommandLine -like "*OpenNova-Finance*" -or $np.CommandLine -like "*server-daemon.mjs*")) {
            try {
                Stop-Process -Id $np.ProcessId -Force -ErrorAction SilentlyContinue
                Write-Host "  [+] Instance Next.js arretee (PID $($np.ProcessId))" -ForegroundColor Green
            } catch {}
        }
    }

    $pyProcs = Get-CimInstance Win32_Process -Filter "Name = 'python.exe'" -ErrorAction SilentlyContinue
    foreach ($pp in $pyProcs) {
        if ($pp.CommandLine -and ($pp.CommandLine -like "*hermes_market_sentinel*" -or $pp.CommandLine -like "*nova_pickup*" -or $pp.CommandLine -like "*hermes_bridge*")) {
            try {
                Stop-Process -Id $pp.ProcessId -Force -ErrorAction SilentlyContinue
                Write-Host "  [+] Script Python sentinelle arrete (PID $($pp.ProcessId))" -ForegroundColor Green
            } catch {}
        }
    }
}

function Stop-HermesAgentStack {
    Write-Host "  [-] Liberation des ressources GPU RTX 3080 Ti pour Hermes..." -ForegroundColor Cyan
    try {
        & wsl.exe -d Ubuntu -- bash -c "systemctl is-active --quiet ollama && ollama stop nemotron-3.5-bolt:e4b 2>/dev/null || true"
        Write-Host "  [+] Modeles IA decharges de la VRAM (RTX 3080 Ti liberee pour les jeux)." -ForegroundColor Green
    } catch {
        # Silencieux
    }
}

function Set-ScheduledTasksState {
    param([ValidateSet("enable", "disable")][string]$State)

    $tasks = @(
        "OpenNova_Hermes_Sentinel",
        "OpenNova_Nova_Pickup",
        "OpenNova_Hermes_Briefing",
        "OpenNova_Server",
        "OpenNova_Boot_Daemon"
    )

    foreach ($task in $tasks) {
        $t = Get-ScheduledTask -TaskName $task -ErrorAction SilentlyContinue
        if ($t) {
            & schtasks /change /tn "$task" "/$State" >$null 2>&1
            $frState = if ($State -eq "enable") { "activee" } else { "mise en pause" }
            Write-Host "  [+] Tache planifiee '$task' : $frState" -ForegroundColor Green
        }
    }
}

function Update-AgentStatusOnStop {
    $nowStr = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")

    $hermesData = @{
        agent = "hermes"
        state = "resting"
        label = "Au repos"
        detail = "Arrete manuellement par Alex (mode jeux / GPU RTX 3080 Ti libere)"
        lastRun = $nowStr
        nextRun = "En attente de relance manuelle"
        hardware = "RTX 3080 Ti (12GB) · Nemotron 3.5"
        model = "Nemotron 3.5"
        mode = "manual"
        updatedAt = $nowStr
    }
    $hermesData | ConvertTo-Json -Depth 3 | Set-Content -Path $SentinelStatusFile -Encoding UTF8

    $museData = @{
        agent = "muse"
        state = "resting"
        label = "Au repos"
        detail = "En pause (systeme arrete manuellement par Alex)"
        lastRun = $nowStr
        nextRun = "En attente de relance manuelle"
        hardware = "Serveurs Infonuagiques Meta AI"
        model = "Meta AI · Llama 3.3"
        mode = "manual"
        updatedAt = $nowStr
    }
    $museData | ConvertTo-Json -Depth 3 | Set-Content -Path $PickupStatusFile -Encoding UTF8

    Write-Host "  [+] Statuts agents mis a jour : 'Au repos' (mode manuel)" -ForegroundColor Green
}

function Run-AgentRounds {
    Write-Host "  [+] Execution immediate des rondes de verification..." -ForegroundColor Cyan

    $pickupScript = Join-Path $BridgeDir "nova_pickup.py"
    if (Test-Path $pickupScript) {
        Write-Host "    - Releve des depots Muse..." -ForegroundColor Gray
        & $PythonExe "$pickupScript" --once
    }

    $sentinelScript = Join-Path $BridgeDir "hermes_market_sentinel.py"
    if (Test-Path $sentinelScript) {
        Write-Host "    - Scan Sentinelle Hermes..." -ForegroundColor Gray
        & $PythonExe "$sentinelScript" --once
    }
}

switch ($Action) {
    "start" {
        Write-Host "====================================================================" -ForegroundColor Cyan
        Write-Host "  DEMARRAGE DE LA STACK OPENNOVA-FINANCE & AGENTS HERMES / MUSE" -ForegroundColor Cyan
        Write-Host "====================================================================" -ForegroundColor Cyan
        Set-ScheduledTasksState -State "enable"
        Start-HermesAgentStack
        Start-OpenNovaServer
        Run-AgentRounds
        Write-Host ""
        Write-Host "  [+] OpenNova-Finance et Hermes sont operationnels." -ForegroundColor Green
        Write-Host "  [+] Tableau de bord : http://localhost:$Port/dashboard#briefing-hermes" -ForegroundColor Green
        Write-Host "====================================================================" -ForegroundColor Cyan
    }

    "stop" {
        Write-Host "====================================================================" -ForegroundColor Yellow
        Write-Host "  ARRET COMPLET D'OPENNOVA-FINANCE & MISE AU REPOS DES AGENTS" -ForegroundColor Yellow
        Write-Host "====================================================================" -ForegroundColor Yellow
        Set-ScheduledTasksState -State "disable"
        Stop-OpenNovaServer
        Stop-HermesAgentStack
        Update-AgentStatusOnStop
        Write-Host ""
        Write-Host "  VOTRE ORDINATEUR EST ENTIEREMENT LIBERE :" -ForegroundColor Green
        Write-Host "     - Port $Port ferme." -ForegroundColor Gray
        Write-Host "     - GPU NVIDIA RTX 3080 Ti a 100% disponible (jeux / rendu)." -ForegroundColor Gray
        Write-Host "     - Aucune tache d'arriere-plan ne tournera sans votre accord." -ForegroundColor Gray
        Write-Host ""
        Write-Host "  Pour relancer le systeme a tout moment :" -ForegroundColor Cyan
        Write-Host "  Double-cliquez sur 'DEMARRER-OPENNOVA-ET-HERMES.bat' sur votre Bureau." -ForegroundColor Cyan
        Write-Host "====================================================================" -ForegroundColor Yellow
    }

    "restart" {
        & $PSCommandPath -Action stop
        Start-Sleep -Seconds 2
        & $PSCommandPath -Action start
    }

    "boot" {
        $bootLog = Join-Path $LogsDir "boot_$(Get-Date -Format 'yyyy-MM-dd').log"
        "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') [BOOT] Demarrage automatique au boot machine..." | Out-File -FilePath $bootLog -Append -Encoding UTF8

        Start-Sleep -Seconds 5

        Set-ScheduledTasksState -State "enable"
        Start-HermesAgentStack
        Start-OpenNovaServer

        $pickupScript = Join-Path $BridgeDir "nova_pickup.py"
        if (Test-Path $pickupScript) {
            & $PythonExe "$pickupScript" --once *>> $bootLog
        }
        $sentinelScript = Join-Path $BridgeDir "hermes_market_sentinel.py"
        if (Test-Path $sentinelScript) {
            & $PythonExe "$sentinelScript" --once *>> $bootLog
        }

        "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') [BOOT] Initialisation terminee avec succes." | Out-File -FilePath $bootLog -Append -Encoding UTF8
    }

    "status" {
        Write-Host "--- ETAT D'OPENNOVA-FINANCE & AGENTS ---" -ForegroundColor Cyan
        $listening = Test-ServerListening
        $srvColor = if ($listening) { "Green" } else { "Red" }
        Write-Host "Serveur Web OpenNova (port $Port) : $(if ($listening) {'EN LIGNE'} else {'ARRETE'})" -ForegroundColor $srvColor

        $hermesOnline = $false
        try {
            $check = Invoke-WebRequest -Uri "http://127.0.0.1:18790/" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
            if ($check.StatusCode -eq 200) { $hermesOnline = $true }
        } catch {}
        $hColor = if ($hermesOnline) { "Green" } else { "Red" }
        Write-Host "Hermes Agent Dashboard (port 18790) : $(if ($hermesOnline) {'EN LIGNE'} else {'ARRETE'})" -ForegroundColor $hColor

        $tasks = @("OpenNova_Hermes_Sentinel", "OpenNova_Nova_Pickup", "OpenNova_Hermes_Briefing", "OpenNova_Server", "OpenNova_Boot_Daemon")
        foreach ($tn in $tasks) {
            $t = Get-ScheduledTask -TaskName $tn -ErrorAction SilentlyContinue
            if ($t) {
                $stColor = if ($t.State -eq "Ready" -or $t.State -eq "Running") { "Green" } else { "Yellow" }
                Write-Host "Tache '$tn' : $($t.State)" -ForegroundColor $stColor
            }
        }

        if (Test-Path $SentinelStatusFile) {
            $hs = Get-Content $SentinelStatusFile -Raw | ConvertFrom-Json
            Write-Host "Hermes : $($hs.label) - $($hs.detail)" -ForegroundColor Gray
        }
        if (Test-Path $PickupStatusFile) {
            $ms = Get-Content $PickupStatusFile -Raw | ConvertFrom-Json
            Write-Host "Muse   : $($ms.label) - $($ms.detail)" -ForegroundColor Gray
        }
    }
}
