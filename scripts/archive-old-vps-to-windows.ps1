#Requires -Version 7.0
[CmdletBinding()]
param(
  [string]$Destination = (Join-Path $env:USERPROFILE 'Documents\Saytu-Yef-Backups\application-archives'),
  [string]$IdentityFile = (Join-Path $env:USERPROFILE '.ssh\id_ed25519_saytu_yef'),
  [switch]$RemoveVerifiedFromVps,
  [switch]$SelfTest
)
$ErrorActionPreference = 'Stop'
function Test-ArchiveName([string]$Name) {
  return $Name -cmatch '^saytu-yef-(?:backup-[0-9]{8}-[0-9]{6}|release-[a-f0-9]{40}-[0-9]{8}T[0-9]{6}Z)$'
}
if ($SelfTest) {
  foreach ($name in @('../saytu-yef','saytu-yef','saytu-yef-backup-20260627-131410;id','saytu-yef-backup-20260627-131410/child','saytu-yef-release-abc-20261012T160741Z')) {
    if (Test-ArchiveName $name) { throw 'Cible dangereuse acceptee.' }
  }
  if (-not (Test-ArchiveName 'saytu-yef-backup-20260627-131410')) { throw 'Nom valide refuse.' }
  if (-not (Test-ArchiveName ('saytu-yef-release-' + ('a' * 40) + '-20261012T160741Z'))) { throw 'Release valide refusee.' }
  Write-Output '7 controles de noms passes; aucune connexion VPS.'
  return
}
$Destination = [IO.Path]::GetFullPath($Destination)
$IdentityFile = [IO.Path]::GetFullPath($IdentityFile)
if (-not (Test-Path -LiteralPath $IdentityFile -PathType Leaf)) { throw 'Cle SSH absente.' }
$null = New-Item -ItemType Directory -Path $Destination -Force
$acl = [Security.AccessControl.DirectorySecurity]::new()
$acl.SetAccessRuleProtection($true, $false)
foreach ($sid in @([Security.Principal.WindowsIdentity]::GetCurrent().User,
  [Security.Principal.SecurityIdentifier]::new('S-1-5-18'), [Security.Principal.SecurityIdentifier]::new('S-1-5-32-544'))) {
  $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($sid, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow'))
}
[IO.FileSystemAclExtensions]::SetAccessControl([IO.DirectoryInfo]::new($Destination), $acl)

function Invoke-ArchiveSsh([string]$Command, [string]$OutputFile = '') {
  $info = [Diagnostics.ProcessStartInfo]::new()
  $info.FileName = (Get-Command ssh.exe -ErrorAction Stop).Source
  $info.UseShellExecute = $false
  $info.CreateNoWindow = $true
  $info.RedirectStandardOutput = $true
  $info.RedirectStandardError = $true
  foreach ($argument in @('-i', $IdentityFile, '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes', '-o', 'ConnectTimeout=15',
    '-o', 'ServerAliveInterval=30', '-o', 'ServerAliveCountMax=3', 'ubuntu@179.237.84.35', $Command)) { $info.ArgumentList.Add($argument) }
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

function Test-ArchiveContents([string]$Path, [string]$Name) {
  $info = [Diagnostics.ProcessStartInfo]::new()
  $info.FileName = (Get-Command tar.exe -ErrorAction Stop).Source
  $info.UseShellExecute = $false
  $info.CreateNoWindow = $true
  $info.RedirectStandardOutput = $true
  $info.RedirectStandardError = $true
  foreach ($argument in @('-tzf', $Path)) { $info.ArgumentList.Add($argument) }
  $process = [Diagnostics.Process]::new()
  $process.StartInfo = $info
  $null = $process.Start()
  $errors = $process.StandardError.ReadToEndAsync()
  $entries = 0
  $invalid = $false
  try {
    while ($null -ne ($line = $process.StandardOutput.ReadLine())) {
      $entries++
      if (-not $line.StartsWith("$Name/", [StringComparison]::Ordinal) -or ($line -split '/') -contains '..') { $invalid = $true }
    }
    $process.WaitForExit()
    if ($process.ExitCode -ne 0 -or $invalid -or $entries -lt 1) { throw "Archive illisible ou structure inattendue: $($errors.GetAwaiter().GetResult())" }
    return $entries
  } finally { $process.Dispose() }
}

$names = (Invoke-ArchiveSsh 'sudo -n /usr/local/sbin/saytu-yef-archive-old list') -split '\r?\n' | Where-Object { $_ }
$index = @()
$journal = Join-Path $Destination ('verified-' + [DateTime]::UtcNow.ToString('yyyyMMddTHHmmssfffffffZ') + '.json')
foreach ($name in $names) {
  if (-not (Test-ArchiveName $name)) { throw 'Nom distant invalide; aucune suppression.' }
  $target = Join-Path $Destination "$name.tar.gz"
  $partial = "$target.partial"
  if (-not (Test-Path -LiteralPath $target)) {
    Write-Output "Archivage vers le PC: $name"
    Invoke-ArchiveSsh "sudo -n /usr/local/sbin/saytu-yef-archive-old export $name" $partial
  }
  $expected = (Invoke-ArchiveSsh "sudo -n /usr/local/sbin/saytu-yef-archive-old checksum $name").Trim()
  if ($expected -cnotmatch '^[a-f0-9]{64}$') { throw 'Empreinte distante invalide.' }
  $candidate = if (Test-Path -LiteralPath $target) { $target } else { $partial }
  $actual = (Get-FileHash -LiteralPath $candidate -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($actual -cne $expected) { throw 'Copie non identique; aucune suppression.' }
  $entries = Test-ArchiveContents $candidate $name
  if ($candidate -eq $partial) { Move-Item -LiteralPath $partial -Destination $target }
  [IO.File]::WriteAllText("$target.sha256", "$expected  $name.tar.gz`n")
  $index += [pscustomobject]@{name=$name; sha256=$expected; bytes=(Get-Item -LiteralPath $target).Length; entries=$entries; checked_at=[DateTime]::UtcNow.ToString('o')}
  [IO.File]::WriteAllText($journal, (ConvertTo-Json -InputObject @($index) -Depth 3))
  Write-Output "Archive privee verifiee: $name ($entries entrees)."
  if ($RemoveVerifiedFromVps) {
    Write-Output (Invoke-ArchiveSsh "sudo -n /usr/local/sbin/saytu-yef-archive-old purge $name $expected").Trim()
  }
}
Write-Output "Termine: $($index.Count) archive(s) verifiee(s). Dossier prive: $Destination"
