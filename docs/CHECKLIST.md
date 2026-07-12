# Nebula DTF — Build Checklist

Living tracker. `[ ]` = to build, `[x]` = built & tested, `[~]` = in progress, `[!]` = blocked.
Tick an item only when its code exists **and** its test passes. Full context in
[`IMPLEMENTATION_PLAN.md`](./IMPLEMENTATION_PLAN.md).

---

## Pre-flight (resolve before Phase 1 code)
- [x] 🚧 Confirm which basket assets Reflector prices — **resolved via mainnet oracle directly** (`CALI2B…2PLE6M`), live-tested 2026-07-06: XLM ✅ $0.1951, AQUA ✅ $0.00037933, EURC ✅ $1.1413, USDC ✅ (is the oracle's own base, fixed $1.00). **VELO confirmed NOT covered** (both candidate mainnet issuers tested, both null) — stays simulated.
- [x] 🚧 Decide: self-issued test tokens approved, renamed `tstAQUA/tstVELO/tstUSDC/tstEURC` (ADR-014, supersedes ADR-012); priced via off-chain relay from real mainnet Reflector, not arbitrary numbers
- [ ] 🚧 Request Launchtube access token (needed by Stage 1.5, not Week 1)
- [ ] Answer remaining open questions (team size, final mainnet basket, product name — "Nebula/SEF" used as placeholder)
- [x] Rust (1.96.1) + Stellar CLI (27.0.0) + `wasm32v1-none` installed and verified
- [x] Testnet identities created and funded (friendbot): nebula-admin / nebula-test-issuer / nebula-user

## Phase 1 — Stellar-native DTF (→ mainnet 25 Jul 2026)

### Stage 1.0 — Foundations
- [x] Cargo workspace: `folio`, `factory`, `oracle-router`, `mock-price-feed`, `nebula-interfaces`
- [x] OZ `stellar-tokens` 0.7.2 added, builds clean (`sep-40-oracle` dropped — ADR-009)
- [x] Shared types (`OracleAsset`, `PriceData`, clients) + per-contract error enums
- [ ] CI: `cargo test` + `stellar contract build` on push (local script `scripts/test.ps1` exists; CI when repo gets a remote)

### Stage 1.1 — OracleRouter (standalone contract)
- [x] Wrap SEP-40 `lastprice`, normalize to 14 decimals
- [x] Staleness guard (max-age seconds; ms-timestamp tolerant)
- [x] Two-source median (router v2 2026-07-05: 1–2 feeds/token, midpoint of 2, `allow_single` fallback, `try_lastprice` so a broken feed degrades instead of trapping)
- [x] Divergence check + error (`max_divergence_bps`, default 5%; trips `Divergence` — halts bootstrap/nav, never mint/redeem)
- [x] Unit tests vs mock feeds: 11 (single-feed v1 semantics + median/divergence/single-source/dead-feeds/config guards)

### Stage 1.2 — Folio core
- [x] Storage: assets+weights+decimals, admin, router addr, paused flag
- [x] OZ `fungible` Base embedded as share token (SEP-41 + burnable, 7 decimals)
- [x] `init_mint` bootstrap: oracle ratio validation (±1%), $1/share, min 1 share
- [x] `mint(shares, max_deposits)`: balance-proportional, ceil rounding, slippage-bounded, oracle-free (ADR-011)
- [x] `redeem(shares)`: burn → pro-rata floor payout (CEI); never pausable; oracle-free
- [x] `nav()` view (+ `balances()`, `get_assets()`)
- [x] `set_paused` (admin; mint-only) / `set_router` (admin)
- [x] Tests: 17 covering happy paths + ratio/dust/double-bootstrap/slippage/pause/stale-oracle/full-redeem/transfer/constructor guards

### Stage 1.3 — FolioFactory
- [x] `create_folio(...)` deploy_v2 + constructor init
- [x] Instance registry + versioned wasm hash (`set_wasm_hash`)
- [x] Tests: create→live folio round-trip, salt reuse rejected, admin-gated

### Stage 1.4 — Testnet end-to-end ✅ 2026-07-05
- [x] Deploy OracleRouter + Factory + Ecosystem Folio to testnet (addresses in `.stellar/nebula-testnet.json`; **current folio `CCFC3Z…E54LB`**, redeployed 2026-07-06 per ADR-014, see below)
- [x] Scripted mint → NAV → redeem round-trip passes on testnet (bootstrap $100 → 99.99972 shares @ $1.00; +10 proportional mint; −10 redeem; NAV dust accrued to holders)
- [x] **Jul 11 checkpoint: working testnet demo** — done six days early

### Stage 1.5 — Frontend + UX
- [ ] PasskeyKit onboarding (Face-ID wallet) — 🚧 blocked on Launchtube token (Freighter shipped as interim wallet, ADR-013)
- [ ] Launchtube fee sponsorship wired — 🚧 blocked on Launchtube token
- [x] Folio page: composition donut, live NAV (5s poll), user shares & position value (`app/`, builds clean, live-testnet read smoke test passing)
- [x] Mint/redeem flows with asset-ratio helper (simulate-first quote shows exact deposits; 0.5% buffered `max_deposits`) — browser-verified with Freighter 2026-07-08
- [x] Oracle prices are real, not arbitrary (ADR-014, 2026-07-06): off-chain relay reads live mainnet Reflector prices (XLM/AQUA/EURC) into our testnet `MockPriceFeed`; USDC fixed at oracle's own $1.00 base; only VELO (no Reflector coverage, confirmed) stays a labeled simulated placeholder. DIA dropped as a second source (confirmed unnecessary — Reflector alone is free, sufficient); router's dual-feed capability stays built but unused.

### Stage 1.6 — Testnet beta
- [ ] ≥5 cohort users mint on testnet
- [ ] Friction notes captured; screenshots for progress updates

### Stage 1.7 — Mainnet + hardening
- [ ] **Mainnet deploy**: OracleRouter + Factory + Ecosystem Folio
- [ ] Reflector mainnet feeds verified
- [ ] Seed small real balances
- [ ] Failure drills: pause, staleness reject, slippage-free redeem
- [ ] Landing page + minimal docs

### Stage 1.8 — Demo Day (Jul 25)
- [ ] Dry run + pitch deck + backup demo video
- [ ] Live judge mint on mainnet via passkey in <60s

## Phase 2 — Cross-chain — **shelved 2026-07-08, see Challenge 5**
- [x] **Aquarius single-asset deposit integration** (`mint_single_asset`) — contract now calls Aquarius `swap_chained` with admin-configured XLM -> basket-token routes. Needs live Aquarius pool-index hashes in `.stellar/nebula-testnet.json` before redeploy verification.
- [~] Everything below: **not being pursued** — Axelar has ~zero wrapped-ETH assets/liquidity on Stellar mainnet *or* testnet (Challenge 4). Kept as a reference plan only; revisit if that changes.
  - Axelar ITS inbound/outbound bridging (2a-2d), Allbridge Core, axl* segregated Folio
- [ ] SCF Build Award submitted; audit slot secured

## Phase 3 — RWA baskets (re-scoped 2026-07-08 — see Challenge 5)

### Active: synthetic RWA DTFs (new goal, plan in IMPLEMENTATION_PLAN.md §3.5)
- [ ] Confirm external synthetic-RWA-token project status (transferable SEP-41? which oracle — not Pyth, unsupported on Stellar; testnet availability?)
- [ ] If none available yet, evaluate building a minimal synthetic token (oracle-priced vault, mint/burn, plain SEP-41 output) ourselves
- [ ] Basket design + bootstrap once a real synthetic token exists to test against (same Folio primitive, no contract changes expected)

### Future consolidation goal, not active build: BENJI / DTCC
- [ ] ReservePool (allowlisted BENJI custody) — blocked on FT allowlisting our contract address (partnership, not engineering)
- [ ] OZ AllowList per-asset transfer eligibility — architecture already supports this (ADR-002); no new design work needed until a partnership exists
- [ ] FT/MoonPay institutional KYC + legal structuring — legal track, runs independent of code
- [ ] First DTCC-asset Folio design (permissioned) — DTCC assets targeted H1 2027 per their own timeline; revisit then
```
