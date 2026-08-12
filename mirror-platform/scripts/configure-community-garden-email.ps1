[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$backendDirectory = Join-Path $projectRoot 'codex\backend'
$envPath = Join-Path $backendDirectory '.env'

function Set-DotEnvValue {
  param(
    [Parameter(Mandatory = $true)][System.Collections.Generic.List[string]]$Lines,
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][string]$Value
  )

  if ($Value.Contains("`r") -or $Value.Contains("`n")) {
    throw "$Name cannot contain a newline."
  }

  $replacement = "$Name=$Value"
  $pattern = '^' + [Regex]::Escape($Name) + '='
  for ($index = 0; $index -lt $Lines.Count; $index++) {
    if ($Lines[$index] -match $pattern) {
      $Lines[$index] = $replacement
      return
    }
  }

  $Lines.Add($replacement)
}

Write-Host 'Community Garden - Resend email setup' -ForegroundColor Cyan
Write-Host 'The API token is masked and is saved only in codex\backend\.env.'
Write-Host ''

$secureToken = Read-Host 'Paste the Resend API key' -AsSecureString
$tokenPointer = [IntPtr]::Zero
$token = $null

try {
  $tokenPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureToken)
  $token = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($tokenPointer)
  if ([string]::IsNullOrWhiteSpace($token) -or $token.Length -lt 20) {
    throw 'The Resend API key is missing or unexpectedly short.'
  }

  $lines = [System.Collections.Generic.List[string]]::new()
  if (Test-Path -LiteralPath $envPath) {
    foreach ($line in [IO.File]::ReadAllLines($envPath)) {
      $lines.Add($line)
    }
  }

  Set-DotEnvValue -Lines $lines -Name 'SMTP_HOST' -Value 'smtp.resend.com'
  Set-DotEnvValue -Lines $lines -Name 'SMTP_PORT' -Value '465'
  Set-DotEnvValue -Lines $lines -Name 'SMTP_SECURE' -Value 'true'
  Set-DotEnvValue -Lines $lines -Name 'SMTP_USER' -Value 'resend'
  Set-DotEnvValue -Lines $lines -Name 'SMTP_PASS' -Value $token
  Set-DotEnvValue -Lines $lines -Name 'SMTP_FROM' -Value 'Community Garden <no-reply@acommunitygarden.garden>'
  Set-DotEnvValue -Lines $lines -Name 'PUBLIC_APP_URL' -Value 'https://acommunitygarden.garden'
  Set-DotEnvValue -Lines $lines -Name 'PUBLIC_SIGNUP_ENABLED' -Value 'true'

  [IO.File]::WriteAllLines($envPath, $lines, [Text.UTF8Encoding]::new($false))
}
finally {
  if ($tokenPointer -ne [IntPtr]::Zero) {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($tokenPointer)
  }
  $token = $null
  $secureToken = $null
}

Write-Host ''
Write-Host 'Resend SMTP settings were saved locally.' -ForegroundColor Green
$recipient = Read-Host 'Test recipient email (press Enter to skip the delivery test)'

if (-not [string]::IsNullOrWhiteSpace($recipient)) {
  $previousRecipient = $env:TEST_EMAIL_TO
  try {
    $env:TEST_EMAIL_TO = $recipient.Trim()
    Push-Location $backendDirectory
    try {
      & pnpm exec node scripts/verify-email-delivery.js
      if ($LASTEXITCODE -ne 0) {
        throw "The email delivery test exited with code $LASTEXITCODE."
      }
    }
    finally {
      Pop-Location
    }
  }
  finally {
    $env:TEST_EMAIL_TO = $previousRecipient
  }
}

Write-Host ''
Write-Host 'Restart Community Garden so the live service loads the new email settings.' -ForegroundColor Yellow
