$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$databaseContainer = "supabase_db_Fieldio.shop"

function Reset-LocalDatabase([string[]]$ExtraArgs) {
  for ($attempt = 1; $attempt -le 2; $attempt++) {
    & supabase db reset --local --no-seed @ExtraArgs
    if ($LASTEXITCODE -eq 0) { return }
  }
  throw "Local database reset failed after two attempts."
}

Set-Location $projectRoot
if (-not (Select-String -Quiet -Path "supabase/config.toml" -Pattern '^port = 54322$')) {
  throw "Lifecycle tests require the isolated local Supabase database port 54322."
}

& supabase start | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Local Supabase start failed." }

Write-Host "[1/2] Verifying legacy records through migrations 003-010"
Reset-LocalDatabase @("--version", "202609250002")
Get-Content -Raw "supabase/tests/legacy_pre_003_fixture.sql" | docker exec -i $databaseContainer psql -v ON_ERROR_STOP=1 -U postgres -d postgres
if ($LASTEXITCODE -ne 0) { throw "Legacy fixture load failed." }
supabase migration up --local
if ($LASTEXITCODE -ne 0) { throw "Migration chain 003-010 failed." }
supabase test db --local "supabase/tests/marketplace_legacy_compatibility.test.sql"
if ($LASTEXITCODE -ne 0) { throw "Legacy compatibility tests failed." }

Write-Host "[2/2] Verifying the complete marketplace lifecycle"
Reset-LocalDatabase @()
supabase test db --local "supabase/tests/marketplace_lifecycle.test.sql"
if ($LASTEXITCODE -ne 0) { throw "Marketplace lifecycle tests failed." }
