[CmdletBinding(SupportsShouldProcess)]
param(
  [Parameter(Mandatory = $true)]
  [string]$AppHost,
  [Parameter(Mandatory = $true)]
  [string]$DbHost,
  [Parameter(Mandatory = $true)]
  [string]$AppUser,
  [string]$RemotePath = '/opt/my-ajo',
  [string]$Pm2Name = 'my-ajo',
  [string]$DbName = 'MyAjoDB',
  [string]$PublicOrigin = 'https://www.my-ajo.org',
  [Parameter(Mandatory = $true)]
  [string]$DbUser,
  [SecureString]$DbPassword,
  [string]$SshKey,
  [int]$HealthPort = 5000,
  [bool]$RequireTde = $true,
  [switch]$SkipDatabase,
  [switch]$RunEncryptionMigration
)

$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$Archive = Join-Path ([IO.Path]::GetTempPath()) ("myajo-update-{0}.tar.gz" -f (Get-Date -Format 'yyyyMMddHHmmss'))
$RemoteArchive = '/tmp/myajo-update.tar.gz'
$SshTarget = "$AppUser@$AppHost"
$SshArgs = @()
if ($SshKey) { $SshArgs += @('-i', $SshKey) }

foreach ($Value in @($AppHost, $DbHost)) {
  if ($Value -notmatch '^[a-zA-Z0-9.-]+$') { throw "Invalid host value: $Value" }
}
foreach ($Value in @($AppUser, $Pm2Name, $DbName, $DbUser)) {
  if ($Value -notmatch '^[a-zA-Z0-9_.-]+$') { throw "Invalid deployment value: $Value" }
}
if ($RemotePath -notmatch '^/[a-zA-Z0-9/_.-]+$') { throw "Invalid remote path: $RemotePath" }
if ($PublicOrigin -notmatch '^https://[a-zA-Z0-9.-]+(?::[0-9]+)?$') { throw 'PublicOrigin must be a trusted HTTPS origin without a path.' }
if (-not $SkipDatabase -and -not $DbPassword) { throw 'DbPassword is required unless -SkipDatabase is used.' }

foreach ($Command in @('tar', 'ssh', 'scp')) {
  if (-not (Get-Command $Command -ErrorAction SilentlyContinue)) { throw "Required command '$Command' is not installed or not on PATH." }
}

