# Nebula DTF — Decision & Build Log

The running record that keeps the system in check. Two parts:
1. **ADRs** — architectural decisions (with rationale) made up front.
2. **Build log** — one entry appended **after every completed stage**: what was built,
   what changed vs the plan, what was deferred, and why.

Keep entries short and honest. When reality differs from
[`IMPLEMENTATION_PLAN.md`](./IMPLEMENTATION_PLAN.md), record it here — this doc wins.

---

## Part 1 — Architecture Decision Records

### ADR-001 — One Folio contract embeds its own share token
**Decision:** The Folio contract inlines OpenZeppelin's `fungible` base module and *is* its
own SEP-41 share token; no separate token contract.
**Why:** Mint is atomic (no cross-contract call to a token contract mid-mint), fewer
deployables, smaller audit surface.
**Trade-off:** The share token can't be reused independently of its Folio — fine, it never should be.

### ADR-002 — Do not use the OZ Vault (ERC-4626); custom multi-asset accounting
**Decision:** Build proportional mint/redeem on top of the OZ fungible *base*, not the Vault.
**Why:** Verified 2026-07-05 — the OZ Stellar Vault is **single-asset** (one underlying,
immutable after init). A Folio holds N assets. Using the Vault would fight the primitive.
**Consequence:** We own the shares↔basket math. Also keeps the door open for the AllowList
extension (Phase 3) which composes with the fungible base.

### ADR-003 — Proportional deposit/redeem, no swaps (Phase 1)
**Decision:** Users deposit all basket assets in ratio; redeem returns underlying pro-rata.
**Why:** Stellar DEX liquidity is thin (~$23M SDEX). Proportional = zero slippage, no swap
dependency, honest at low TVL. Single-asset deposit (Soroswap) is Phase 2.

### ADR-004 — Static weights (Phase 1)
**Decision:** No rebalancing; basket drifts with price.
**Why:** Safe and truthful at low TVL; rebalancing needs post-DTCC liquidity depth.

### ADR-005 — OracleRouter is one standalone contract, shared by all Folios
**Decision:** Deploy price logic (staleness, median, divergence) once; Folios reference it.
**Why:** One place to configure and audit oracle policy; deploy once, not per-Folio. The
Folio (which holds funds) owns the pause decision; the router only returns a validated price or errors.

### ADR-006 — Immutable Folios + factory versioning; no proxies
**Decision:** Folios are not upgradeable. New logic = new wasm version deployed by the factory; users opt in.
**Why:** Upgradeable proxies are a top exploit/audit surface. Immutability is the safer default at this scale.

### ADR-007 — Multisig admin; mint/redeem pausable
**Decision:** Admin keys behind multisig; mint/redeem can be paused by admin or by oracle divergence.
**Why:** Contain oracle failure and operator error without ever custodying user funds beyond the contract.

### ADR-008 — Use audited bridges exactly as shipped (Phase 2); never a custom bridge
**Decision:** Axelar ITS + Allbridge Core, unmodified integration code.
**Why:** The Apr 2026 Secret Network $4.67M drain came from a team *adapting* Axelar code and
removing source-validation. Cross-chain Folios stay segregated and risk-labeled.

### ADR-009 — Hand-rolled SEP-40 interface instead of the `sep-40-oracle` crate
**Decision:** Define `OracleAsset`/`PriceData`/`Sep40Client` ourselves in `crates/nebula-interfaces` (~40 lines).
**Why:** Discovered at pin time (2026-07-05): `sep-40-oracle` 1.4.0 requires soroban-sdk ^25 while
OpenZeppelin `stellar-tokens` 0.7.2 (the audited share-token base — the dependency actually worth
keeping) requires ^26.1. Two SDK majors cannot coexist in one contract. The SEP-40 client surface
is trivial; the OZ token internals are not.

