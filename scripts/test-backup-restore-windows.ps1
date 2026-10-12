#Requires -Version 7.0
[CmdletBinding()]
param(
  [string]$BackupFile,
  [string]$BackupRoot = (Join-Path $env:USERPROFILE 'Documents\Saytu-Yef-Backups'),
  [string]$PostgresBin = (Split-Path (Get-Command postgres.exe -ErrorAction Stop).Source),
  [ValidateRange(1024,65535)][int]$Port = 55439,
  [switch]$AllowEmptyVaultOmission,
  [switch]$TestPendingMigrations,
  [switch]$TestConcurrentWorkflows
)
$ErrorActionPreference = 'Stop'
if ($TestConcurrentWorkflows -and -not $TestPendingMigrations) { throw 'Les tests concurrents exigent les migrations locales.' }
$BackupRoot = [IO.Path]::GetFullPath($BackupRoot)
$PostgresBin = [IO.Path]::GetFullPath($PostgresBin)
if (-not $BackupFile) {
  $BackupFile = (Get-ChildItem -LiteralPath $BackupRoot -File -Filter 'saytu-yef-*.dump' |
    Where-Object { $_.Name -match '^saytu-yef-\d{8}T\d{6}Z\.dump$' } |
    Sort-Object Name -Descending | Select-Object -First 1).FullName
}
if (-not $BackupFile) { throw 'Aucune archive locale disponible.' }
$BackupFile = [IO.Path]::GetFullPath($BackupFile)
$name = [IO.Path]::GetFileName($BackupFile)
$checksum = [IO.File]::ReadAllText("$BackupFile.sha256")
if ($checksum -notmatch '^([a-fA-F0-9]{64})\s') { throw 'Empreinte de sauvegarde invalide.' }
$dumpHash = (Get-FileHash -LiteralPath $BackupFile).Hash.ToLowerInvariant()
if ($dumpHash -cne $Matches[1].ToLowerInvariant()) { throw 'Archive corrompue.' }
$rolesPath = "$BackupFile.roles.json"
$checksum = [IO.File]::ReadAllText("$rolesPath.sha256")
if ($checksum -notmatch '^([a-fA-F0-9]{64})\s') { throw 'Empreinte des roles invalide.' }
if ((Get-FileHash -LiteralPath $rolesPath).Hash.ToLowerInvariant() -cne $Matches[1].ToLowerInvariant()) { throw 'Inventaire des roles corrompu.' }
$manifest = ConvertFrom-Json -InputObject ([IO.File]::ReadAllText($rolesPath))
if ($manifest.version -ne 1 -or $manifest.backup_file -cne $name -or $manifest.dump_sha256 -cne $dumpHash) { throw 'Inventaire des roles mal associe.' }
if (@([Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().GetActiveTcpListeners() | Where-Object { $_.Port -eq $Port }).Count) { throw 'Port de restauration deja utilise.' }
foreach ($exe in @('initdb.exe', 'pg_ctl.exe', 'pg_restore.exe', 'psql.exe')) {
  if (-not (Test-Path -LiteralPath (Join-Path $PostgresBin $exe))) { throw "Outil PostgreSQL absent: $exe" }
}
$runRoot = Join-Path $BackupRoot 'restore-tests'
$null = New-Item -ItemType Directory -Path $runRoot -Force
if ((Get-Item -LiteralPath $runRoot).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Dossier de restauration lie a une autre cible.' }
$acl = [Security.AccessControl.DirectorySecurity]::new()
$acl.SetAccessRuleProtection($true, $false)
foreach ($sid in @([Security.Principal.WindowsIdentity]::GetCurrent().User,
  [Security.Principal.SecurityIdentifier]::new('S-1-5-18'), [Security.Principal.SecurityIdentifier]::new('S-1-5-32-544'))) {
  $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($sid, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow'))
}
[IO.FileSystemAclExtensions]::SetAccessControl([IO.DirectoryInfo]::new($runRoot), $acl)
$runId = [DateTime]::UtcNow.ToString('yyyyMMddTHHmmssZ') + '-' + [Guid]::NewGuid().ToString('N')
$run = Join-Path $runRoot $runId
$null = New-Item -ItemType Directory -Path $run
$data = Join-Path $run 'cluster'
$database = 'saytu_restore_test_' + [Guid]::NewGuid().ToString('N')
$admin = 'saytu_restore_admin'
$password = [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
$passwordFile = Join-Path $run 'init-password.txt'
$counter = 0

function Invoke-Pg([string]$Tool, [string[]]$Arguments) {
  $script:counter++
  $log = Join-Path $run ("{0:D2}-{1}.log" -f $counter, $Tool)
  $info = [Diagnostics.ProcessStartInfo]::new((Join-Path $PostgresBin $Tool))
  $info.UseShellExecute = $false
  $info.CreateNoWindow = $true
  # A daemon launched by pg_ctl can inherit pipes on Windows and keep ReadToEnd blocked.
  $capture = $Tool -cne 'pg_ctl.exe'
  $info.RedirectStandardOutput = $capture
  $info.RedirectStandardError = $capture
  $info.Environment['PGPASSWORD'] = $password
  $info.Environment['PGCONNECT_TIMEOUT'] = '15'
  $info.Environment['PGCLIENTENCODING'] = 'UTF8'
  $info.Environment['PGOPTIONS'] = '-c statement_timeout=60000'
  foreach ($argument in $Arguments) { $info.ArgumentList.Add($argument) }
  $process = [Diagnostics.Process]::new()
  $process.StartInfo = $info
  $null = $process.Start()
  try {
    if (-not $capture) {
      if (-not $process.WaitForExit(90000)) { throw 'Delai de controle PostgreSQL depasse.' }
      [IO.File]::WriteAllText($log, "pg_ctl exit code: $($process.ExitCode)`n")
      if ($process.ExitCode -ne 0) { throw "$Tool a echoue. Diagnostic prive: $log" }
      return ''
    }
    $errorText = $process.StandardError.ReadToEndAsync()
    $output = $process.StandardOutput.ReadToEnd()
    $process.WaitForExit()
    $stderr = $errorText.GetAwaiter().GetResult()
    [IO.File]::WriteAllText($log, $output + "`n" + $stderr)
    if ($process.ExitCode -ne 0) { throw "$Tool a echoue. Diagnostic prive: $log" }
    return $output.Trim()
  } finally { $process.Dispose() }
}

function Invoke-TestSql([string]$Sql, [string]$Target = $database) {
  if ($Target -ne 'postgres' -and $Target -cnotmatch '^saytu_restore_test_[a-f0-9]{32}$') { throw 'Base de test inattendue.' }
  return Invoke-Pg 'psql.exe' @('-X', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-h', '127.0.0.1', '-p', "$Port", '-U', $admin, '-d', $Target, '-c', $Sql)
}

function Get-RestoreStats {
  $sql = @'
select jsonb_build_object(
  'tables', (select count(*) from pg_tables where schemaname not in ('pg_catalog','information_schema')),
  'sales', (select count(*) from public.sales), 'items', (select count(*) from public.sale_items),
  'payments', (select count(*) from public.sale_payments), 'products', (select count(*) from public.products),
  'profiles', (select count(*) from public.profiles), 'auth_users', (select count(*) from auth.users),
  'storage_objects', (select count(*) from storage.objects),
  'unvalidated_public_constraints', (select count(*) from pg_constraint c join pg_namespace n on n.oid=c.connamespace where n.nspname='public' and not c.convalidated),
  'financial_fingerprint', (select md5(coalesce(string_agg(jsonb_build_array(id,user_id,seller_id,subtotal,discount,tax,total,amount_paid,amount_due,payment_status,payment_method,reversed_at,reversal_reason)::text, '' order by id),'')) from public.sales),
  'items_fingerprint', (select md5(coalesce(string_agg(jsonb_build_array(id,sale_id,product_id,quantity,unit_price,total)::text, '' order by id),'')) from public.sale_items),
  'stock_fingerprint', (select md5(coalesce(string_agg(jsonb_build_array(id,user_id,quantity,buying_price,selling_price)::text, '' order by id),'')) from public.products),
  'payments_fingerprint', (select md5(coalesce(string_agg(jsonb_build_array(id,sale_id,user_id,amount,payment_method,created_at)::text, '' order by id),'')) from public.sale_payments)
);
'@
  return ConvertFrom-Json -InputObject (Invoke-TestSql $sql)
}

$started = $false
$report = [ordered]@{ backup = $name; sha256 = $dumpHash; scope = 'full_database'; status = 'started'; exclusions = @(); migrations = @(); server_stopped = $false }
try {
  $toc = Invoke-Pg 'pg_restore.exe' @('--list', $BackupFile)
  $missing = @($manifest.extensions | Where-Object {
    $_.name -cnotmatch '^[a-z0-9_-]+$' -or -not (Test-Path -LiteralPath (Join-Path (Split-Path $PostgresBin) "share/extension/$($_.name).control"))
  })
  if ($missing.Count) {
    if (-not $AllowEmptyVaultOmission -or $missing.Count -ne 1 -or $missing[0].name -cne 'supabase_vault') {
      throw 'Extension incompatible. Utiliser une instance Supabase compatible pour une restauration complete.'
    }
    # Refuse to omit Vault if even one secret exists in the archive, independently of current live counts.
    $vaultData = Join-Path $run 'vault-data.sql'
    $null = Invoke-Pg 'pg_restore.exe' @('--data-only', '--schema=vault', '--file', $vaultData, $BackupFile)
    $lines = [IO.File]::ReadAllLines($vaultData)
    $copies = @(@(0..($lines.Length - 1)) | Where-Object { $lines[$_] -match '^COPY ' })
    if ($copies.Count -ne 1 -or $lines[$copies[0]] -notmatch '^COPY vault\.secrets \([^;]+\) FROM stdin;$' -or $lines[$copies[0] + 1] -cne '\.') {
      throw 'Vault ne peut pas etre omis: son contenu ne peut pas etre certifie vide.'
    }
    $allowed = @('EXTENSION - supabase_vault ', 'COMMENT - EXTENSION supabase_vault ', 'TABLE DATA vault secrets ',
      'ACL vault FUNCTION _crypto_aead_det_decrypt(', 'ACL vault FUNCTION create_secret(',
      'ACL vault FUNCTION update_secret(', 'ACL vault TABLE secrets ', 'ACL vault TABLE decrypted_secrets ')
    $filtered = foreach ($line in ($toc -split '\r?\n')) {
      if ($line -match '^\d+;' -and ($allowed | Where-Object { $line.Contains($_) })) {
        $report.exclusions += ($line -replace '^\d+; \d+ \d+ ', '')
        ";$line"
      } else { $line }
    }
    if ($report.exclusions.Count -ne $allowed.Count) { throw 'Inventaire Vault inattendu; aucun filtrage automatique supplementaire.' }
    $report.scope = 'application_auth_storage_without_empty_vault_extension'
    $toc = $filtered -join "`n"
  }
  $tocFile = Join-Path $run 'restore.list'
  [IO.File]::WriteAllText($tocFile, $toc + "`n")
  [IO.File]::WriteAllText($passwordFile, $password + "`n")
  $null = Invoke-Pg 'initdb.exe' @('-D', $data, '-U', $admin, '--pwfile', $passwordFile, '--auth=scram-sha-256', '--encoding=UTF8', '--no-locale', '-c', 'listen_addresses=127.0.0.1', '-c', "port=$Port", '-c', 'max_connections=20', '-c', 'wal_level=logical', '-c', 'shared_preload_libraries=pg_stat_statements')
  Remove-Item -LiteralPath $passwordFile
  $null = Invoke-Pg 'pg_ctl.exe' @('start', '-D', $data, '-l', (Join-Path $run 'postgres.log'), '-w', '-t', '60')
  $started = $true
  $roleSql = [Collections.Generic.List[string]]::new()
  foreach ($role in $manifest.roles) {
    if (-not $role.name -or $role.name -ceq $admin -or $role.bypassrls -isnot [bool] -or $role.superuser -isnot [bool] -or $role.inherit -isnot [bool]) { throw 'Role de restauration invalide.' }
    $identifier = '"' + $role.name.Replace('"', '""') + '"'
    $bypass = if ($role.bypassrls) { 'BYPASSRLS' } else { 'NOBYPASSRLS' }
    $inherit = if ($role.inherit) { 'INHERIT' } else { 'NOINHERIT' }
    $superuser = if ($role.superuser) { 'SUPERUSER' } else { 'NOSUPERUSER' }
    $roleSql.Add("CREATE ROLE $identifier NOLOGIN $superuser $bypass $inherit;")
  }
  foreach ($membership in $manifest.memberships) {
    foreach ($key in @('role', 'member')) {
      if ($membership.$key -cnotin @($manifest.roles.name)) { throw 'Membre de role inconnu.' }
    }
    $role = '"' + $membership.role.Replace('"', '""') + '"'
    $member = '"' + $membership.member.Replace('"', '""') + '"'
    foreach ($option in @('admin', 'inherit', 'set')) {
      $value = $membership."${option}_option"
      if ($value -isnot [bool]) { throw 'Option de role invalide.' }
      $boolean = $value.ToString().ToUpperInvariant()
      $roleSql.Add("GRANT $role TO $member WITH $option $boolean;")
    }
  }
  $null = Invoke-TestSql ($roleSql -join "`n") 'postgres'
  $null = Invoke-TestSql "CREATE DATABASE $database TEMPLATE template0;" 'postgres'
  $empty = Invoke-TestSql "select count(*) from pg_tables where schemaname not in ('pg_catalog','information_schema');"
  if ($empty -cne '0') { throw 'La base de restauration doit etre vide.' }
  $null = Invoke-Pg 'pg_restore.exe' @('--single-transaction', '--use-list', $tocFile, '-h', '127.0.0.1', '-p', "$Port", '-U', $admin, '-d', $database, $BackupFile)
  $report.before = Get-RestoreStats
  if ($TestPendingMigrations) {
    foreach ($file in @('20261011000521_retail_reliability.sql', '20261011001011_retail_workflows.sql')) {
      $path = Join-Path (Split-Path $PSScriptRoot) "supabase/migrations/$file"
      $null = Invoke-Pg 'psql.exe' @('-X', '-v', 'ON_ERROR_STOP=1', '--single-transaction', '-h', '127.0.0.1', '-p', "$Port", '-U', $admin, '-d', $database, '-f', $path)
      $report.migrations += $file
    }
    $report.after = Get-RestoreStats
    foreach ($field in @('financial_fingerprint', 'items_fingerprint', 'stock_fingerprint', 'payments_fingerprint')) {
      if ($report.before.$field -cne $report.after.$field) { throw 'Une migration a modifie les donnees financieres ou le stock restaure.' }
    }
    if ((Invoke-TestSql 'select public.database_health();') -cne 't') { throw 'Controle PostgreSQL non valide.' }
    $permissions = @'
select not exists (
  select 1 from unnest(array['sales','sale_items','sale_payments','stock_movements']) t(name)
  cross join unnest(array['anon','authenticated']) r(name)
  where has_table_privilege(r.name, 'public.' || t.name, 'INSERT')
) and has_function_privilege('authenticated', 'public.checkout_sale(uuid,jsonb,jsonb)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.checkout_sale(uuid,jsonb,jsonb)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.record_sale_payment_v2(uuid,uuid,numeric,text,text)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.record_sale_payment(uuid,numeric,text,text)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.create_sale_with_items_v2(text,text,jsonb,numeric,numeric,numeric,numeric,numeric,text,text)', 'EXECUTE');
'@
    if ((Invoke-TestSql $permissions) -cne 't') { throw 'Droits de vente ou de versement inattendus.' }
    $report.financial_permissions_verified = $true
  }
  if ($TestConcurrentWorkflows) {
    $clone = 'saytu_restore_test_' + [Guid]::NewGuid().ToString('N')
    $null = Invoke-TestSql "CREATE DATABASE $clone TEMPLATE $database;" 'postgres'
    $logs = Join-Path $run 'concurrency'
    $null = New-Item -ItemType Directory -Path $logs
    $info = [Diagnostics.ProcessStartInfo]::new((Get-Command node.exe -ErrorAction Stop).Source)
    $info.UseShellExecute = $false
    $info.CreateNoWindow = $true
    $info.RedirectStandardOutput = $true
    $info.RedirectStandardError = $true
    $info.ArgumentList.Add((Join-Path $PSScriptRoot 'test-retail-concurrency.mjs'))
    $info.Environment['SAYTU_TEST_DATABASE'] = $clone
    $info.Environment['SAYTU_TEST_PORT'] = "$Port"
    $info.Environment['SAYTU_TEST_PASSWORD'] = $password
    $info.Environment['SAYTU_TEST_PG_BIN'] = $PostgresBin
    $info.Environment['SAYTU_TEST_CLUSTER'] = $data
    $info.Environment['SAYTU_TEST_LOGS'] = $logs
    $process = [Diagnostics.Process]::new()
    $process.StartInfo = $info
    $null = $process.Start()
    try {
      $errorTask = $process.StandardError.ReadToEndAsync()
      $output = $process.StandardOutput.ReadToEnd()
      $process.WaitForExit()
      [IO.File]::WriteAllText((Join-Path $logs 'runner.log'), $output + "`n" + $errorTask.GetAwaiter().GetResult())
      $concurrencyReport = Join-Path $logs 'report.json'
      if (Test-Path -LiteralPath $concurrencyReport) { $report.concurrency = ConvertFrom-Json -InputObject ([IO.File]::ReadAllText($concurrencyReport)) }
      if ($process.ExitCode -ne 0) { throw "Tests concurrents en echec. Diagnostic prive: $logs" }
      if (-not $report.concurrency -or $report.concurrency.status -cne 'passed') { throw 'Rapport concurrent absent ou incomplet.' }
    } finally { $process.Dispose() }
    $control = Get-RestoreStats
    foreach ($field in @('financial_fingerprint', 'items_fingerprint', 'stock_fingerprint', 'payments_fingerprint')) {
      if ($report.after.$field -cne $control.$field) { throw 'La base source des tests concurrents a change.' }
    }
  }
  $report.status = 'passed'
} catch {
  $report.status = 'failed'
  $report.failure = $_.Exception.Message
  throw
} finally {
  if ($started -or (Test-Path -LiteralPath (Join-Path $data 'postmaster.pid'))) {
    try {
      $null = Invoke-Pg 'pg_ctl.exe' @('stop', '-D', $data, '-m', 'fast', '-w', '-t', '60')
      $report.server_stopped = $true
    } catch { $report.status = 'failed_stop'; Write-Warning "Arret PostgreSQL non confirme. Dossier prive: $run" }
  }
  if (Test-Path -LiteralPath $passwordFile) { Remove-Item -LiteralPath $passwordFile }
  $password = $null
  [IO.File]::WriteAllText((Join-Path $run 'report.json'), ($report | ConvertTo-Json -Depth 12))
}
if (-not $report.server_stopped) { throw 'Arret du serveur de test non confirme.' }
Write-Output "Restauration valide ($($report.scope)): $($report.before.sales) ventes, $($report.before.products) produits, $($report.before.auth_users) comptes Auth."
Write-Output "Migrations verifiees: $($report.migrations.Count). Rapport prive: $(Join-Path $run 'report.json')"
