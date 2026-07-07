# Nebula DTF — Implementation Plan & Thesis

**Owner:** Utsav Jana
**Source of truth for scope:** `stellar_dtf_prd.md` (PRD v1.0)
**This doc:** how we actually build it, in order, with real interfaces.
**Companion docs:** [`CHECKLIST.md`](./CHECKLIST.md) · [`DECISION_LOG.md`](./DECISION_LOG.md) · [`EXTERNAL_DEPENDENCIES.md`](./EXTERNAL_DEPENDENCIES.md)

---

## 0. TL;DR (read this if nothing else)

We are building the **basket primitive** for Stellar: a Soroban contract (a "Folio")
that holds N on-chain assets, mints one fungible share token against proportional
deposits, computes live NAV from Reflector, and redeems shares pro-rata. Ship Phase 1
to **mainnet** by 25 July 2026.

The first coding target — literally the next thing we build — is exactly what you asked for:

> the contract that mints the DTF (Folio share) token against on-chain collateral
> (SAC-wrapped assets: XLM, USDC, EURC, and friends).

Cross-chain (Axelar) and BENJI/DTCC are Phase 2 and 3. We design so they *slot in*
without a rewrite, but we do not build them now.

**Before we write code, three external things must be confirmed** (see
[`EXTERNAL_DEPENDENCIES.md`](./EXTERNAL_DEPENDENCIES.md), items marked 🚧):
1. Which basket assets Reflector actually prices on testnet/mainnet (NAV depends on it).
2. Whether AQUA/VELO exist on testnet, or we deploy mock SAC test tokens.
3. A Launchtube access token for the fee-sponsored passkey UX (Week 2, not blocking Week 1).

---

## 1. Thesis — what we are building and why

**The gap.** On Stellar today you cannot hold diversified exposure in one token. DTCC
(post-trade backbone of Wall Street, $114T custodied) picked Stellar as its first public
chain for tokenized securities; BENJI, Circle USDC/EURC, and Treasuries are already native.
No basket/DTF product exists on Stellar. Whoever ships the audited basket primitive *now*
becomes the default portfolio layer when the DTCC asset wave lands in H1 2027.

