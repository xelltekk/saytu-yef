#Requires -Version 7.0
$ErrorActionPreference = 'Stop'
$root = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
$test = Join-Path $root ('saytu-restore-guards-' + [Guid]::NewGuid().ToString('N'))
$null = New-Item -ItemType Directory -Path $test
$file = Join-Path $test 'saytu-yef-20261011T000000Z.dump'
$runner = Join-Path $PSScriptRoot 'test-backup-restore-windows.ps1'
$count = 0
function Save-Fixture {
  [IO.File]::WriteAllText($file, 'synthetic-test-archive')
  $hash = (Get-FileHash -LiteralPath $file).Hash.ToLowerInvariant()
  [IO.File]::WriteAllText("$file.sha256", "$hash  archive.dump`n")
  $script:roles = @{ version = 1; backup_file = [IO.Path]::GetFileName($file); dump_sha256 = $hash }
  Save-Roles
}
function Save-Roles {
  [IO.File]::WriteAllText("$file.roles.json", ($roles | ConvertTo-Json))
  $hash = (Get-FileHash -LiteralPath "$file.roles.json").Hash.ToLowerInvariant()
  [IO.File]::WriteAllText("$file.roles.json.sha256", "$hash  roles.json`n")
}
function Assert-Rejected([string]$Message) {
  $caught = $null
  try { & $runner -BackupFile $file -BackupRoot $test -PostgresBin $test } catch { $caught = $_.Exception.Message }
  if ($caught -cne $Message) { throw "Refus attendu '$Message', obtenu '$caught'." }
  if (Test-Path -LiteralPath (Join-Path $test 'restore-tests')) { throw 'Le refus doit preceder toute preparation PostgreSQL.' }
  $script:count++
}
try {
  Save-Fixture
  [IO.File]::WriteAllText("$file.sha256", 'invalid')
  Assert-Rejected 'Empreinte de sauvegarde invalide.'
  Save-Fixture
  [IO.File]::AppendAllText($file, '-corrupted')
  Assert-Rejected 'Archive corrompue.'
  Save-Fixture
  [IO.File]::WriteAllText("$file.roles.json.sha256", 'invalid')
  Assert-Rejected 'Empreinte des roles invalide.'
  Save-Fixture
  [IO.File]::AppendAllText("$file.roles.json", ' ')
  Assert-Rejected 'Inventaire des roles corrompu.'
  foreach ($field in @('version', 'backup_file', 'dump_sha256')) {
    Save-Fixture
    $roles[$field] = 'incorrect'
    Save-Roles
    Assert-Rejected 'Inventaire des roles mal associe.'
  }
} finally {
  $resolved = [IO.Path]::GetFullPath($test)
  if ($resolved.StartsWith($root, [StringComparison]::OrdinalIgnoreCase) -and
    [IO.Path]::GetFileName($resolved) -match '^saytu-restore-guards-[a-f0-9]{32}$') {
    Remove-Item -LiteralPath $resolved -Recurse
  }
}
Write-Output "$count garde-fous de restauration valides (donnees fictives)."
