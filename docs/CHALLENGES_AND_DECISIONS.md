# Nebula DTF — Challenges & Decisions Log

Real difficulties hit during development, the reasoning behind how we resolved (or deliberately
deferred) each one, and what would change the calculus later. Distinct from
[`DECISION_LOG.md`](./DECISION_LOG.md), which is the per-stage build record — this is the
"why was this actually hard" log. Append new entries at the bottom; don't rewrite old ones,
add a follow-up entry instead so the history of *how our thinking changed* stays visible.

---

## Challenge 1 — Dutch-auction rebalancing (Reserve's model) doesn't transfer to Stellar today

**The problem:** Reserve Protocol (Ethereum) keeps its Index DTFs at target weights using
Dutch auctions: a manager proposes new targets + price brackets, an auction opens per
over/underweight asset pair, price decays exponentially from high to low, and outside
solvers (CoW Swap, DEX arbitrageurs) race to fill it at a fair clearing price.

**Why it doesn't just port over:** the mechanism's soundness depends entirely on there being
enough competing, liquid solvers watching the auction to fill it near fair value. Ethereum
has that. Stellar, today, does not — DEX depth across SDEX + Aquarius + Soroswap + Phoenix is
roughly $60-100M *combined*, thin enough that a Dutch auction for a basket this small could:
- clear at a bad price (basket loses value to slippage/MEV), or
- fail to clear at all within its time window.

Both outcomes are worse than doing nothing. A broken auction is a **silent** value leak;
static weights that drift are visible and honest (the app shows current vs. target holdings).

**Decision:** Phase 1 ships static target weights with proportional mint/redeem and **no
rebalancing at all** (ADR-004 in DECISION_LOG). This is a genuine capability gap, not laziness
— the PRD's own PMF scorecard rated Stellar DEX liquidity for rebalancing 3/10 going in.

**What would change this:** a real Dutch-auction system needs deep, competitive liquidity
first. Two paths forward, neither built yet:
1. **Full Reserve-style auction market** — only worth building once Stellar DEX depth
   (post-DTCC-asset-wave, per the PRD's Phase 3 thesis) can plausibly support it.
2. **A much lighter middle option**: a single admin-triggered, slippage-bounded Soroswap swap
   call — no auction, no solver market, just a manually-invoked rebalance with a hard
   `min_out` floor. Buildable now if we want *some* rebalancing before mainnet without
   betting on a market that doesn't exist yet. Not started; a real design/build decision,
   not a default.

**Status:** open. Revisit before Phase 2 (cross-chain) work begins, or sooner if requested.

---

## Challenge 2 — Self-issued test tokens can't be priced by any oracle, real or fake

**The problem:** we self-issued `TAQUA`/`TVELO`/`TUSDC`/`TEURC` from a throwaway testnet
issuer account (ADR-012) so we didn't have to hunt down real testnet asset issuers. But no
oracle — Reflector, DIA, or anything else — can price an asset that has zero trading history
anywhere. These are structurally different Stellar assets from the real AQUA/EURC/USDC (same
code, different issuer -> different SAC contract), so Reflector's real, live testnet price
feed for the *real* AQUA is simply a different asset than our `TAQUA`. This forced the
MockPriceFeed contract into the loop for every asset, even ones Reflector genuinely covers.

**Correction in progress (per 2026-07 discussion):** confirmed Reflector's `Asset` enum
(`Stellar(Address) | Other(Symbol)`) matches our own `OracleAsset` type exactly, and
Reflector's testnet "Pulse" oracle is confirmed live and free (5-min updates, no invocation
fee, no stated rate limit) for at least AQUA and EURC (screenshot-verified 2026-07-05). The
OracleRouter's `FeedSpec` already decouples "our token address" from "the asset identifier we
ask the feed for" specifically so a self-issued token's price can be sourced from a real
asset's real feed — no contract change needed, only a deployment/config change (point the
`FeedSpec.asset` at whatever identifier Reflector's Pulse oracle uses for real AQUA/EURC,
instead of at our own mock feed).

