$ErrorActionPreference = 'Stop'
$apiRoot = Split-Path -Parent $PSScriptRoot
$logDirectory = Join-Path $apiRoot 'backups\logs'
New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null
$logFile = Join-Path $logDirectory 'scheduled-backup.log'
$node = 'C:\Program Files\nodejs\node.exe'

Set-Location $apiRoot
"[$(Get-Date -Format o)] Starting scheduled backup" | Add-Content -LiteralPath $logFile
& $node 'src\db\backup.js' backup 2>&1 | Add-Content -LiteralPath $logFile
if ($LASTEXITCODE -ne 0) { throw "Backup process failed with exit code $LASTEXITCODE" }

Get-ChildItem -LiteralPath (Join-Path $apiRoot 'backups') -Filter 'backup-*.sql' -File |
  Where-Object LastWriteTime -lt (Get-Date).AddDays(-30) |
  Remove-Item -Force
"[$(Get-Date -Format o)] Scheduled backup complete" | Add-Content -LiteralPath $logFile
