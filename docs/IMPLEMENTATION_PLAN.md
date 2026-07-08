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

**Strategic update (2026-07-08 — see Challenge 5 in `CHALLENGES_AND_DECISIONS.md`):**
cross-chain (Axelar wrapped assets) and BENJI/DTCC are both **shelved** as near-term product
goals — not because the engineering is wrong, but because both are blocked by things outside
our control (no wrapped-ETH liquidity/tokens on Stellar; BENJI/DTCC require issuer allowlisting
via partnership). **Active scope is now: native DTFs (shipped) + synthetic RWA DTFs (new,
§3.5)** — oracle-tracked stock/ETF-mimicking tokens that are ordinary permissionless SEP-41,
so they need none of the allowlisting or bridge liquidity the regulated path needs. BENJI/DTCC
remain a **future consolidation goal**: once real allowlisting partnerships exist, this same
Folio architecture already supports holding them (that was the point of ADR-002's AllowList
design) — we just don't build toward them actively today.

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

### Phase 2 — Cross-chain baskets (**shelved 2026-07-08** — see Challenge 5)

**Status: not an active product goal.** Research complete (§2.5), a real testnet mechanism
proof remains a *possible* future demo, but it is not being built toward as a shipped product —
Axelar has essentially zero wrapped-ETH assets or liquidity on Stellar (mainnet or testnet;
Challenge 4), so a real cross-chain ETH/BTC basket isn't credible today regardless of how good
our contract code is. **What stays fully in scope:** `mint_single_asset` (§2.4) itself — it's
native, chain-agnostic infrastructure already shipped and used for the XLM→basket deposit; it
simply isn't being extended to cross-chain assets right now.

Original plan, kept for reference (not being pursued):
- **Axelar ITS** for wETH/wBTC/wSOL (lock-and-mint → axl* tokens on Stellar). Use the
  shipped Gateway / TokenManager / GasService / InterchainTokenService — **no custom bridge**.
- **Allbridge Core** for native USDC (liquidity pools, no wrapping).
- Cross-chain Folios are a **separate, labeled** product surface (bridge risk stacks on
  contract risk); native-only Folios stay the default.

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

**Seeding plan — hub-and-spoke via XLM, 4 pools. Done and verified live (2026-07-06).** Since
XLM is already one of the 5 basket assets, pairing every other asset against it (rather than
all 10 possible pairs) gives every asset a 1-hop path to XLM and a 2-hop path to any other
asset — exactly what `mint_single_asset` needs, at minimum cost. Built `scripts/seed-pools.ps1`
(idempotent — skips any pair with existing reserves) and ran it against the real testnet
Router; all 4 pools (`XLM/tstAQUA`, `XLM/tstVELO`, `XLM/tstUSDC`, `XLM/tstEURC`) now hold real
reserves, each sized to ~$100/leg from the live relayed prices. Addresses in `DEPLOYMENT.md`.
Proof the gate held before building the script: manually called `add_liquidity` once for
`XLM/tstUSDC` first — it succeeded on the first attempt, and the exact deterministic pair
address that had returned `Contract not found` moments earlier now returns real reserves.
Confirms conclusively: no custom pool contract needed, exactly as reasoned above.

**Testnet dashboard, confirmed real (2026-07-06):** `https://testnet.soroswap.finance/pools` —
same nav (Swap/Pools/Earn/Bridge/Info) as the mainnet app. Verified genuinely testnet-wired
(not just named that) by pulling its JS bundle directly and finding Stellar's real testnet
passphrase (`Test SDF Network ; September 2015`) embedded in the compiled code. Our 4 pools
should now be visible there.

**✅ Built and verified live (2026-07-08).** `mint_single_asset` shipped in Folio v2, tested
end-to-end on testnet (deposit 20 XLM → 4 real Soroswap swaps → 3.86 SEF minted, one atomic
tx). The final design differs from the sketch below in two ways learned from implementation
(see DECISION_LOG ADR-016): (1) **exact-input** swaps, not exact-output — so the Folio can
`authorize_as_current_contract` the precise amount it spends (a contract's own funds moved by
a downstream contract *must* be explicitly authorized; a unit test caught this); (2) shares
are minted from the folio's **actual post-swap value gain**, so the depositor bears their own
slippage and existing holders are never diluted. The original sketch is kept below for the
reasoning trail.

**Folio contract design** (original sketch — superseded by ADR-016, kept for history):

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

### 2.5 Cross-chain DTFs via Axelar ITS — research (2026-07-08), **shelved as a product goal**

