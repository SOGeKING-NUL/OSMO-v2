# Aquarius route/pool verification for testnet.
#
# Historical note: this script used to seed Soroswap pools. OSMO now routes
# single-asset deposits through Aquarius, whose pools/routes must come from
# Aquarius pool/path discovery. This script verifies the configured pool-index
# hashes by reading reserves from the Aquarius entry contract; it does not
# create or seed Aquarius pools.

$ErrorActionPreference = "Stop"
$AQUARIUS = "CBQDHNBFBZYE4MKPWBSJOPIYLW4SFSXAXUTSXJN76GNKYVYPCKWC6QUK"

function Invoke-Stellar {
    $ErrorActionPreference = "Continue"
    & stellar @args
    if ($LASTEXITCODE -ne 0) { throw "stellar $($args -join ' ') failed" }
}

function Get-RequiredPoolIndex($cfg, $name) {
    $value = $cfg.$name
    if (-not $value) {
        throw "Missing $name in .stellar\nebula-testnet.json. Fill it with the Aquarius pool-index hash for this XLM/token route."
    }
    return $value
}

$cfg = Get-Content .stellar\nebula-testnet.json | ConvertFrom-Json

$pools = @(
    @{ code = "tstAQUA"; token = $cfg.sac_tstaqua; pool = (Get-RequiredPoolIndex $cfg "aquarius_pool_tstaqua_xlm") }
    @{ code = "tstVELO"; token = $cfg.sac_tstvelo; pool = (Get-RequiredPoolIndex $cfg "aquarius_pool_tstvelo_xlm") }
    @{ code = "tstUSDC"; token = $cfg.sac_tstusdc; pool = (Get-RequiredPoolIndex $cfg "aquarius_pool_tstusdc_xlm") }
    @{ code = "tstEURC"; token = $cfg.sac_tsteurc; pool = (Get-RequiredPoolIndex $cfg "aquarius_pool_tsteurc_xlm") }
)

foreach ($p in $pools) {
    Write-Host "== Aquarius $($p.code) / XLM =="
    $tokensJson = "[\`"$($cfg.xlm_sac)\`",\`"$($p.token)\`"]"
    Invoke-Stellar contract invoke --id $AQUARIUS --source nebula-user --network testnet --send=no '--' get_reserves `
        --tokens $tokensJson --pool_index $p.pool
}

Write-Host ""
Write-Host "Done. Aquarius pool-index hashes are configured and readable."