### ADR-010 — Single-feed router in Phase 1; median lands in Stage 1.5 via router swap
**Decision:** OracleRouter ships with one feed per token (staleness + normalization + positivity).
The Reflector+DIA median and divergence breaker arrive as a new router deployment; Folios repoint
with admin-gated `set_router`.
**Why:** DIA integration is scheduled for Stage 1.5 anyway; the router holds no funds, so swapping
it is cheap — no reason to carry dead median code through the Week-1 audit surface.

### ADR-011 — Oracle-free money path after bootstrap
**Decision:** After the first mint, `mint`/`redeem` are purely proportional to current balances:
`deposit_i = ceil(bal_i × shares / supply)`, `out_i = floor(bal_i × shares / supply)`. The oracle
prices only (a) the bootstrap ratio check and (b) the `nav()` view. Rounding always favors the
folio. Pause blocks minting only — redemption is never pausable and works with a dead oracle
(proven by test `redeem_works_while_paused_and_with_dead_oracle`).
**Why:** This shrinks the attack surface dramatically: a compromised or stale oracle cannot
mis-price a recurring mint or block an exit. It also means mint needs per-leg `max_deposits`
bounds (balances can shift between simulation and submission) instead of ratio validation.

### ADR-012 — Test tokens are self-issued classic assets, `T`-prefixed
**Superseded by ADR-014 (2026-07-06)** — kept for history; see below for the current design.
**Decision:** On testnet we issue classic assets `TAQUA`, `TVELO`, `TUSDC`, `TEURC` from a
dedicated `nebula-test-issuer` account and deploy their SACs; XLM uses the real native asset.
Prices come from `MockPriceFeed` (never deployed to mainnet). The router's per-token
`FeedSpec.asset` mapping means mainnet simply repoints each real token to Reflector.
**Why:** AQUA/VELO have no official testnet issuances (confirmed with user 2026-07-05); the
`T` prefix makes the mimicked asset obvious at a glance.

### ADR-013 — Frontend: dynamic contract client + Freighter interim wallet
**Decision:** The web app uses `contract.Client.from` (fetches the contract spec from the
chain at runtime) instead of generated TypeScript bindings, and ships with **Freighter** as
the interim wallet so the testnet beta can start. PasskeyKit + Launchtube slot in behind the
same `connectWallet()` seam once the Launchtube token arrives.
**Why:** No bindings package to regenerate on every contract change; Freighter needs zero
external approvals. The mint "asset-ratio helper" is free with this design: simulating
`mint` returns the exact required deposits, which the UI shows before the user signs
(then sends with a 0.5% `max_deposits` buffer).

### ADR-014 — Testnet asset prices sourced via off-chain relay from real mainnet Reflector
**Decision:** Supersedes ADR-012. Test tokens renamed `tst`-prefixed (`tstAQUA`, `tstVELO`,
`tstUSDC`, `tstEURC`); their oracle price is no longer arbitrary. An off-chain script
(`scripts/price-relay.ps1`) reads **real, live prices from mainnet** Reflector's public
"Stellar Pubnet Pulse Oracle" (`CALI2BYU2JE6WVRUFYTS6MSBNEHGJ35P4AVCZYF3B6QOE3QKOB2PLE6M`,
confirmed free/no invocation fee) via a plain read-only CLI call, and writes those real numbers
into our own testnet `MockPriceFeed` (`refresh-prices.ps1` / initial stamp in
`setup-testnet.ps1`). USDC is fixed at $1.00 (it's this oracle's own base/numeraire asset,
confirmed via `base()`). VELO has no coverage under either known mainnet issuer (both tested
live, both null) and stays a clearly-labeled simulated placeholder.
**Why:** A testnet contract can never call a mainnet contract on-chain — separate ledgers, no
shared execution, not a Soroban config option. So "find a live testnet oracle" was the wrong
frame entirely; the fix is an off-chain relay copying real mainnet data onto our own
already-built, already-controlled testnet feed. Zero contract changes required — the
`OracleRouter`'s token/asset decoupling and `MockPriceFeed`'s settable-price design already
supported exactly this. Full derivation and dead ends explored: `CHALLENGES_AND_DECISIONS.md`
Challenge 2.
**Consequence:** basket asset prices (except VELO) now track real markets, so bootstrap
deposit amounts can no longer be hardcoded — they're computed dynamically in
`setup-testnet.ps1` from the live relayed prices and target weights (`[bigint]` arithmetic;
intermediate values exceed int64).