**Resolved (2026-07-05, verified on-chain):** Reflector's `Stellar(Address)` variant for a
classic asset takes the **mainnet-computed SAC address** as the identifier, regardless of
which network the oracle contract itself is deployed on — confirmed two ways: (1) one of the
testnet "Stellar Pubnet Pulse Oracle"'s 9 tracked addresses resolved live on **mainnet** as
`"SolvBTC"`, an exact match to Reflector's dashboard; (2) directly tested `lastprice()` on the
old testnet oracle (`CAVLP5DH2G...D6HLP`) with the *real, independently-verified* mainnet EURC
SAC address (`CDTKPWPLOURQA2SGTKTUQOWRCBZEORB4BWBOMJ3D3ZTQQSGE5F6JBQLV`, confirmed via
stellar.expert) and with the real testnet-issued Circle EURC address
(`CCUUDM434BMZMYWYDITHFXHDMIVTGGD6T2I5UKNX5BSLXLW7HVR4MCGZ`) — **both returned `null`.** That
specific testnet oracle instance's `assets()` list is a fixed 9 addresses that don't include
EURC/AQUA/USDC in any form; it's stale or scoped much narrower than the live dashboard shows.

**Superseding realization (2026-07-06):** chasing a "live testnet Reflector oracle" was
solving the wrong problem. **Soroban contracts can only call other contracts on the same
network** — a testnet contract can never invoke a mainnet contract on-chain, full stop, no
config option changes that. So even a perfectly-live testnet Reflector deployment would only
ever be *coincidentally* useful if it happened to mirror the exact assets we need — there's no
way to make a testnet contract read mainnet Reflector directly.

**Final resolution — off-chain price relay:** an off-chain script reads real prices from
**mainnet** Reflector's public "Stellar Pubnet Pulse Oracle"
(`CALI2BYU2JE6WVRUFYTS6MSBNEHGJ35P4AVCZYF3B6QOE3QKOB2PLE6M`, confirmed free, no invocation fee,
5-min updates) via a plain read-only CLI call, then writes those real numbers into our own
testnet `MockPriceFeed` contract (`scripts/price-relay.ps1` + `refresh-prices.ps1`). Verified
live 2026-07-06 with real mainnet prices: XLM $0.1951, AQUA $0.00037933, EURC $1.1413. USDC is
this oracle's own base/numeraire asset (confirmed via `base()` — no separate lastprice entry
needed, it's $1.00 by definition). **VELO has no Reflector coverage under either known mainnet
issuer** (`GDM4RQ...M2M5M` and `GC5ZBB...J2VELO`, both tested live, both `null`) — it remains a
clearly-labeled simulated placeholder (flagged in the app UI, `TOKEN_INFO.simulated`).

