[CmdletBinding()]
param(
  [string]$ZoneTag = '6efea54860510e2050e555c161c765a2'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if ($ZoneTag -notmatch '^[a-f0-9]{32}$') {
  throw 'The Cloudflare zone tag must contain exactly 32 hexadecimal characters.'
}

$secureToken = Read-Host 'Paste the least-privilege Cloudflare analytics API token' -AsSecureString
$tokenPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureToken)
try {
  $token = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($tokenPointer)
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($tokenPointer)
}

if ([string]::IsNullOrWhiteSpace($token) -or $token.Length -lt 20 -or $token.Length -gt 512 -or $token -match '\s') {
  throw 'The Cloudflare API token is missing or malformed.'
}

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$environmentPath = Join-Path $projectRoot 'codex\backend\.env'
if (-not (Test-Path -LiteralPath $environmentPath)) {
  throw "The backend environment file was not found at $environmentPath."
}

$values = [ordered]@{
  CF_ZONE_TAG = $ZoneTag.ToLowerInvariant()
  CF_ANALYTICS_TOKEN = $token
}
$lines = [Collections.Generic.List[string]]::new()
foreach ($line in [IO.File]::ReadAllLines($environmentPath)) {
  $name = if ($line -match '^([A-Z0-9_]+)=') { $Matches[1] } else { $null }
  if ($name -and $values.Contains($name)) { continue }
  $lines.Add($line)
}
foreach ($entry in $values.GetEnumerator()) {
  $lines.Add("$($entry.Key)=$($entry.Value)")
}

$temporaryPath = "$environmentPath.cloudflare.tmp"
[IO.File]::WriteAllLines($temporaryPath, $lines, [Text.UTF8Encoding]::new($false))
Move-Item -LiteralPath $temporaryPath -Destination $environmentPath -Force
$token = $null

Write-Output 'Cloudflare outside-weather configuration was stored server-side. The token was not displayed.'
Write-Output 'Restart Community Garden before refreshing the Analytics room.'
