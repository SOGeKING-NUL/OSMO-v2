# Deploys a new Folio version (adds Aquarius-backed mint_single_asset) via the existing
# Factory - immutable-folio versioning per ADR-006: upload new wasm, point the
# factory at it, create a fresh folio, wire Aquarius routes, bootstrap. The old folio
# is left untouched. Reuses the already-deployed tokens/feed/oracle-router and
# token SAC addresses.
#
# Writes the new folio address back into .stellar\nebula-testnet.json (folio_sef).

$ErrorActionPreference = "Stop"
$Network = "testnet"
$AQUARIUS = "CBQDHNBFBZYE4MKPWBSJOPIYLW4SFSXAXUTSXJN76GNKYVYPCKWC6QUK"
. "$PSScriptRoot\price-relay.ps1"

function Invoke-Stellar {
    $ErrorActionPreference = "Continue"
    & stellar @args
    if ($LASTEXITCODE -ne 0) { throw "stellar $($args -join ' ') failed" }
}

$cfg = Get-Content .stellar\nebula-testnet.json | ConvertFrom-Json
# bare CLI reads: silence the stderr config-warning that would trip Stop
$ErrorActionPreference = "Continue"
$admin = (& stellar keys address nebula-admin) 2>$null
$user = (& stellar keys address nebula-user) 2>$null
$ErrorActionPreference = "Stop"

Write-Host "== 1. Upload new Folio wasm, point Factory at it"
$wasmHash = Invoke-Stellar contract upload --wasm target\wasm32v1-none\release\nebula_folio.wasm --source nebula-admin --network $Network
Write-Host "  wasm hash: $wasmHash"
Invoke-Stellar contract invoke --id $cfg.factory --source nebula-admin --network $Network '--' set_wasm_hash --folio_wasm_hash $wasmHash

Write-Host "== 2. Create Folio v2 (same basket XLM 40 / tstAQUA 20 / tstVELO 15 / tstUSDC 15 / tstEURC 10)"
$salt = -join ((1..64) | ForEach-Object { "{0:x}" -f (Get-Random -Max 16) })
$ids = @($cfg.xlm_sac, $cfg.sac_tstaqua, $cfg.sac_tstvelo, $cfg.sac_tstusdc, $cfg.sac_tsteurc)
$weightsBps = @(4000, 2000, 1500, 1500, 1000)
$folioTokens = '[\"' + ($ids -join '\",\"') + '\"]'
$folioWeights = "[" + ($weightsBps -join ",") + "]"
$folio = Invoke-Stellar contract invoke --id $cfg.factory --source nebula-admin --network $Network '--' create_folio `
    --salt $salt --folio_admin $admin --router $cfg.router `
    --name "Stellar Ecosystem Folio" --symbol "SEF" `
    --tokens $folioTokens --weights_bps $folioWeights
$folio = $folio.Trim('"')
Write-Host "  Folio v2: $folio"

Write-Host "== 3. Wire Aquarius AMM routes (enables mint_single_asset)"
Invoke-Stellar contract invoke --id $folio --source nebula-admin --network $Network '--' set_aquarius_router --aquarius_router $AQUARIUS

function Get-RequiredPoolIndex($name) {
    $value = $cfg.$name
    if (-not $value) {
        throw "Missing $name in .stellar\nebula-testnet.json. Fill it with the Aquarius pool-index hash for this XLM/token route."
    }
    return $value
}

function OneHopRouteJson($tokenOut, $poolIndex) {
    # Vec<(Vec<Address>, BytesN<32>, Address)> as JSON for the Stellar CLI.
    return "[[[\`"$($cfg.xlm_sac)\`",\`"$tokenOut\`"],\`"$poolIndex\`",\`"$tokenOut\`"]]"
}

$routeSpecs = @(
    @{ token = $cfg.sac_tstaqua; pool = (Get-RequiredPoolIndex "aquarius_pool_tstaqua_xlm") }
    @{ token = $cfg.sac_tstvelo; pool = (Get-RequiredPoolIndex "aquarius_pool_tstvelo_xlm") }
    @{ token = $cfg.sac_tstusdc; pool = (Get-RequiredPoolIndex "aquarius_pool_tstusdc_xlm") }
    @{ token = $cfg.sac_tsteurc; pool = (Get-RequiredPoolIndex "aquarius_pool_tsteurc_xlm") }
)

foreach ($r in $routeSpecs) {
    $routeJson = OneHopRouteJson $r.token $r.pool
    Invoke-Stellar contract invoke --id $folio --source nebula-admin --network $Network '--' set_aquarius_route `
        --token_in $cfg.xlm_sac --token_out $r.token --route $routeJson
}

Write-Host "== 4. Bootstrap ~`$100 at target ratio (amounts from live relayed prices)"
$live = Get-RelayedPrices
$TOTAL_USD = [bigint]100
$TEN17 = [bigint]::Parse("100000000000000000")
$priceList = @($live.XLM, $live.AQUA, $live.VELO, $live.USDC, $live.EURC)
$deposits = for ($i = 0; $i -lt $ids.Length; $i++) {
    (($TOTAL_USD * [bigint]$weightsBps[$i] * $TEN17) / [bigint]::Parse($priceList[$i])).ToString()
}
Write-Host "  deposits (7-dec): $($deposits -join ', ')"
$depositsJson = '[\"' + ($deposits -join '\",\"') + '\"]'
Invoke-Stellar contract invoke --id $folio --source nebula-user --network $Network '--' init_mint --user $user --deposits $depositsJson
Invoke-Stellar contract invoke --id $folio --source nebula-user --network $Network '--' nav

Write-Host "== 5. Persist new folio address"
$cfg.folio_sef = $folio
$cfg | ConvertTo-Json | Out-File -Encoding utf8 .stellar\nebula-testnet.json
Write-Host "Done. Folio v2: $folio  (update app/.env VITE_FOLIO_ID)"
