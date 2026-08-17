[CmdletBinding()]
param(
  [switch]$Rotate
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$environmentPath = Join-Path $projectRoot 'codex\backend\.env'
if (-not (Test-Path -LiteralPath $environmentPath)) {
  throw "The backend environment file was not found at $environmentPath."
}

$lines = [Collections.Generic.List[string]]::new()
$existingSecret = $null
foreach ($line in [IO.File]::ReadAllLines($environmentPath)) {
  if ($line -match '^GARDEN_WEB_BOT_AUTH_SECRET=(.+)$') {
    $existingSecret = $Matches[1].Trim()
    if (-not $Rotate) { $lines.Add($line) }
    continue
  }
  $lines.Add($line)
}

if (-not $existingSecret -or $Rotate) {
  $bytes = [byte[]]::new(32)
  $generator = [Security.Cryptography.RandomNumberGenerator]::Create()
  try {
    $generator.GetBytes($bytes)
  } finally {
    $generator.Dispose()
  }
  $secret = [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
  $lines.Add("GARDEN_WEB_BOT_AUTH_SECRET=$secret")
  [Array]::Clear($bytes, 0, $bytes.Length)
  $secret = $null
}

$temporaryPath = "$environmentPath.web-bot-auth.tmp"
[IO.File]::WriteAllLines($temporaryPath, $lines, [Text.UTF8Encoding]::new($false))
Move-Item -LiteralPath $temporaryPath -Destination $environmentPath -Force

Write-Output 'ARI Web Bot Auth signing material was stored server-side. The private material was not displayed.'
Write-Output 'Restart Community Garden so the signed public key directory and outbound request signer use the same identity.'
