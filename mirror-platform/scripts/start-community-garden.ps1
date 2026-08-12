[CmdletBinding()]
param(
  [ValidateRange(5, 300)]
  [int]$PollSeconds = 15
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$stateDirectory = Join-Path $env:LOCALAPPDATA 'CommunityGarden'
$logDirectory = Join-Path $stateDirectory 'logs'
$supervisorLog = Join-Path $logDirectory 'autostart.log'
$platformStdout = Join-Path $logDirectory 'platform.out.log'
$platformStderr = Join-Path $logDirectory 'platform.err.log'
$tunnelLog = Join-Path $logDirectory 'tunnel.log'
$cloudflared = Join-Path $env:LOCALAPPDATA 'Programs\cloudflared\cloudflared.exe'
$ollama = Join-Path $env:LOCALAPPDATA 'Programs\Ollama\ollama.exe'
$pnpm = Join-Path $env:APPDATA 'npm\pnpm.cmd'
$requiredApplicationPorts = @(3000, 3100, 3200, 4173, 11435)

New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null

function Write-GardenLog {
  param([string]$Message)
  $line = "$(Get-Date -Format 'yyyy-MM-ddTHH:mm:ssK') $Message"
  Add-Content -LiteralPath $supervisorLog -Value $line
}

function Test-LocalPort {
  param([int]$Port)
  $client = [System.Net.Sockets.TcpClient]::new()
  try {
    $connection = $client.ConnectAsync('127.0.0.1', $Port)
    if (-not $connection.Wait(1000)) { return $false }
    return $client.Connected
  } catch {
    return $false
  } finally {
    $client.Dispose()
  }
}

function Get-MissingApplicationPorts {
  return @($requiredApplicationPorts | Where-Object { -not (Test-LocalPort -Port $_) })
}

function Wait-ForApplication {
  param([int]$TimeoutSeconds = 180)
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  do {
    $missing = @(Get-MissingApplicationPorts)
    if ($missing.Count -eq 0) { return $true }
    Start-Sleep -Seconds 3
  } while ((Get-Date) -lt $deadline)
  return $false
}

function Ensure-LocalDependencies {
  try {
    $postgres = Get-Service -Name 'postgresql-x64-18' -ErrorAction Stop
    if ($postgres.Status -ne 'Running') {
      Start-Service -Name $postgres.Name
      Write-GardenLog 'Started the PostgreSQL service.'
    }
  } catch {
    Write-GardenLog "PostgreSQL service check failed: $($_.Exception.Message)"
  }

  if (-not (Test-LocalPort -Port 11434)) {
    if (-not (Test-Path -LiteralPath $ollama)) {
      Write-GardenLog "Ollama is unavailable at $ollama."
      return
    }
    Start-Process -FilePath $ollama -ArgumentList @('serve') -WindowStyle Hidden | Out-Null
    Write-GardenLog 'Started the local Ollama service.'
  }
}

function Start-GardenPlatform {
  if (-not (Test-Path -LiteralPath $pnpm)) {
    throw "pnpm was not found at $pnpm."
  }

  $env:GARDEN_GATEWAY_TRUST_PROXY = 'true'
  $env:MIRROR_TRUST_PROXY = 'true'
  $env:MIRROR_RUNTIME_URL = 'http://127.0.0.1:3100'
  $env:GARDEN_GATEWAY_PORT = '3200'
  $env:LOCAL_MODEL_NAME = 'mirror-qwen3-conversation:v2'

  Write-GardenLog 'Starting the protected Community Garden application stack.'
  return Start-Process `
    -FilePath $pnpm `
    -ArgumentList @('dev') `
    -WorkingDirectory $projectRoot `
    -WindowStyle Hidden `
    -RedirectStandardOutput $platformStdout `
    -RedirectStandardError $platformStderr `
    -PassThru
}

function Get-NamedTunnelProcess {
  return Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
    Where-Object {
      $_.Name -eq 'cloudflared.exe' -and
      $_.CommandLine -match 'tunnel run community-garden-entrance'
    } |
    Select-Object -First 1
}

function Ensure-NamedTunnel {
  if (Get-NamedTunnelProcess) { return }
  if (-not (Test-LocalPort -Port 3200)) { return }
  if (-not (Test-Path -LiteralPath $cloudflared)) {
    Write-GardenLog "cloudflared is unavailable at $cloudflared."
    return
  }

  Start-Process `
    -FilePath $cloudflared `
    -ArgumentList @('--loglevel', 'warn', '--logfile', $tunnelLog, 'tunnel', 'run', 'community-garden-entrance') `
    -WindowStyle Hidden | Out-Null
  Write-GardenLog 'Started the named Community Garden tunnel.'
}

Write-GardenLog 'Automatic supervisor started.'
Ensure-LocalDependencies

$platformProcess = $null
$lastPartialState = ''

while ($true) {
  try {
    $missingPorts = @(Get-MissingApplicationPorts)

    if ($missingPorts.Count -eq $requiredApplicationPorts.Count) {
      if ($null -eq $platformProcess -or $platformProcess.HasExited) {
        $platformProcess = Start-GardenPlatform
        if (Wait-ForApplication) {
          Write-GardenLog 'Community Garden application stack is ready.'
          $lastPartialState = ''
        } else {
          Write-GardenLog "Application startup timed out; missing ports: $(@(Get-MissingApplicationPorts) -join ', ')."
        }
      }
    } elseif ($missingPorts.Count -gt 0) {
      $partialState = $missingPorts -join ','
      if ($partialState -ne $lastPartialState) {
        Write-GardenLog "Waiting for a partial application stack; missing ports: $($missingPorts -join ', ')."
        $lastPartialState = $partialState
      }
    } else {
      $lastPartialState = ''
      Ensure-NamedTunnel
    }
  } catch {
    Write-GardenLog "Supervisor cycle failed: $($_.Exception.Message)"
  }

  Start-Sleep -Seconds $PollSeconds
}