---

## Part 2 — Build Log

> Template — copy for each completed stage:

### [YYYY-MM-DD] Stage X.Y — <name>
- **Built:** <what shipped>
- **Decisions this stage:** <key choices + why>
- **Changed vs plan:** <interfaces/approach that differed, or "none">
- **Deferred:** <what we consciously left out>
- **Tests:** <what's covered / notable failure cases>
- **External deps touched:** <accounts, tokens, APIs>

### [2026-07-05] Stages 1.0–1.3 — workspace, OracleRouter, Folio, Factory
- **Built:** Cargo workspace (`crates/nebula-interfaces` + 4 contracts); OracleRouter
  (feed map, staleness guard, ms-timestamp normalization, 14-dec price normalization);
  Folio (SAC custody, OZ fungible SEP-41 share token embedded, `init_mint` bootstrap with
  1% ratio tolerance, proportional `mint`/`redeem`, `nav()`, pause, admin `set_router`);
  FolioFactory (`deploy_v2` from stored wasm hash, registry, `set_wasm_hash` versioning);
  MockPriceFeed; testnet setup / price-refresh / test scripts. 27 tests green
  (8 router, 17 folio, 2 factory); all four wasm build clean (folio 22.8 KB).
- **Decisions this stage:** ADR-009 (drop `sep-40-oracle` crate — SDK 25 vs 26 conflict with OZ),
  ADR-010 (single-feed router now, median via router swap at Stage 1.5),
  ADR-011 (oracle-free proportional money path; mint bounded by `max_deposits`; redeem never pausable),
  ADR-012 (T-prefixed self-issued test tokens).
- **Changed vs plan:** OZ Vault confirmed unusable (single-asset) exactly as ADR-002 predicted;
  `sep-40-oracle` crate dropped (ADR-009); ratio validation on recurring mint replaced by
  balance-proportional math + slippage bounds (ADR-011) — strictly safer than the PRD sketch.
- **Deferred:** two-source median + divergence breaker (Stage 1.5); `#[contractevent]` migration
  (SDK 26 deprecates `events().publish` — warnings only, cosmetic); multisig admin setup
  (before mainnet, ADR-007).
- **Tests:** happy paths, wrong-ratio/dust/double-bootstrap rejects, slippage bound, paused
  semantics, stale-oracle behavior on both sides (blocks bootstrap; does NOT block mint/redeem),
  full-supply redeem, share transferability, constructor guards, factory salt reuse.
- **External deps touched:** Rust updated 1.84→1.96.1 (deps need edition2024); Stellar CLI 27.0.0
  via winget (`C:\Program Files (x86)\Stellar CLI`); `wasm32v1-none` target; testnet scripts
  written but **not yet run** — that's Stage 1.4.

### [2026-07-05] Stage 1.4 — testnet end-to-end (Jul 11 checkpoint met early)
- **Built/Deployed (testnet):** TAQUA/TVELO/TUSDC/TEURC SACs issued+minted; MockPriceFeed
  `CD7WLD…PQBE`; OracleRouter `CC45K7…UBKC`; Factory `CCM5OZ…OC7W`; **SEF Folio
  `CAG2JRYQ4HROM5NX2PFWUPY5T2EEJPPQNWKSLHTNCFDHN7KWIFV7VR4Y`** (XLM 40 / TAQUA 20 /
  TVELO 15 / TUSDC 15 / TEURC 10). All addresses in `.stellar/nebula-testnet.json`.
- **Verified live:** bootstrap $100 → 99.99972 shares at exactly $1.00 NAV; proportional
  mint of 10 shares pulled ceil-rounded pro-rata deposits; redeem of 10 returned
  floor-rounded amounts; NAV/share rose to 1.0000000025 after the cycle — rounding dust
  accrues to holders as designed (ADR-011).
