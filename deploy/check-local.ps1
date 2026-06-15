param(
  [string]$BaseUrl = "http://127.0.0.1:3000"
)

$ErrorActionPreference = "Stop"

function Test-Endpoint {
  param(
    [string]$Path,
    [int]$ExpectedStatus = 200
  )

  $url = "$BaseUrl$Path"
  $response = Invoke-WebRequest -Uri $url -MaximumRedirection 5 -UseBasicParsing

  if ($response.StatusCode -ne $ExpectedStatus) {
    throw "ERREUR $Path : HTTP $($response.StatusCode), attendu $ExpectedStatus"
  }

  Write-Host "OK $Path -> HTTP $($response.StatusCode)"
  return $response
}

$health = Test-Endpoint -Path "/api/health"
if ($health.Content -notmatch '"status"\s*:\s*"ok"') {
  throw "ERREUR /api/health : status ok introuvable"
}

Test-Endpoint -Path "/manifest.json" | Out-Null
Test-Endpoint -Path "/sw.js" | Out-Null
Test-Endpoint -Path "/offline" | Out-Null

Write-Host "Controle local termine pour $BaseUrl"
