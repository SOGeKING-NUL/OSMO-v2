# Nebula DTF — Decentralized Token Folios on Stellar

One token that holds a basket of Stellar assets. Mint against proportional
deposits, redeem pro-rata anytime, live NAV from SEP-40 oracles (Reflector).

**Docs:** [PRD](docs/stellar_dtf_prd.md) · [Implementation plan](docs/IMPLEMENTATION_PLAN.md) ·
[Checklist](docs/CHECKLIST.md) · [Decision log](docs/DECISION_LOG.md) ·
[External dependencies](docs/EXTERNAL_DEPENDENCIES.md) ·
[**Current deployment (addresses + identities)**](docs/DEPLOYMENT.md) ·
[Challenges & dead ends](docs/CHALLENGES_AND_DECISIONS.md)

## Layout

```
crates/nebula-interfaces      shared SEP-40 types + cross-contract clients
contracts/oracle-router       validated prices: feed map, staleness, normalization
contracts/folio               the DTF: basket custody + SEP-41 share token + mint/redeem
contracts/factory             deploys folios from a versioned wasm hash, registry
contracts/mock-price-feed     settable SEP-40 feed (tests/testnet only — never mainnet)
scripts/                      build+test, testnet bootstrap, price refresh
app/                          folio web app (Vite+React; `npm run dev`; Freighter wallet)
```

## Build & test

```powershell
scripts\test.ps1     # = stellar contract build + cargo test --workspace
```

Requires Rust ≥1.85, `wasm32v1-none` target, [Stellar CLI](https://developers.stellar.org/docs/tools/cli).
Build wasm before testing — the factory test imports the folio wasm.

## Testnet

```powershell
scripts\setup-testnet.ps1    # identities, test tokens, full stack, bootstrapped SEF folio
scripts\refresh-prices.ps1   # re-relay live mainnet Reflector prices when the feed goes stale
```

Test tokens are self-issued classic assets named `tst<code>` (`tstAQUA` mimics AQUA,
`tstUSDC` mimics USDC, …); XLM is the real native testnet asset. A testnet contract can never
call a mainnet contract directly (separate ledgers), so `scripts/price-relay.ps1` reads real
prices off mainnet Reflector and writes them into our own testnet price feed — see ADR-014 in
[`DECISION_LOG.md`](docs/DECISION_LOG.md). `tstVELO` has no real Reflector coverage and stays a
labeled simulated price. Addresses land in `.stellar/nebula-testnet.json`.

## Key invariants

- After bootstrap, mint/redeem are purely proportional to on-chain balances —
  the oracle is **not** in the recurring money path (`docs/DECISION_LOG.md` ADR-011).
- Rounding always favors the folio: deposits ceil, redemptions floor.
- Pause blocks minting only; **redemption is never pausable**.
- Folios are immutable; new logic ships as a new wasm version via the factory (ADR-006).