- **Decisions this stage:** scripts hardened for PS 5.1 (ASCII-only, quoted `'--'`
  passthrough, literal `\"` JSON escaping, local ErrorActionPreference in the CLI wrapper,
  SAC-deploy fallback to `contract id asset` on re-run). Router max_age = 24h on testnet
  only (mock prices are static); mainnet uses a tight bound with live Reflector.
- **Deferred:** wiring XLM to the real Reflector testnet feed (`CAVLP5…D6HLP`) — mock keeps
  dev deterministic; swap when the median router lands (Stage 1.5).
- **External deps touched:** testnet identities funded via friendbot; ~15 testnet txs.

### [2026-07-05] Stage 1.5 (oracle half) — median router v2 live, folio repointed
- **Built:** OracleRouter v2 — per-token `Vec<FeedSpec>` (1–2 feeds), midpoint-of-2 median,
  `max_divergence_bps` circuit breaker (trips `Divergence`), `allow_single` fallback when one
  source is stale/dead, `try_lastprice` so a *broken* feed contract degrades to an error
  instead of trapping the transaction. Single-feed error semantics preserved from v1.
  30 tests green workspace-wide (router 11).
- **Deployed (testnet):** router v2 `CBOB27FS…DJWWM` (5% divergence, allow_single, 24h max_age),
  second MockPriceFeed as DIA stand-in `CBYG366L…FBLO`; all 5 tokens wired to both feeds;
  live SEF folio repointed with `set_router` — NAV unchanged through the swap, proving the
  ADR-010 router-upgrade path end-to-end.
- **Decisions this stage:** breaker design stays consistent with ADR-011 — divergence halts
  *pricing* (bootstrap, nav), never mint/redeem, so a tripped breaker cannot trap funds.
  Median of 2 = midpoint; timestamp = older of the two (conservative freshness).
- **Deferred:** real DIA testnet feed (need their verified contract address — the stand-in is
  interface-identical); `#[contractevent]` migration (cosmetic warnings).
- **Changed vs plan:** none — this closes the two Stage-1.1 items deferred by ADR-010.

### [2026-07-05] Stage 1.5 (app half) — folio web app built; review fix; initial commits
- **Built:** `app/` — Vite + React + TS single-page folio dashboard: NAV/total-value/supply
  cards on a 5s poll, SVG weights donut + holdings table, wallet connect (Freighter),
  simulate-first mint quote → confirm with 0.5% buffered `max_deposits`, redeem, position
  value, oracle-guard surfacing (a tripped breaker shows "NAV unavailable" instead of
  breaking the page). `npm run build` clean; `smoke.mjs` verifies the dynamic client against
  the live testnet folio (NAV/assets/supply reads).
- **Review pass:** full codebase read-through. One defect found+fixed: `redeem` with zero
  supply hit divide-by-zero (host trap) instead of a clean `NotBootstrapped` error —
  regression test added (31 tests total). Stale router-v1 test snapshots purged.
- **Commits:** repo history started — docs / contracts / scripts / snapshots-cleanup / app.
- **Decisions this stage:** ADR-013 (dynamic client + Freighter interim).
- **Deferred:** PasskeyKit + Launchtube (🚧 external token, the only open Phase-1 gate);
  browser-manual test of mint/redeem with a funded Freighter account (cohort beta,
  Stage 1.6); bundle code-splitting (stellar-sdk is 349KB gzipped — acceptable).
- **External deps touched:** npm registry (React 19, stellar-sdk 14, freighter-api 4,
  Vite 6); Node 22.13 local.