try {
  if ($PSCmdlet.ShouldProcess("$SshTarget and $DbHost/$DbName", 'Update My Ajo application and database')) {
    if (-not $SkipDatabase) {
    $SqlCmd = Get-Command sqlcmd -ErrorAction SilentlyContinue
    if (-not $SqlCmd) { throw 'sqlcmd is required for the database migration. Install Microsoft sqlcmd or rerun with -SkipDatabase after applying database/add-activity-events.sql manually.' }
    $PasswordPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($DbPassword)
    try { $env:SQLCMDPASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($PasswordPtr) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($PasswordPtr) }
    Write-Host "Applying safe database migration to $DbHost/$DbName..." -ForegroundColor Cyan
    foreach ($Migration in @('harden-sensitive-data.sql', 'add-role-security.sql', 'add-activity-events.sql')) {
      & $SqlCmd.Source -S "$DbHost,1433" -d $DbName -U $DbUser -C -b -i (Join-Path $ProjectRoot "database\$Migration")
      if ($LASTEXITCODE -ne 0) { throw "Database migration $Migration failed with exit code $LASTEXITCODE." }
    }
    if ($RequireTde) {
      & $SqlCmd.Source -S "$DbHost,1433" -d master -U $DbUser -C -b -Q "SET NOCOUNT ON; IF NOT EXISTS (SELECT 1 FROM sys.dm_database_encryption_keys WHERE database_id=DB_ID(N'$DbName') AND encryption_state=3) THROW 51000, 'MyAjoDB must have Transparent Data Encryption enabled before public deployment.', 1;"
      if ($LASTEXITCODE -ne 0) { throw 'MSSQL TDE verification failed. Enable TDE and back up its certificate before deploying.' }
    }
    }

    Write-Host 'Creating deployment archive...' -ForegroundColor Cyan
    & tar -czf $Archive --exclude='./.git' --exclude='./releases' --exclude='./work' --exclude='./client/node_modules' --exclude='./server/node_modules' --exclude='./client/dist' --exclude='./client/android/.gradle' --exclude='./client/android/.idea' --exclude='./client/android/.artifacts' --exclude='./client/android/app/build' --exclude='./client/ios/Pods' --exclude='./client/ios/DerivedData' --exclude='./server/.env' --exclude='./server/uploads' -C $ProjectRoot .
    if ($LASTEXITCODE -ne 0) { throw 'Could not create deployment archive.' }

    Write-Host "Uploading to $SshTarget..." -ForegroundColor Cyan
    & scp @SshArgs $Archive "${SshTarget}:$RemoteArchive"
    if ($LASTEXITCODE -ne 0) { throw 'Upload failed.' }

    $RemoteScript = @"
set -euo pipefail
test -f '$RemotePath/server/.env' || { echo 'Missing $RemotePath/server/.env'; exit 1; }
node -e "const [major,minor]=process.versions.node.split('.').map(Number);if(major<22||(major===22&&minor<12)){console.error('Node.js 22.12.0 or later is required');process.exit(1)}"
sudo mkdir -p '$RemotePath'
if [ -d '$RemotePath/server' ]; then
  sudo tar -czf "/tmp/myajo-backup-`$(date +%Y%m%d%H%M%S).tar.gz" -C '$RemotePath' --exclude='server/node_modules' --exclude='client/node_modules' .
fi
sudo tar -xzf '$RemoteArchive' -C '$RemotePath'
sudo chown -R '$AppUser':'$AppUser' '$RemotePath'
sudo find '$RemotePath' -type d -exec chmod u+rwx {} +
sudo find '$RemotePath' -type f -exec chmod u+rw {} +
upsert_env() {
  key="`$1"
  value="`$2"
  file='$RemotePath/server/.env'
  if grep -q "^`$key=" "`$file"; then
    sed -i "s|^`$key=.*|`$key=`$value|" "`$file"
  else
    printf '%s=%s\n' "`$key" "`$value" >> "`$file"
  fi
}
upsert_env DB_SERVER '$DbHost'
upsert_env DB_PORT '1433'
upsert_env DB_NAME '$DbName'
upsert_env DB_ENCRYPT 'true'
upsert_env DB_TRUST_CERT 'false'
upsert_env APP_BASE_URL '$PublicOrigin'
upsert_env ALLOWED_ORIGINS '$PublicOrigin,https://localhost,capacitor://localhost'
cd '$RemotePath/server'
npm ci --omit=dev
npm run migrate
if [ '$($RunEncryptionMigration.IsPresent.ToString().ToLowerInvariant())' = 'true' ]; then
  npm run migrate:encrypt
else
  echo 'Skipping legacy encryption migration (enable only after every historical key has been verified).'
fi
cd '$RemotePath/client'
npm ci
npm run build
cd '$RemotePath/server'
pm2 restart '$Pm2Name' --update-env || pm2 start server.js --name '$Pm2Name'
pm2 save
rm -f '$RemoteArchive'
curl --fail --silent --show-error --retry 8 --retry-delay 2 http://127.0.0.1:$HealthPort/api/health
"@
    Write-Host 'Installing, building, restarting PM2, and checking health...' -ForegroundColor Cyan
    & ssh @SshArgs $SshTarget $RemoteScript
    if ($LASTEXITCODE -ne 0) { throw 'Remote deployment failed. A timestamped backup remains in /tmp on the app VM.' }
    Write-Host "My Ajo updated successfully: http://$AppHost" -ForegroundColor Green
  }
}
finally {
  Remove-Item Env:\SQLCMDPASSWORD -ErrorAction SilentlyContinue
  if (Test-Path -LiteralPath $Archive) { Remove-Item -LiteralPath $Archive -Force }
}
