#Requires -Version 7.0
[CmdletBinding()]
param(
  [string]$Destination = (Join-Path $env:USERPROFILE 'Documents\Saytu-Yef-Backups'),
  [string]$IdentityFile = (Join-Path $env:USERPROFILE '.ssh\id_ed25519_saytu_yef'),
  [switch]$SkipStorage,
  [switch]$InstallDailyTask
)
$ErrorActionPreference = 'Stop'
$Destination = [IO.Path]::GetFullPath($Destination)
$IdentityFile = [IO.Path]::GetFullPath($IdentityFile)
if (-not (Test-Path -LiteralPath $IdentityFile -PathType Leaf)) { throw 'Cle SSH absente.' }
if (-not (Test-Path -LiteralPath $Destination)) {
  $null = New-Item -ItemType Directory -Path $Destination
}
$acl = [Security.AccessControl.DirectorySecurity]::new()
$acl.SetAccessRuleProtection($true, $false)
foreach ($sid in @([Security.Principal.WindowsIdentity]::GetCurrent().User,
  [Security.Principal.SecurityIdentifier]::new('S-1-5-18'), [Security.Principal.SecurityIdentifier]::new('S-1-5-32-544'))) {
  $rule = [Security.AccessControl.FileSystemAccessRule]::new($sid, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow')
  $acl.AddAccessRule($rule)
}
[IO.FileSystemAclExtensions]::SetAccessControl([IO.DirectoryInfo]::new($Destination), $acl)

function Invoke-BackupSsh([string]$RemoteCommand, [string]$OutputFile = '') {
  $info = [Diagnostics.ProcessStartInfo]::new()
  $info.FileName = (Get-Command ssh.exe -ErrorAction Stop).Source
  $info.UseShellExecute = $false
  $info.CreateNoWindow = $true
  $info.RedirectStandardOutput = $true
  $info.RedirectStandardError = $true
  foreach ($argument in @('-i', $IdentityFile, '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes',
    '-o', 'ConnectTimeout=15', 'ubuntu@179.237.84.35', $RemoteCommand)) { $info.ArgumentList.Add($argument) }
  $process = [Diagnostics.Process]::new()
  $process.StartInfo = $info
  $null = $process.Start()
  $errors = $process.StandardError.ReadToEndAsync()
  try {
    if ($OutputFile) {
      $stream = [IO.File]::Create($OutputFile)
      try { $process.StandardOutput.BaseStream.CopyTo($stream) } finally { $stream.Dispose() }
    } else { $result = $process.StandardOutput.ReadToEnd() }
    $process.WaitForExit()
    if ($process.ExitCode -ne 0) { throw "Echec SSH: $($errors.GetAwaiter().GetResult())" }
    if (-not $OutputFile) { return $result }
  } finally { $process.Dispose() }
}

$listing = Invoke-BackupSsh "sudo -n find /var/backups/saytu-yef -maxdepth 1 -type f -name 'saytu-yef-*.dump' -printf '%f\n'"
$name = ($listing -split '\r?\n' | Where-Object { $_ -match '^saytu-yef-\d{8}T\d{6}Z\.dump$' } | Sort-Object -Descending | Select-Object -First 1)
if (-not $name) { throw 'Aucune sauvegarde disponible sur le VPS.' }
$remote = "/var/backups/saytu-yef/$name"
$checksum = Invoke-BackupSsh "sudo -n cat -- $remote.sha256"
if ($checksum -notmatch '^([a-fA-F0-9]{64})\s') { throw 'Empreinte de sauvegarde invalide.' }
$expected = $Matches[1].ToLowerInvariant()
$target = Join-Path $Destination $name
if (-not (Test-Path -LiteralPath $target) -or (Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expected) {
  $partial = "$target.partial"
  try {
    Invoke-BackupSsh "sudo -n cat -- $remote" $partial
    if ((Get-FileHash -LiteralPath $partial -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expected) { throw 'La copie est incomplete ou corrompue.' }
    Move-Item -LiteralPath $partial -Destination $target -Force
  } finally { if (Test-Path -LiteralPath $partial) { Remove-Item -LiteralPath $partial } }
}
[IO.File]::WriteAllText("$target.sha256", "$expected  $name`n")
Write-Output "Copie verifiee: $target"

$hasRoles = (Invoke-BackupSsh "sudo -n test -f $remote.roles.json.sha256 && echo yes || echo no").Trim()
if ($hasRoles -eq 'yes') {
  $roleChecksum = Invoke-BackupSsh "sudo -n cat -- $remote.roles.json.sha256"
  if ($roleChecksum -notmatch '^([a-fA-F0-9]{64})\s') { throw 'Empreinte des roles invalide.' }
  $roleHash = $Matches[1].ToLowerInvariant()
  $rolePath = "$target.roles.json"
  $rolePartial = "$rolePath.partial"
  try {
    Invoke-BackupSsh "sudo -n cat -- $remote.roles.json" $rolePartial
    if ((Get-FileHash -LiteralPath $rolePartial).Hash.ToLowerInvariant() -cne $roleHash) { throw 'Inventaire des roles corrompu.' }
    $roles = ConvertFrom-Json -InputObject ([IO.File]::ReadAllText($rolePartial))
    if ($roles.version -ne 1 -or $roles.backup_file -cne $name -or $roles.dump_sha256 -cne $expected) { throw 'Inventaire des roles mal associe.' }
    Move-Item -LiteralPath $rolePartial -Destination $rolePath -Force
    [IO.File]::WriteAllText("$rolePath.sha256", "$roleHash  $name.roles.json`n")
  } finally { if (Test-Path -LiteralPath $rolePartial) { Remove-Item -LiteralPath $rolePartial } }
  Write-Output 'Inventaire des roles verifie (sans mots de passe).'
} else { Write-Warning 'Ancienne archive sans inventaire des roles; sa restauration doit etre preparee manuellement.' }

if (-not $SkipStorage) {
  & (Join-Path $PSScriptRoot 'backup-storage-to-windows.ps1') -Destination $Destination -IdentityFile $IdentityFile
}

if ($InstallDailyTask) {
  $pwsh = (Get-Command pwsh.exe -ErrorAction Stop).Source
  $skip = if ($SkipStorage) { ' -SkipStorage' } else { '' }
  $action = New-ScheduledTaskAction -Execute $pwsh -Argument "-NoProfile -NonInteractive -WindowStyle Hidden -File `"$PSCommandPath`" -Destination `"$Destination`" -IdentityFile `"$IdentityFile`"$skip"
  $trigger = New-ScheduledTaskTrigger -Daily -At '03:00'
  $principal = New-ScheduledTaskPrincipal -UserId ([Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited
  $settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew
  $null = Register-ScheduledTask -TaskName 'SaytuYef-BackupToPC' -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description 'Copie privee des sauvegardes Saytu Yef avec verification SHA256.' -Force
  Write-Output 'Copie quotidienne configuree a 03:00, lorsque la session Windows est ouverte.'
}