**The product.** A **Folio** = a Soroban contract that:
- custodies several Stellar assets via SAC (Stellar Asset Contract, the SEP-41 interface);
- mints a **Folio share** token (SEP-41, built on OpenZeppelin's audited fungible base);
- redeems shares pro-rata for the underlying at any time;
- computes NAV on-chain from oracle prices at every mint/redeem.

**The wedge (from category data).** Passive *index* DTFs failed (Index Coop $500M→$52M;
Reserve Index DTFs $1.7M). *Yield* DTFs found PMF fast (Reserve Yield DTFs $200M+). So the
destination is **yield-bearing baskets** anchored by a regulated on-chain yield asset
(BENJI, ~3.5%). Phase 1 ships the crypto-native "Stellar Ecosystem" basket as the wedge;
yield is Phase 1.5 / Phase 3.

**Why the phasing is honest, not lazy:**
- Stellar DEX liquidity is thin (~$23M SDEX). So Phase 1 uses **proportional deposits** —
  no swaps, no slippage — and **static weights** — no rebalancing. We design *around* the
  liquidity we actually have instead of pretending it's deep.
- Bridges are the #1 source of catastrophic loss. So cross-chain is opt-in, segregated, and
  uses **audited Axelar/Allbridge exactly as shipped** — never a custom bridge.
- BENJI/DTCC are allowlist-gated securities. That's a legal/partnership track, not a code
  hack — we architect for per-asset transfer eligibility (OZ AllowList) and defer the rest.

---

## 2. Architecture (grounded in verified 2026 interfaces)

### 2.1 Contract map

```
FolioFactory ──deploys──▶ Folio (one instance per basket)
                            │  embeds ── FolioShare  (SEP-41, OZ fungible base module)
                            │  holds ──  SAC balances (XLM, USDC, EURC, AQUA, VELO…)
                            │  mint(deposits[])  / redeem(shares)
                            │  nav()  ──calls──▶ OracleRouter
                            │  pause() / unpause()  (circuit breaker + admin)
                            ▼
OracleRouter (deployed once, shared by all Folios)
   └─ wraps Reflector (primary) + DIA (secondary) via sep-40-oracle PriceFeedClient
   └─ returns validated USD price or errors on staleness / divergence

ReservePool (Phase 3) ── allowlisted BENJI custody ──▶ allocates to yield Folios
```

### 2.2 Key design decisions (full rationale in `DECISION_LOG.md`)

| # | Decision | Why |
|---|---|---|
| ADR-001 | **One Folio contract embeds its own share token** (OZ `fungible` base module inline), not a separate token contract. | Atomic mint (no cross-contract call to a token contract), fewer moving parts, simpler audit surface. |
| ADR-002 | **Do NOT use OZ Vault (ERC-4626).** Custom multi-asset mint/redeem on the OZ fungible *base*. | Verified: the OZ Vault is **single-asset**. A Folio holds N assets; forcing the vault would fight the primitive. |
| ADR-003 | **Proportional deposit/redeem, no swaps, Phase 1.** | Sidesteps thin DEX liquidity entirely; zero slippage; honest at low TVL. |
| ADR-004 | **Static weights, Phase 1** (basket drifts with price; no rebalancing). | Safe at low TVL; rebalancing needs post-DTCC liquidity. |
| ADR-005 | **OracleRouter is a standalone contract deployed once**, referenced by all Folios. | Single place for staleness/divergence config; deploy price logic once, not per-Folio. |
| ADR-006 | **Immutable Folios + factory versioning.** No upgradeable proxies. | Proxies are the classic audit/exploit surface; a new version = a new deploy users opt into. |
| ADR-007 | **Admin behind multisig; mint/redeem pausable** by admin and by oracle divergence. | Contain oracle failure and operator error without holding user funds hostage. |

### 2.3 Verified build primitives (research done 2026-07-05)

| Need | Primitive | Verified interface |
|---|---|---|
| Share token (SEP-41) | OpenZeppelin `stellar-contracts` `fungible` module | `FungibleToken` + `FungibleBurnable` traits; `mintable` extension; `AllowList`/`BlockList` extensions for Phase 3. Audited (Certora). [docs](https://docs.openzeppelin.com/stellar-contracts/tokens/fungible/fungible) |
| Hold/move underlying assets | SAC via `soroban_sdk::token::TokenClient` | `TokenClient::new(&env, &id)` then `.transfer(from, to, amount)`, `.balance(addr)`. [docs](https://developers.stellar.org/docs/tokens/stellar-asset-contract) |
| Prices + staleness | `sep-40-oracle` crate `PriceFeedClient` (Reflector implements SEP-40) | `lastprice(asset) -> Option<PriceData>`, `PriceData { price: i128, timestamp: u64 }`, plus `decimals()`, `resolution()`, `price(asset, ts)`. [docs.rs](https://docs.rs/sep-40-oracle/) · [Reflector contract](https://github.com/reflector-network/reflector-contract) |
| Fee sponsorship + passkey UX | Launchtube + PasskeyKit | Needs a Launchtube access token (external, request early). [PasskeyKit](https://github.com/kalepail/passkey-kit) |

**NAV formula (on-chain, every mint/redeem):**
`NAV = Σ(asset_balance[i] × oracle_price[i]) / total_share_supply`, all normalized to
oracle `decimals()`. Guard: reject any leg whose `PriceData.timestamp` is older than
`max_staleness_ledgers`; pause if Reflector vs DIA diverge beyond threshold.

---

## 3. Phased plan

### Phase 1 — Stellar-native DTF (the 21-day hackathon build, → mainnet 25 Jul)

**Goal:** on mainnet, a user mints Folio shares by depositing the 5 assets in basket
ratio, sees live NAV, and redeems pro-rata. This is the "mint the DTF token against
on-chain collateral" contract you asked for.

**Stage 1.0 — Foundations (Week 1, D1)**
- Cargo workspace: `contracts/folio`, `contracts/factory`, `contracts/oracle_router`, `contracts/mocks`.
- Soroban toolchain, testnet identities, CI (`cargo test` + `soroban contract build`).
- Import OZ `stellar-contracts` + `sep-40-oracle`. Define shared types (`AssetWeight`, `Deposit`, error enum).

**Stage 1.1 — OracleRouter (Week 1, D2)**
- Wrap `PriceFeedClient::lastprice`; normalize to common decimals; staleness guard.
- Two-source median (Reflector + DIA) with a `single-source-ok` fallback flag; divergence check.
- Unit tests against a mock SEP-40 feed (the crate ships a mock).

**Stage 1.2 — Folio core (Week 1, D3–4)**
- Storage: asset list + target weights, admin, oracle_router addr, paused flag.
- `mint(deposits: Vec<(asset, amount)>)`: validate ratios ≈ weights (within tolerance),
  pull each asset via `TokenClient::transfer`, compute shares from NAV, mint shares (OZ fungible).
- `redeem(shares)`: burn shares, transfer each asset out pro-rata (checks-effects-interactions).
- `nav()` view; `pause()/unpause()`.

**Stage 1.3 — FolioFactory (Week 1, D5)**
- `create_folio(assets, weights, name, symbol)` → deploy + init a Folio; registry of instances.
- Versioned wasm hash (ADR-006).

**Stage 1.4 — Testnet end-to-end (Week 1, D6–7)** — *Jul 11 checkpoint*
- Deploy Factory + OracleRouter + Stellar Ecosystem Folio to **testnet**.
- Scripted mint → NAV → redeem round-trip against real (or mock) SAC assets.

**Stage 1.5 — Frontend + UX (Week 2, D8–12)**
- PasskeyKit onboarding (Face-ID wallet), Launchtube fee sponsorship.
- Folio page: composition donut, live NAV (5s poll via Horizon/RPC), user shares & P&L,
  mint/redeem with an asset-ratio helper.
- DIA as second oracle source; wire the divergence circuit breaker end-to-end.

**Stage 1.6 — Testnet beta (Week 2, D13–14)** — cohort users, friction notes, screenshots.

**Stage 1.7 — Mainnet + hardening (Week 3, D15–19)**
- Deploy Factory + Ecosystem Folio to **mainnet**; verify Reflector feeds on mainnet; seed small real balances.
- Failure-path drills: pause drill, staleness rejection, slippage-free redeem verification.
- Landing page + minimal docs.

**Stage 1.8 — Demo Day (Week 3, D20–21)** — dry run, deck, backup video, live judge mint on mainnet.

**Explicitly cut from Phase 1:** swaps/single-asset deposit, rebalancing, cross-chain,
BENJI, fees, governance. Roadmap slides, not code.

### Phase 2 — Cross-chain baskets (months 1–6)

- **Axelar ITS** for wETH/wBTC/wSOL (lock-and-mint → axl* tokens on Stellar). Use the
  shipped Gateway / TokenManager / GasService / InterchainTokenService — **no custom bridge**.
- **Allbridge Core** for native USDC (liquidity pools, no wrapping).
- **Single-asset deposit via Soroswap** — see §2.4 below for the verified, concrete design.
- Cross-chain Folios are a **separate, labeled** product surface (bridge risk stacks on
  contract risk); native-only Folios stay the default.
- New contract-side surface: an inbound hook the ITS TokenManager calls when wrapped tokens
  land at the Folio, which then updates the basket and mints shares to the user.

### 2.4 Single-asset deposit — verified design (2026-07-06)

**Mechanism, confirmed against the real contract source** (`soroswap/core` on GitHub — this is
a close architectural mirror of Uniswap V2, confirmed by Soroswap's own docs): the
`SoroswapRouter` is path-based, multi-hop, permissionless — anyone can add liquidity, anyone
can swap, no allowlisting. The functions we need:

```rust
// exact output, bounded input - what we want: "I need exactly deposit_i units of
// this basket asset; don't spend more than X of my input asset getting there"
fn swap_tokens_for_exact_tokens(
    e: Env, amount_out: i128, amount_in_max: i128,
    path: Vec<Address>, to: Address, deadline: u64,
) -> Result<Vec<i128>, CombinedRouterError>;

// read-only quote, for the UI's "quote" step and for sizing amount_in_max
fn router_get_amounts_in(e: Env, amount_out: i128, path: Vec<Address>) -> Result<Vec<i128>, ...>;
```

**Verified live addresses** (both confirmed reachable on-chain, 2026-07-06):

| | Testnet | Mainnet |
|---|---|---|
| Router | `CCJUD55AG6W5HAI5LRVNKAE5WDP5XGZBUDS5WNTIVDU7O264UZZE7BRD` | `CAG5LRYQ5JVEUI5TEID72EYOVX44TTUJT5BQR2J6J77FH65PCCFAJDDH` |
| Factory | `CDP3HMUH6SMS3S7NPGNDJLULCOXXEPSHY4JKUKMBNQMATHDHWXRRJTBY` | `CA4HEQTL2WPEUYKYKCDOHCDNIV4QHNJ7EL4J4NQ6VADP7SYHVRYZ7AW2` |

**Critical finding, confirmed by direct testing — do not skip this when implementing:**
`router_pair_for(token_a, token_b)` is a **deterministic address computation** (CREATE2-style,
same as Uniswap V2's `pairFor`), not an existence check. It returns an address whether or not
a real pool lives there. Proven directly: called it for `XLM`/`tstUSDC`, got back
`CAO4ISEQ5PO3TCXOTDYI3OMZVE3OKNFDJUKWQ43PR4P36XSW5KHMY5G3`, then called `get_reserves()` on
that address — **`Contract not found`**. No pool exists. This is expected and exactly mirrors
the oracle problem (Challenge 2): our basket tokens are self-issued and private, so **no
outside liquidity provider has ever touched them, on any DEX.** On mainnet this is a non-issue
— the real AQUA/EURC/USDC/XLM already have genuine Soroswap liquidity. On testnet, we would
have to seed our own pools first (permissionless — `add_liquidity` auto-creates the pair via
the factory on first call, same as Uniswap V2) purely so there's something for the code to
swap against; this is testnet-only scaffolding, never a mainnet step.

**Explicitly considered and rejected: building our own custom pool/AMM contract.** The gap
here is "nobody has added liquidity for our tokens," not "Soroswap can't handle our tokens" —
confirmed directly against the real source (`soroswap/core`): `create_pair` has **no auth
check at all** and works for any two arbitrary token addresses, no allowlist; `add_liquidity`
auto-creates the pair if missing; the LP's single signed transaction covers the whole call
tree (Soroban's native multi-invocation auth — no separate approve step, same pattern our own
`mint` already uses). A custom AMM would mean writing and auditing constant-product math, LP
accounting, and rounding/reentrancy safety ourselves — exactly the class of code most likely
to hide a subtle bug — for zero functional gain, and it would have to be **thrown away before
mainnet** (nobody trades real assets against a private pool). Seeding the real, unmodified
Router is a testnet-only scaffolding step; the mainnet code path needs no such step at all
since real AQUA/EURC/USDC/XLM liquidity already exists there.

**Seeding plan — hub-and-spoke via XLM, 4 pools:** since XLM is already one of the 5 basket
assets, pairing every other asset against it (rather than all 10 possible pairs) gives every
asset a 1-hop path to XLM and a 2-hop path to any other asset — exactly what `mint_single_asset`
needs, at minimum cost. `XLM/tstAQUA`, `XLM/tstVELO`, `XLM/tstUSDC`, `XLM/tstEURC`, each one
`add_liquidity` call sized off the live relayed prices we already have (`price-relay.ps1`) so
initial pool ratios aren't degenerate. Not yet built — a `scripts/seed-pools.ps1` companion to
`setup-testnet.ps1`, same idempotent-rerun conventions.

**Folio contract design** — new function, additive (doesn't touch existing `mint`):

```
mint_single_asset(user, deposit_token, deposit_amount, shares_out, max_deposit_amount, deadline)
  for each basket asset i (parallel to get_assets()):
    deposit_i = ceil(balance_i * shares_out / supply)          // same formula as mint()
    if asset_i == deposit_token:
      running_total += deposit_i                                // no swap - direct leg
    else:
      path = [deposit_token, asset_i]                            // or multi-hop if no direct pair
      amount_in = router.swap_tokens_for_exact_tokens(
                    amount_out: deposit_i,
                    amount_in_max: <per-leg share of max_deposit_amount>,
                    path, to: this_contract, deadline)
      running_total += amount_in
  require running_total <= max_deposit_amount                    // overall slippage guard
  pull `running_total` of deposit_token from user (only what was actually spent)
  Base::mint(user, shares_out)
```

**Design notes:**
- Pull-after-swap (not pull-then-swap) keeps the user's authorized transfer amount exact —
  they never approve more than what actually got spent, refund logic isn't needed.
- Every leg keeps its own `amount_in_max` (a per-asset slice of the user's overall bound) so
  one illiquid pair can't quietly eat the whole slippage budget meant for the others.
- Whole operation is atomic — if any leg's pool lacks liquidity or slippage exceeds its bound,
  the router call fails and the entire mint reverts. No partial baskets.
- Real risk worth flagging before building: up to 4 sequential cross-contract swap calls in
  one transaction is meaningfully more CPU/resource-heavy than the current single proportional
  mint — needs checking against Soroban's per-transaction resource limits in practice, not
  just assumed to fit.
- UI quoting mirrors the existing pattern: call `router_get_amounts_in` per leg up front (same
  role as today's `quoteMint` simulate-first flow) so the user sees the real expected total
  cost before signing.

### Phase 3 — Regulated-asset baskets (2027)

- **ReservePool** holding allowlisted BENJI; yield accrues to Folio NAV via daily dividend airdrops.
- Per-asset **transfer eligibility** enforced with the OZ AllowList extension (designed for from ADR-002 onward).
- Gated on: FT/MoonPay institutional KYC, securities-law structuring (fund-of-funds), and
  DTCC asset availability. Legal-and-partnership track, kept out of the critical code path.

---

## 4. How we work (process, so the system stays in check)

1. **One stage at a time**, in the order above. A stage isn't "done" until its checklist
   items in [`CHECKLIST.md`](./CHECKLIST.md) are ticked *and* its tests pass.
2. **After every stage**, append an entry to [`DECISION_LOG.md`](./DECISION_LOG.md):
   what we built, key decisions and *why*, anything deferred, and any interface that turned
   out different from this plan. This is the "keep the system in check" record you asked for.
3. **External dependencies** are tracked in [`EXTERNAL_DEPENDENCIES.md`](./EXTERNAL_DEPENDENCIES.md).
   Anything marked 🚧 must be resolved (or explicitly waived by you) **before** the stage that needs it.
4. **Security is not simplified away**: checks-effects-interactions on every fund movement,
   oracle staleness + divergence guards, multisig admin, minimal custom code over audited
   OZ components. Post-hackathon: SCF → SDF-sponsored audit (Audit Bank).
5. **Every non-trivial contract fn ships a test** (Soroban test env + the SEP-40 mock feed).
   Money paths get failure-case tests, not just happy-path.

---

## 5. Open questions for you (need answers before/early in Phase 1)

1. **Team size** — solo, or 2–4 builders? Determines whether frontend (Stage 1.5) runs in
   parallel with contracts or after.
2. **Testnet assets** — confirm we deploy mock SAC tokens for any of {XLM, USDC, EURC, AQUA,
   VELO} that lack a usable testnet issuer (default plan: yes, mock what's missing).
3. **Basket final composition** — PRD proposes XLM 40 / AQUA 20 / VELO 15 / USDC 15 / EURC 10.
   Confirm, or adjust to whatever Reflector actually prices (see dependency 🚧-1).
4. **Working name** — keep "Nebula DTF" or rename before mainnet deploy (token symbol is baked in).
```