> **This section is kept as a reference design, not an active roadmap item.** The research below
> (interfaces, mechanism, phasing) is real and correct — the blocker isn't the plan, it's that
> Axelar has no wrapped-ETH/BTC assets or liquidity on Stellar today (Challenge 4/5). Revisit if
> that changes; until then, effort goes to native + synthetic RWA DTFs (§3.5) instead.

**Goal:** let a Folio hold assets that originate on other chains (wETH/wBTC/wSOL), which arrive
on Stellar as Axelar-wrapped tokens (`axlETH` etc.), and let a user on an EVM chain go from
"I have ETH" to "I hold SEF shares on Stellar." The Folio share token always lives on Stellar
(§5.3 of the PRD).

#### Verified interfaces & facts (checked against Axelar's Soroban repos, not assumed)

- **Stellar ITS runs in "Hub mode"** — every cross-chain message routes through the ITS Hub on
  the Axelar network, never chain-to-chain directly. ([Stellar ITS docs](https://docs.axelar.dev/dev/send-tokens/stellar/intro/))
- **Sending a token + message (source → Stellar):** on the source chain, call ITS
  `callContractWithInterchainToken(tokenId, destChain, destAddress, amount, data, gas)` (the
  token-only variant is `interchainTransfer`). ([ITS executable](https://docs.axelar.dev/dev/send-tokens/interchain-tokens/interchain-token-executable/))
- **Receiving on Soroban — the key primitive.** A destination contract implements the ITS
  executable trait; when the wrapped token lands, ITS transfers it to the contract and calls:
  ```rust
  fn __authorized_execute_with_token(
      env: &Env, source_chain: String, message_id: String, source_address: Bytes,
      payload: Bytes, token_id: BytesN<32>, token_address: Address, amount: i128,
  ) -> Result<(), Self::Error>;
  ```
  The caller is **pre-verified as the ITS contract** before this runs — we don't hand-roll
  source validation (that removal is exactly what caused the Secret Network $4.67M drain; PRD §5.1).
- **Plain GMP primitives** (for the return path / non-token messages): Gateway `call_contract`,
  GasService `pay_gas`, and the executable `execute(source_chain, message_id, source_address, payload)`.
- **Testnet ITS address:** `CCXT3EAQ7GPQTJWENU62SIFBQ3D4JMNQSB77KRPTGBJ7ZWBYESZQBZRK` (from
  Axelar's `stellar-its-example`). Gateway / GasService / per-token TokenManager addresses:
  confirm from `axelarnetwork/axelar-contract-deployments` at build time — **do not hardcode
  from memory** (they get redeployed).

#### The one hard problem, named up front: destination-execution failure

When `__authorized_execute_with_token` runs, the wrapped tokens are **already minted to our
contract**. If our "swap into the basket and mint shares" logic then reverts (illiquid axl*
pool, slippage, paused), Axelar can retry the message but the tokens don't un-mint. A naive
atomic design risks either a stuck message or tokens trapped. This is *the* design driver.

**Decision — decouple bridging from minting for the first version (ADR-017, to be recorded):**
- **v1 (robust, boring):** the user bridges the raw token to **their own Stellar address** via
  plain `interchainTransfer` (no executable callback, no custom code on our side at all). Once
  it lands, they call the existing `mint_single_asset` (§2.4) on Stellar — which already
  swaps one asset into the whole basket and mints. Bridge failure and mint failure are now
  *independent*: a failed mint just leaves the user holding axlETH in their own wallet, which
  they can retry or withdraw. Zero stuck-funds risk, and it reuses code that's already live.
- **v2 (one-click, later):** implement `__authorized_execute_with_token` on a `CrossChainFolio`
  so the whole "ETH on Ethereum → SEF on Stellar" flow is one action. Only build this after
  designing the failure path: on inner failure, credit the recipient a claim on the raw
  `token_address`/`amount` (store it, expose a `claim()`), so the executable call still
  succeeds (tokens delivered to a claim ledger) and never traps. Never let the executable
  revert after tokens are in hand.

#### Contract-side work

- **New `CrossChainFolio`** (separate contract, ADR-002/006 style), or the existing Folio with
  the axl* tokens as basket assets — but **segregated from native Folios in the UI**, explicitly
  risk-labeled (PRD §5.4: axlETH is only as sound as Axelar's Ethereum escrow).
- v1 needs **no new Folio code** — it's `mint_single_asset` with an axl* deposit token, plus a
  seeded `axlETH/XLM` (etc.) Soroswap pool so the swap legs have liquidity. (Same seeding move
  as §2.4; note wrapped-asset DEX depth on Stellar is even thinner — start with one wrapped
  asset + XLM, small.)
- v2 adds the executable trait impl + a claim ledger for failed inner execution.
- **Return path (redeem cross-chain):** `redeem` on Stellar gives the user axl* tokens; a thin
  helper (or the user directly) calls ITS `interchainTransfer` back to the source chain, where
  Axelar burns the wrapped token and releases native ETH. Outbound is inherently multi-tx and
  needs source-chain gas — fine, documented, not magical.

#### Phasing

- **2a — inbound, decoupled:** bridge axlETH to user's Stellar wallet → existing
  `mint_single_asset`. Seed the axlETH/XLM pool. Frontend flow that chains the two steps with
  clear status. *Testable end-to-end on testnet.*
- **2b — outbound redeem:** redeem → `interchainTransfer` back to Sepolia.
- **2c — Allbridge Core** for *native* USDC (liquidity-pool model, no wrapping — real Circle
  USDC arrives, relayer auto-creates trustlines). Separate integration, simpler risk story.
- **2d — v2 one-click** (`__authorized_execute_with_token` + claim ledger) once 2a is proven.

#### External dependencies (flag before coding — heavier than Phase 1)

- An **EVM testnet** (Sepolia) with test ETH, plus the source-chain ITS deployment.
- **Axelar testnet GMP** actually relaying (validator attestation) — an external service we
  don't control; testing latency is minutes, not the ~5s we're used to on Stellar.
- **Gas on both sides** (source-chain gas via GasService, Stellar fees).
- Confirmed current Axelar Stellar-testnet addresses (Gateway/GasService/ITS) from the
  deployments repo.
- axl* token must be **registered/linked in ITS** for the route to exist (per-token TokenManager).

#### Risks (carried from PRD §5, now with the concrete mechanism)

- **Bridge risk stacking** — segregated, labeled, opt-in; audited Axelar infra used unmodified.
- **Wrapped-asset liquidity on Stellar** — thinnest yet; single-asset mint routes through it,
  so slippage bounds (`min_shares_out`) matter more. Start tiny.
- **Destination-execution failure** — addressed by the decoupled v1 and the claim-ledger v2 above.
- **Relayer/liveness** — a stuck message is retryable but not instant; UX must show "bridging…"
  honestly rather than imply Stellar-speed finality.

### Phase 3 — RWA baskets: synthetic now, regulated later (re-scoped 2026-07-08)

**3.5 Synthetic RWA DTFs — new active goal.** Stellar is getting RWA-heavy (BENJI, incoming
DTCC assets) but those specific tokens are allowlist-gated (Challenge 5) — the *category* is
right, the *specific tokens* aren't usable yet. The workaround: **oracle-tracked synthetic
tokens** that mimic real-world stock/ETF prices (e.g. a synthetic "TSLA" or "AMZN" token,
collateral-backed, minted/burned against an oracle price by a vault contract) are, once minted,
**ordinary permissionless SEP-41 tokens** — no allowlist, no issuer partnership, holdable and
swappable exactly like AQUA or XLM. This is the same category ambition (RWA exposure on
Stellar) achieved through a token design that doesn't hit the allowlist wall.

- Basket design: same Folio primitive, holding a mix of synthetic RWA tokens (e.g. a "Mag 7
  mimic" basket) — `mint`/`redeem`/`mint_single_asset` all already work unmodified, since they
  only require SEP-41 compliance, not any particular token's provenance.
- **External dependency, not yet resolved:** the actual synthetic tokens don't exist yet in our
  system. A contact (outside this codebase) is reportedly building oracle-tracked RWA synthetics
  on Stellar — if/when that ships (or we build our own minimal version), confirm: (a) genuinely
  transferable SEP-41, not just an internal vault position (see the "can you `transfer()` this"
  question already raised); (b) which oracle prices it (Reflector confirmed Stellar-compatible;
  **Pyth does not support Stellar/Soroban** — rule that out explicitly if mentioned); (c) testnet
  availability for us to build/test against, same as every other asset in this project.
- Collateral/solvency risk here belongs to whoever runs the synthetic's vault, not to the DTF —
  same separation of concerns as any other basket asset.

**Regulated RWA (BENJI/DTCC) — future consolidation goal, not active build:**
- **ReservePool** holding allowlisted BENJI; yield accrues to Folio NAV via daily dividend airdrops.
- Per-asset **transfer eligibility** already designed for via the OZ AllowList extension (ADR-002) —
  the architecture doesn't need new work to support this later, it was built with this in mind.
- Gated on: FT/DTCC allowlisting our contract address (a partnership, not an engineering task),
  securities-law structuring (fund-of-funds), and DTCC asset availability (H1 2027 per their
  timeline). **Aspiration:** once that partnership exists, become the DTF/portfolio layer that
  BENJI/DTCC-tokenized assets settle into — but this runs on their timeline, not ours, and stays
  out of the active build until an actual allowlisting conversation starts.

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