```

### [2026-07-06] Oracle rework — mainnet price relay, tst-tokens, fresh testnet deploy
- **Built:** ADR-014 (see above) — `scripts/price-relay.ps1` (shared `Get-RelayedPrices`:
  live mainnet Reflector query for XLM/AQUA/EURC, fixed $1.00 for USDC, simulated placeholder
  for VELO); `refresh-prices.ps1` and `setup-testnet.ps1` rewritten to consume it; DIA
  stand-in feed dropped from testnet deployment (single real feed per token, per the earlier
  "DIA is overkill" decision). `setup-testnet.ps1` now computes bootstrap deposit amounts
  dynamically from the live relayed prices and target weights (`[bigint]` math — the formula
  `deposit_units = TOTAL_USD * weight_bps * 10^17 / price_14dec` needs >int64 precision)
  instead of hardcoding stale amounts.
- **Deployed (fresh testnet stack, old one retired):** tokens `tstAQUA`/`tstVELO`/`tstUSDC`/
  `tstEURC` (self-issued, ADR-014); MockPriceFeed stamped with real relayed prices at deploy
  time (XLM $0.1951, AQUA $0.00037933, EURC $1.1413, USDC $1.00, VELO $0.02 simulated);
  OracleRouter, Factory, and a new **SEF Folio
  `CCFC3Z74YYOXMRZMXZTSGO4KCARSZW3CDSNLGV63E5RAEBWIGW2E54LB`** bootstrapped at $99.9999999795
  (~$100 target) with ratio check passing on the first try using dynamically-computed
  deposits. Addresses in `.stellar/nebula-testnet.json`.
- **App updated:** `config.ts` FOLIO_ID and TOKEN_INFO repointed to the new addresses;
  `smoke.mjs` re-verified live (NAV, 5 assets, supply). Added a small UI marker
  (`TOKEN_INFO.simulated`) that renders "(simulated)" next to tstVELO in the holdings table,
  so the one asset without real oracle backing is visibly flagged, not hidden.
- **Decisions this stage:** confirmed (live, on-chain) that Reflector's `Stellar(Address)`
  identifier is always the **mainnet**-computed SAC address regardless of which network the
  oracle contract runs on; confirmed via `base()` that USDC is this oracle's own numeraire;
  confirmed VELO has zero Reflector coverage under either candidate mainnet issuer.
- **Changed vs plan:** superseded the "find a live testnet Reflector oracle" approach entirely
  — architecturally impossible (cross-network contract calls don't exist in Soroban), not just
  hard to find. Off-chain relay was the actual fix, needed zero contract changes.
- **Deferred:** none new; VELO remains simulated until/unless a real feed appears (tracked in
  `CHALLENGES_AND_DECISIONS.md`).
- **External deps touched:** mainnet Soroban RPC (`https://mainnet.sorobanrpc.com`, read-only,
  free) for the price relay; no mainnet write access, no mainnet funds needed.

### [2026-07-06] Bug found live via app: missing trustlines block any fresh wallet from minting
- **Found:** a real Freighter wallet (`GDCU5J...`) hit `"trustline entry is missing for
  account"` on `tstAQUA` mid-mint. Root cause: classic (non-native) Stellar assets require the
  receiving account to explicitly establish a trustline before it can hold that asset — a base
  ledger rule, unrelated to our contracts. `nebula-user` (our scripted test identity) worked
  fine only because `setup-testnet.ps1` explicitly ran `change-trust` for it. Any other wallet
  — i.e. every real user — was silently blocked from minting at all. Confirmed live: this
  specific account has a trustline to an unrelated real testnet USDC but none of our 4 `tst*`
  assets.
- **Built:** `lib/folio.ts` — `getMissingTrustlines(publicKey)` (Horizon `loadAccount`, diffs
  against `TRUSTLINE_ASSETS` from config) and `addTrustlines(publicKey, assets)` (builds one
  `changeTrust` op per missing asset in a single transaction, signs via Freighter, submits to
  Horizon directly — this is a classic-ledger operation, not a Soroban contract call, so it
  goes through `TransactionBuilder`/`Horizon.Server`, not `contract.Client`). App: on wallet
  connect, checks trustlines; if any missing, shows a banner explaining why (framed as a base
  Stellar rule, not an app bug) with a one-click "Add trustlines" button; mint controls stay
  disabled until resolved.