**Decision:** self-issued tokens renamed `tstAQUA`/`tstVELO`/`tstUSDC`/`tstEURC` (supersedes
ADR-012's `T`-prefix). Dropped the second DIA-stand-in feed per the earlier decision above —
single real relayed feed per token. Zero contract changes were needed anywhere — the
`OracleRouter`'s token/asset decoupling and the `MockPriceFeed`'s settable-price design already
supported this exactly as built.

**Status:** resolved and deployed. Fresh testnet stack live 2026-07-06 (see DECISION_LOG build
entry) with real relayed prices; bootstrap succeeded at $99.9999999795 (~$100 target) using
deposit amounts computed dynamically from the live prices rather than hardcoded guesses.

---

## Challenge 3 — Two-oracle median/divergence design had no second real source available

**The problem:** the PRD called for Reflector + DIA median with a divergence circuit
breaker, for defense against one provider failing/being manipulated. DIA does have a real
Soroban testnet deployment, but per DIA's own docs its testnet asset list is narrow and
custom-configured on request — coverage of AQUA/VELO/EURC/XLM specifically was never
confirmed. We shipped a DIA-*shaped* MockPriceFeed as a stand-in so the router's median +
divergence-breaker logic could be built and tested end-to-end, without actually depending on
unverified third-party coverage.

**Decision (2026-07):** drop DIA as a live second source for now — Reflector alone already
covers multiple real assets for free, and adding an unverified/possibly-uncovered second
provider was solving a problem we don't have yet. The router's 1-or-2-feed design
(median/divergence code) stays as-is since it already supports single-feed mode with zero
code changes — this is a *deployment* decision (wire one feed per token instead of two), not
a rewrite. Revisit adding a genuine second source later if/when it's actually needed for
mainnet risk management.

**Status:** resolved for Phase 1 — single real Reflector feed per token, no mock second source.

---

## Idea (tracked, deliberately out of scope) — intent-based cross-chain + CEX liquidity routing

**The idea (raised 2026-07):** instead of only aggregating Stellar-native DEX liquidity, build
a pipeline that, given a user's desired token, searches *all* DEXs, CEXs, and other chains for
the best route to source it, executes the acquisition, and delivers the token to the user.

**Why this is a separate project, not a Nebula DTF milestone:** this is a real, established
category — "intent-based liquidity routing" / solver networks (real examples: 1inch Fusion+,
CoW Protocol, Across Protocol, Li.Fi, Socket/Bungee, deBridge, UniswapX). Two things make it
structurally different from everything else in this codebase:
1. **Capital requirement** — solvers front liquidity and get reimbursed cross-chain after the
   fact; this needs real market-making capital and infrastructure, not just contract code.
2. **CEX integration** — requires KYC'd institutional exchange accounts and custody of user
   funds mid-route, i.e. a centralized, regulated component. This is fundamentally not a
   permissionless smart-contract feature.

Both are "found a company" scope, not "add a feature to the Folio" scope.

**What we're actually building instead:** the Phase 2 Soroswap-powered single-asset deposit
(deposit USDC -> contract routes across Aquarius + Phoenix + Soroswap AMM + SDEX -> acquires
the basket) is the right-sized version of this idea — DEX-only, Stellar-only, no custody, no
KYC. That was already in the PRD before this idea came up and remains the plan.

**Status:** intentionally not pursued as part of Nebula DTF. Revisit as an entirely separate
initiative if there's appetite for the capital/compliance lift it requires.

---

## Challenge 4 — The wrapped Ethereum assets the cross-chain thesis needs don't exist on Stellar yet

**The problem:** the whole cross-chain goal ("hold Ethereum assets as a DTF on Stellar") assumes
wrapped assets like `axlETH`/`axlWBTC` are available on Stellar. Checked Axelar's own deployment
config (`axelar-contract-deployments`, 2026-07-08) — they are **not**:
- **Stellar testnet** (`stellar-2026-q1-2`): the *only* ITS-registered token is `AXE` (an internal
  load-test token). No wrapped ETH/BTC of any kind; `AXE` has no Soroswap pool.
- **Stellar mainnet**: only `HBT` and `AXE` registered via ITS. Still zero wrapped ETH/BTC.
- Soroswap mainnet total TVL ≈ $1.2M across *all* pools — even if wrapped ETH existed, no depth.

The Axelar infra itself is live on Stellar testnet (ITS `CC7LAC4S7KAPIM26WKWFSOXWLNLSG7EXTC2EVY2H2UPKSTX3Z2A7M5YP`,
Gateway `CB2JYOOZPHO43R57TC5PXV22QICKIDC5NKRF62BZG2J6JYFUIQPIAYY3`, GasService
`CCLZOCGHHC6F6JCZHEUP53LDQHRBPPCNRYXOVFZFS3O63OGRC47CKCGV`) — the *rails* work, the *cargo* isn't there.

**Why it matters:** this is the tstAQUA situation one layer up — the assets our thesis depends on
have no Stellar presence, so (as with the native basket) a testnet demo requires us to create our
own stand-in, this time by deploying a real interchain token through Axelar's actual ITS.

**Decision (Model A vs Model B, per the liquidity question):**
- **Model A — bridge a real-ITS token, deposit proportionally (no pool/liquidity needed).** The
  honest core path. Works on testnet once we deploy our own ITS token; the realistic mainnet path
  whenever wrapped ETH eventually lands on Stellar. Zero dependence on Stellar DEX liquidity.
- **Model B — deposit XLM, auto-swap via Soroswap (needs a pool).** Achievable *on testnet* only
  because we seed our own pool (same move as the tst tokens + `mint_single_asset`, already proven).
  **Not** mainnet-credible for ETH assets today (no tokens, ~$1.2M total DEX depth).
- **Chosen:** build Model A as the truthful core; offer Model B on testnet as a "frictionless once
  liquidity exists" demo, explicitly labeled as depending on seeded liquidity. Do not imply mainnet
  ETH-basket liquidity that doesn't exist.

**Status:** research complete, direction chosen; cross-chain build not yet started (plan in
IMPLEMENTATION_PLAN.md §2.5, to be updated to lead with Model A).

---

## Challenge 5 — Strategic pivot: both cross-chain and regulated-RWA paths hit the same wall

**The pattern, once named, applies to both Phase 2 and Phase 3:** every path we researched for
"hold assets that aren't native to Stellar" ends at either (a) no real liquidity, or (b) an
allowlist we don't control:

- **Cross-chain (Axelar wrapped ETH/BTC):** Challenge 4 found essentially zero wrapped-ETH
  tokens or liquidity on Stellar, mainnet *or* testnet. Not a contract-design problem — the
  assets and markets simply aren't there yet.
- **Regulated RWA (BENJI/DTCC):** both are SEP-41 tokens with `AUTH_REQUIRED` — the issuer must
  explicitly `set_authorized` our contract's address before it can hold either. That's a
  partnership/legal relationship (FT's transfer agent, DTCC's compliance process), not something
  achievable by writing better Soroban code. DTCC's own assets aren't even live yet (targeted
  H1 2027).

**Decision (2026-07-08):** shelve both as active product goals. **Active scope narrows to:**
1. **Native DTFs** (shipped — XLM/AQUA/VELO/USDC/EURC basket, proportional + single-asset mint).
2. **Synthetic RWA DTFs** (new) — oracle-tracked tokens that mimic real-world stock/ETF prices
   (e.g. a synthetic TSLA/AMZN), which are *ordinary permissionless SEP-41 tokens* once minted —
   no allowlist, no bridge, no partnership needed to hold or swap them. Achieves the same
   "RWA exposure on Stellar" ambition through a token design that never hits the allowlist wall.
   A contact outside this codebase is reportedly building exactly this; needs confirmation it's
   genuinely transferable (not just an internal vault position) and which oracle it uses before
   we build against it (Pyth is confirmed **not** available on Stellar/Soroban — rule it out if
   mentioned).

**Kept as an explicit future goal, not shelved permanently:** once FT/DTCC-style allowlisting
partnerships become real, this same Folio architecture already supports holding those assets —
the OZ AllowList extension was designed in from ADR-002 specifically for this. The aspiration
(consolidate with BENJI/DTCC and become their on-chain DTF/portfolio layer) stays on the roadmap
as a Phase-3-later goal; it's just not what we build toward today.

**Why this is the right call, not giving up:** all three blockers (Axelar liquidity, FT
allowlisting, DTCC timeline) are things **no amount of our own engineering effort moves**.
Continuing to build contract logic against them would be solving the wrong problem. Synthetic
RWA tokens convert "wait for a partnership" into "build with tokens that don't need one" —
same category ambition, achievable now.

**Status:** direction decided; synthetic-RWA-token availability is the open next question
(external, not yet resourced — see IMPLEMENTATION_PLAN.md §3.5).