- **Config:** added `VITE_HORIZON_URL` and `VITE_TEST_ISSUER` to `.env`; `TRUSTLINE_ASSETS`
  list in `config.ts` (the 4 classic assets; XLM excluded, needs none).
- **Decisions this stage:** redeem needed no equivalent guard — you can't hold shares without
  having minted first, which already requires trustlines, so the gate on mint alone is
  sufficient.
- **Deferred:** actual browser click-through test with a funded Freighter wallet (verified the
  detection logic against the real problem account via Node/Horizon directly; full UI flow
  — banner, click "Add trustlines", confirm mint unblocks — not yet manually driven in a
  browser). Do this before calling Stage 1.6 beta-ready.

### [2026-07-06] Testnet faucet added
- **Built:** `lib/faucet.ts` — `dripTestTokens(destination)` sends one payment transaction
  (native XLM + all 4 `tst*` assets) signed by the issuer account directly. A "Testnet faucet"
  card in the app runs the full onboarding in one click: check/add trustlines (user-signed via
  Freighter) then the drip (issuer-signed, no user interaction needed) — resolves the same
  friction the previous entry's trustline-banner fix surfaced, end to end.
- **ADR-015 (inline decision, not worth a full entry above):** the issuer's secret key is
  embedded client-side (`VITE_TEST_ISSUER_SECRET`), asked and confirmed with the user first.
  Justified only because these are worthless self-issued testnet assets — worst case someone
  else also mints free fake tokens or drains the issuer's test XLM (free, refillable via
  Friendbot). **This pattern must never be used for a real or mainnet issuer.**
- **Verified live, fully end-to-end:** a brand-new random keypair, Friendbot-funded from
  nothing, ran the exact production code path (trustlines then drip) and ended with
  1,000,000 tstAQUA / 10,000 tstVELO / 1,000 tstUSDC / 1,000 tstEURC / ~10,020 XLM. Proves the
  whole "connect wallet -> get tokens -> mint" path works for a wallet with zero prior state,
  not just our internally-provisioned `nebula-user`.
- **Sizing:** drip amounts are demo-scale, not proportioned to the folio's live target weights
  (20 XLM ~$3.9 is intentionally modest — mostly fee money, limits a single wallet to a few
  shares' worth of test minting, which is enough to exercise the flow, not to move real
  weight). Re-drip anytime; no per-wallet limit is enforced.
- **Deferred:** still no manual browser click-through (script-verified only, both the
  trustline fix and now the faucet); rate-limiting the faucet (not needed yet, low expected
  usage during a hackathon).

### [2026-07-06] Soroswap testnet pools seeded — gate proven before building
- **Gate condition (set by user):** only build the seeding script if a pool can actually be
  created via API calls alone — no custom AMM contract as a fallback. Tested by hand first:
  one manual `add_liquidity` call for `XLM/tstUSDC` on the real testnet Router
  (`CCJUD55...E7BRD`) succeeded on the first attempt. Confirmed conclusively by re-checking the
  exact deterministic pair address that had returned `Contract not found` minutes earlier in
  the previous session — it now returns real reserves `[100 tstUSDC, 512 XLM]`. Gate cleared.
- **Built:** `scripts/seed-pools.ps1` — seeds all 4 hub-via-XLM pools, idempotent (checks
  `get_reserves` first, skips anything already seeded), amounts computed from live relayed
  prices (`price-relay.ps1`) targeting ~$100/leg, `[bigint]` math same as the bootstrap-deposit
  formula. Ran it: correctly skipped the already-seeded USDC pool, seeded the other 3
  (tstAQUA, tstVELO, tstEURC) cleanly, zero errors, first run.
- **Result:** all 4 pools live with real reserves — addresses and amounts in `DEPLOYMENT.md`.
  Confirms the whole "seed real Soroswap instead of building our own AMM" plan from the prior
  session's research, not just in theory but with real transactions on real infrastructure.
- **Deferred:** the `mint_single_asset` Folio function itself — the pools existing is the
  prerequisite, not the feature. Next actual build step.

### ADR-016 — Single-asset deposit: exact-input swaps + authorize_as_current_contract
**Decision:** `mint_single_asset(user, deposit_token, deposit_amount, min_shares_out, deadline)`
lets a user deposit one asset (e.g. XLM); the Folio splits it by each basket asset's current
value fraction, swaps every non-deposit slice into that asset via the real Soroswap Router,
and mints shares from the folio's *actual* post-swap value gain
(`shares_out = value_added × supply / value_before`).
**Why this shape (learned from a failing test, not guessed):**
1. **`authorize_as_current_contract` is mandatory.** When the Folio (a contract) calls the
   router and the router moves the Folio's tokens, the Folio must explicitly authorize that
   sub-transfer — `mock_all_auths` does not cover it and neither does implicit caller-auth
   (the router, not the folio, is the direct caller of `transfer`). The unit test caught this
   as `Error(Auth, InvalidAction)`; it's real production behavior, verified again live on-chain.
2. **Exact-input, not exact-output.** Auth entries must match the transfer args *exactly*.
   An exact-output swap's input amount isn't known until execution, so it can't be
   pre-authorized without an extra `router_get_amounts_in` round-trip. Exact-input swaps let
   the Folio authorize the precise amount it chose to spend. (Interface switched to
   `swap_exact_tokens_for_tokens` + `router_pair_for` accordingly.)
3. **Mint from actual value added, not deposit value.** This makes the depositor bear their
   own AMM slippage/fees and preserves NAV/share exactly for existing holders — no dilution.
   `min_shares_out` bounds price movement between quote and submission; the whole call is
   atomic (any leg failing reverts everything).
**Verified end-to-end live 2026-07-08:** deposited 20 XLM into Folio v2, 4 real swaps through
our seeded pools executed in a single transaction (resource budget fits), 3.86 SEF minted,
NAV/share held at $1.00.

### [2026-07-08] Single-asset deposit shipped — contract, tests, Folio v2, app
- **Built:** `nebula-interfaces` SoroswapRouter client (`swap_exact_tokens_for_tokens`,
  `router_pair_for`); `mint_single_asset` + `set_soroswap_router`/`soroswap_router` in the
  Folio; `nebula-mock-soroswap-router` crate (fixed-rate stand-in, is its own pool) for
  isolated unit tests; 7 new folio tests (fair-shares, slippage-reduces-shares-and-trips-min,
  paused, bootstrap, deadline, min-shares, not-configured). 38 tests green workspace-wide;
  folio wasm 27 KB.
- **Deployed:** Folio **v2 `CCOMNDEZSPR7ZXCPCVOKCGQEPAG33UAYTTR526P63P7HIPEXPJXVCQKB`** via the
  factory (ADR-006 versioning — old folio `CCFC3Z…E54LB` untouched), wired to Soroswap, bootstrapped.
  `scripts/deploy-folio-v2.ps1` (reproducible, reuses existing tokens/pools).
- **App:** `.env`/config repointed to v2 + pool addresses; new "Deposit XLM → get the basket"
  card (simulate-first quote, 1%-buffered `min_shares_out`) and a "Liquidity pools" card
  reading each Soroswap pair's reserves directly (the public Soroswap testnet dashboard indexes
  only pools created through its own UI, so ours weren't listed there — reading chain state
  sidesteps that entirely). Build clean; smoke test green against v2.
- **Deferred:** browser click-through of the deposit flow (contract path proven live via CLI;
  UI wiring built + type-checked but not manually driven in a browser). `#[contractevent]`
  migration (cosmetic warnings persist).

### [2026-07-08] Browser verification complete — all app flows confirmed by hand
Clears the "browser click-through pending" deferrals accumulated across the prior entries
(faucet, trustline banner, mint/redeem, and the single-asset XLM deposit + pools page). All
confirmed working in-browser with Freighter on testnet. Only remaining non-cosmetic deferral
in Phase 1 is PasskeyKit + Launchtube (still gated on the Launchtube token). Phase 1 app is
functionally complete for the cohort beta.
