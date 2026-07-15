//! Folio — one on-chain basket (DTF) and its SEP-41 share token.
//!
//! Custodies N Stellar assets (via SAC), mints shares against deposits and
//! redeems them pro-rata. The share token is OpenZeppelin's audited fungible
//! `Base`, embedded in this contract (ADR-001, ADR-002).
//!
//! Money-path design (ADR-011): after bootstrap, mint/redeem are *purely
//! proportional to current balances* — `deposit_i = ceil(bal_i * shares /
//! supply)` — so the oracle is NOT in the recurring money path. The oracle
//! prices only the bootstrap ratio check and the `nav()` view. Rounding always
//! favors the folio (ceil in, floor out) so dust cannot be extracted.
//!
//! Pause semantics (ADR-007): pause blocks minting only. Redemption is never
//! pausable — user funds are never hostage.

#![no_std]

use nebula_interfaces::{OracleRouterClient, SoroswapRouterClient, PRICE_DECIMALS};
use soroban_sdk::auth::{ContractContext, InvokerContractAuthEntry, SubContractInvocation};
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, symbol_short, token,
    vec, Address, Env, IntoVal, MuxedAddress, String, Symbol, Val, Vec,
};
use stellar_tokens::fungible::{burnable::FungibleBurnable, Base, FungibleToken};

const BPS: i128 = 10_000;
/// Max deviation of each bootstrap deposit's value share from its target
/// weight. 1% — tight enough to keep the basket honest, loose enough for
/// price motion between simulation and submission.
const BOOTSTRAP_TOLERANCE_BPS: i128 = 100;
/// Share token decimals (Stellar convention).
const SHARE_DECIMALS: u32 = 7;
/// Bootstrap must mint at least 1.0 share (≈ $1) — keeps ratios meaningful
/// and rules out dust-sized first deposits.
const MIN_BOOTSTRAP_SHARES: i128 = 10_000_000;
const MAX_ASSETS: u32 = 10;

// ~1 day / ~30 days at 5s ledgers.
const TTL_THRESHOLD: u32 = 17_280;
const TTL_EXTEND: u32 = 518_400;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum FolioError {
    BadConfig = 1,
    Paused = 2,
    NotBootstrapped = 3,
    AlreadyBootstrapped = 4,
    RatioOutOfTolerance = 5,
    SlippageExceeded = 6,
    AmountTooSmall = 7,
    LengthMismatch = 8,
    Overflow = 9,
    SoroswapNotConfigured = 10,
    DeadlinePassed = 11,
}

/// One basket constituent.
#[contracttype]
#[derive(Clone)]
pub struct AssetInfo {
    pub token: Address,
    /// Target weight in basis points; all weights sum to 10_000.
    pub weight_bps: u32,
    /// Token decimals, cached at construction.
    pub decimals: u32,
}

/// `nav()` result, both values at `PRICE_DECIMALS`.
#[contracttype]
#[derive(Clone)]
pub struct NavInfo {
    /// Total USD value of the basket.
    pub total_value: i128,
    /// USD value of one whole share (0 before bootstrap).
    pub per_share: i128,
}

#[contracttype]
enum DataKey {
    Admin,
    Router,
    Assets,
    Paused,
    SoroswapRouter,
}

#[contract]
pub struct NebulaFolio;

#[contractimpl]
impl NebulaFolio {
    /// `tokens` and `weights_bps` are parallel arrays; weights sum to 10_000.
    pub fn __constructor(
        e: Env,
        admin: Address,
        router: Address,
        name: String,
        symbol: String,
        tokens: Vec<Address>,
        weights_bps: Vec<u32>,
    ) {
        let n = tokens.len();
        if n < 2 || n > MAX_ASSETS || weights_bps.len() != n {
            panic_with_error!(&e, FolioError::BadConfig);
        }
        let mut sum: u32 = 0;
        let mut assets: Vec<AssetInfo> = Vec::new(&e);
        for i in 0..n {
            let t = tokens.get_unchecked(i);
            let w = weights_bps.get_unchecked(i);
            if w == 0 {
                panic_with_error!(&e, FolioError::BadConfig);
            }
            // reject duplicate tokens
            for j in 0..i {
                if tokens.get_unchecked(j) == t {
                    panic_with_error!(&e, FolioError::BadConfig);
                }
            }
            sum += w;
            let decimals = token::TokenClient::new(&e, &t).decimals();
            assets.push_back(AssetInfo { token: t, weight_bps: w, decimals });
        }
        if sum != 10_000 {
            panic_with_error!(&e, FolioError::BadConfig);
        }

        Base::set_metadata(&e, SHARE_DECIMALS, name, symbol);
        e.storage().instance().set(&DataKey::Admin, &admin);
        e.storage().instance().set(&DataKey::Router, &router);
        e.storage().instance().set(&DataKey::Assets, &assets);
        e.storage().instance().set(&DataKey::Paused, &false);
    }

    /// First mint: caller supplies explicit `deposits` (parallel to
    /// `get_assets()`); each deposit's oracle value must sit within
    /// `BOOTSTRAP_TOLERANCE_BPS` of its target weight. Shares minted at
    /// $1.00 per share. Returns shares minted.
    pub fn init_mint(e: Env, user: Address, deposits: Vec<i128>) -> i128 {
        user.require_auth();
        Self::require_not_paused(&e);
        extend_ttl(&e);
        if Base::total_supply(&e) != 0 {
            panic_with_error!(&e, FolioError::AlreadyBootstrapped);
        }

        let assets = Self::get_assets(e.clone());
        if deposits.len() != assets.len() {
            panic_with_error!(&e, FolioError::LengthMismatch);
        }

        let router = OracleRouterClient::new(&e, &Self::router(e.clone()));
        // value_i = deposit_i * price_i / 10^decimals_i  (at PRICE_DECIMALS)
        let mut values: Vec<i128> = Vec::new(&e);
        let mut total: i128 = 0;
        for i in 0..assets.len() {
            let a = assets.get_unchecked(i);
            let d = deposits.get_unchecked(i);
            if d <= 0 {
                panic_with_error!(&e, FolioError::AmountTooSmall);
            }
            let price = router.price(&a.token).price;
            let v = muldiv_floor(&e, d, price, 10i128.pow(a.decimals));
            values.push_back(v);
            total = total
                .checked_add(v)
                .unwrap_or_else(|| panic_with_error!(&e, FolioError::Overflow));
        }

        // each asset's value share must match its target weight
        for i in 0..assets.len() {
            let a = assets.get_unchecked(i);
            let share_bps = muldiv_floor(&e, values.get_unchecked(i), BPS, total);
            let diff = (share_bps - a.weight_bps as i128).abs();
            if diff > BOOTSTRAP_TOLERANCE_BPS {
                panic_with_error!(&e, FolioError::RatioOutOfTolerance);
            }
        }

        // 1 share (10^7) per $1 (10^14) of deposit value
        let shares = total / 10i128.pow(PRICE_DECIMALS - SHARE_DECIMALS);
        if shares < MIN_BOOTSTRAP_SHARES {
            panic_with_error!(&e, FolioError::AmountTooSmall);
        }

        for i in 0..assets.len() {
            let a = assets.get_unchecked(i);
            token::TokenClient::new(&e, &a.token).transfer(
                &user,
                &e.current_contract_address(),
                &deposits.get_unchecked(i),
            );
        }
        Base::mint(&e, &user, shares);

        e.events()
            .publish((symbol_short!("init_mint"), &user), (shares, deposits));
        shares
    }

    /// Mint exactly `shares_out` shares by depositing the current basket
    /// pro-rata: `deposit_i = ceil(bal_i * shares_out / supply)`. Oracle-free.
    /// `max_deposits` bounds each leg (protects against balance shifts between
    /// simulation and submission). Returns the actual deposits taken.
    pub fn mint(e: Env, user: Address, shares_out: i128, max_deposits: Vec<i128>) -> Vec<i128> {
        user.require_auth();
        Self::require_not_paused(&e);
        extend_ttl(&e);
        if shares_out <= 0 {
            panic_with_error!(&e, FolioError::AmountTooSmall);
        }
        let supply = Base::total_supply(&e);
        if supply == 0 {
            panic_with_error!(&e, FolioError::NotBootstrapped);
        }
        let assets = Self::get_assets(e.clone());
        if max_deposits.len() != assets.len() {
            panic_with_error!(&e, FolioError::LengthMismatch);
        }

        let this = e.current_contract_address();
        let mut deposits: Vec<i128> = Vec::new(&e);
        for i in 0..assets.len() {
            let a = assets.get_unchecked(i);
            let client = token::TokenClient::new(&e, &a.token);
            let bal = client.balance(&this);
            let req = muldiv_ceil(&e, bal, shares_out, supply);
            if req > max_deposits.get_unchecked(i) {
                panic_with_error!(&e, FolioError::SlippageExceeded);
            }
            deposits.push_back(req);
            client.transfer(&user, &this, &req);
        }
        Base::mint(&e, &user, shares_out);

        e.events()
            .publish((symbol_short!("mint"), &user), (shares_out, deposits.clone()));
        deposits
    }

    /// Mint shares by depositing a single asset (e.g. XLM) instead of the
    /// whole basket. The deposit is split across the basket by each asset's
    /// current value fraction, and every non-deposit slice is swapped into
    /// that asset via the real Soroswap Router (see IMPLEMENTATION_PLAN.md
    /// §2.4; `soroswap_router` must be configured via `set_soroswap_router`).
    ///
    /// Fairness (bears its own slippage, never dilutes holders): shares are
    /// minted from the folio's *actual* USD value gain after the swaps —
    /// `shares_out = value_added * supply / value_before` — so NAV/share is
    /// preserved exactly and any AMM slippage/fees reduce only the depositor's
    /// own shares. `min_shares_out` bounds price movement between quote and
    /// submission. The whole call is atomic: any leg's swap failing (illiquid
    /// pool, `min_out`, expired deadline) reverts everything — no partial mint.
    ///
    /// Exact-*input* swaps (not exact-output): the folio spends exactly the
    /// pre-computed slice per leg, letting it pre-authorize that exact
    /// transfer (a downstream contract spending the folio's own funds needs
    /// `authorize_as_current_contract`, and auth entries must match args
    /// exactly). Prices are read once — the oracle is static within a tx.
    pub fn mint_single_asset(
        e: Env,
        user: Address,
        deposit_token: Address,
        deposit_amount: i128,
        min_shares_out: i128,
        deadline: u64,
    ) -> i128 {
        user.require_auth();
        Self::require_not_paused(&e);
        extend_ttl(&e);
        if deposit_amount <= 0 {
            panic_with_error!(&e, FolioError::AmountTooSmall);
        }
        if e.ledger().timestamp() > deadline {
            panic_with_error!(&e, FolioError::DeadlinePassed);
        }
        let supply = Base::total_supply(&e);
        if supply == 0 {
            panic_with_error!(&e, FolioError::NotBootstrapped);
        }

        let soroswap = SoroswapRouterClient::new(&e, &Self::soroswap_router(e.clone()));
        let oracle = OracleRouterClient::new(&e, &Self::router(e.clone()));
        let assets = Self::get_assets(e.clone());
        let this = e.current_contract_address();

        // price the whole basket once; cache prices + per-asset value
        let mut prices: Vec<i128> = Vec::new(&e);
        let mut values: Vec<i128> = Vec::new(&e);
        let mut value_before: i128 = 0;
        for i in 0..assets.len() {
            let a = assets.get_unchecked(i);
            let price = oracle.price(&a.token).price;
            let bal = token::TokenClient::new(&e, &a.token).balance(&this);
            let v = muldiv_floor(&e, bal, price, 10i128.pow(a.decimals));
            prices.push_back(price);
            values.push_back(v);
            value_before = value_before
                .checked_add(v)
                .unwrap_or_else(|| panic_with_error!(&e, FolioError::Overflow));
        }
        if value_before <= 0 {
            panic_with_error!(&e, FolioError::Overflow);
        }

        // pull the whole deposit up front so the folio can spend it on swaps
        token::TokenClient::new(&e, &deposit_token).transfer(&user, &this, &deposit_amount);

        // split by value fraction; swap each non-deposit leg (the deposit
        // token's own slice simply stays in the folio)
        for i in 0..assets.len() {
            let a = assets.get_unchecked(i);
            if a.token == deposit_token {
                continue;
            }
            let alloc = muldiv_floor(&e, deposit_amount, values.get_unchecked(i), value_before);
            if alloc <= 0 {
                continue;
            }
            let path = vec![&e, deposit_token.clone(), a.token.clone()];
            let pair = soroswap.router_pair_for(&deposit_token, &a.token);
            // authorize the router to move exactly `alloc` of deposit_token
            // from this folio into the pair (folio isn't the direct caller of
            // that transfer, so mock/implicit auth doesn't cover it)
            authorize_transfer(&e, &deposit_token, &this, &pair, alloc);
            soroswap.swap_exact_tokens_for_tokens(&alloc, &0i128, &path, &this, &deadline);
        }

        // mint from the value actually added (depositor bears own slippage)
        let mut value_after: i128 = 0;
        for i in 0..assets.len() {
            let a = assets.get_unchecked(i);
            let bal = token::TokenClient::new(&e, &a.token).balance(&this);
            let v = muldiv_floor(&e, bal, prices.get_unchecked(i), 10i128.pow(a.decimals));
            value_after = value_after
                .checked_add(v)
                .unwrap_or_else(|| panic_with_error!(&e, FolioError::Overflow));
        }
        let added = value_after - value_before;
        if added <= 0 {
            panic_with_error!(&e, FolioError::SlippageExceeded);
        }
        let shares_out = muldiv_floor(&e, added, supply, value_before);
        if shares_out <= 0 || shares_out < min_shares_out {
            panic_with_error!(&e, FolioError::SlippageExceeded);
        }
        Base::mint(&e, &user, shares_out);
        e.events().publish(
            (symbol_short!("mint_sa"), &user),
            (shares_out, deposit_amount, added),
        );
        shares_out
    }

    /// Burn `shares` and receive every basket asset pro-rata:
    /// `out_i = floor(bal_i * shares / supply)`. Never pausable, oracle-free.
    /// Returns the amounts paid out.
    pub fn redeem(e: Env, user: Address, shares: i128) -> Vec<i128> {
        // no require_auth here: Base::burn below enforces user auth, and a
        // second call in the same frame trips Error(Auth, ExistingValue)
        extend_ttl(&e);
        if shares <= 0 {
            panic_with_error!(&e, FolioError::AmountTooSmall);
        }
        let supply = Base::total_supply(&e);
        if supply == 0 {
            // clean error instead of a divide-by-zero host trap
            panic_with_error!(&e, FolioError::NotBootstrapped);
        }
        let assets = Self::get_assets(e.clone());
        let this = e.current_contract_address();

        // compute outs against pre-burn supply
        let mut outs: Vec<i128> = Vec::new(&e);
        let mut any = false;
        for i in 0..assets.len() {
            let a = assets.get_unchecked(i);
            let bal = token::TokenClient::new(&e, &a.token).balance(&this);
            let out = muldiv_floor(&e, bal, shares, supply);
            any = any || out > 0;
            outs.push_back(out);
        }
        if !any {
            // dust redemption would burn shares for nothing
            panic_with_error!(&e, FolioError::AmountTooSmall);
        }

        // effects (burn checks user balance), then interactions
        Base::burn(&e, &user, shares);
        for i in 0..assets.len() {
            let out = outs.get_unchecked(i);
            if out > 0 {
                let a = assets.get_unchecked(i);
                token::TokenClient::new(&e, &a.token).transfer(&this, &user, &out);
            }
        }

        e.events()
            .publish((symbol_short!("redeem"), &user), (shares, outs.clone()));
        outs
    }

    /// Live NAV from the oracle router. View — not used by mint/redeem math.
    pub fn nav(e: Env) -> NavInfo {
        let assets = Self::get_assets(e.clone());
        let router = OracleRouterClient::new(&e, &Self::router(e.clone()));
        let this = e.current_contract_address();
        let mut total: i128 = 0;
        for i in 0..assets.len() {
            let a = assets.get_unchecked(i);
            let bal = token::TokenClient::new(&e, &a.token).balance(&this);
            let price = router.price(&a.token).price;
            let v = muldiv_floor(&e, bal, price, 10i128.pow(a.decimals));
            total = total
                .checked_add(v)
                .unwrap_or_else(|| panic_with_error!(&e, FolioError::Overflow));
        }
        let supply = Base::total_supply(&e);
        let per_share = if supply > 0 {
            muldiv_floor(&e, total, 10i128.pow(SHARE_DECIMALS), supply)
        } else {
            0
        };
        NavInfo { total_value: total, per_share }
    }

    // --- views ---

    pub fn get_assets(e: Env) -> Vec<AssetInfo> {
        e.storage().instance().get(&DataKey::Assets).unwrap()
    }

    /// Current on-chain balances, parallel to `get_assets()`.
    pub fn balances(e: Env) -> Vec<i128> {
        let assets = Self::get_assets(e.clone());
        let this = e.current_contract_address();
        let mut out: Vec<i128> = Vec::new(&e);
        for i in 0..assets.len() {
            let a = assets.get_unchecked(i);
            out.push_back(token::TokenClient::new(&e, &a.token).balance(&this));
        }
        out
    }

    pub fn admin(e: Env) -> Address {
        e.storage().instance().get(&DataKey::Admin).unwrap()
    }

    pub fn router(e: Env) -> Address {
        e.storage().instance().get(&DataKey::Router).unwrap()
    }

    /// The Soroswap Router used by `mint_single_asset`. Traps with a clear
    /// error (rather than the generic missing-key panic) if never set.
    pub fn soroswap_router(e: Env) -> Address {
        e.storage()
            .instance()
            .get(&DataKey::SoroswapRouter)
            .unwrap_or_else(|| panic_with_error!(&e, FolioError::SoroswapNotConfigured))
    }

    pub fn paused(e: Env) -> bool {
        e.storage().instance().get(&DataKey::Paused).unwrap()
    }

    // --- admin ---

    /// Pause/unpause minting. Redemption is never affected.
    pub fn set_paused(e: Env, paused: bool) {
        Self::admin(e.clone()).require_auth();
        e.storage().instance().set(&DataKey::Paused, &paused);
    }

    /// Repoint to a new OracleRouter (e.g. the Stage-1.5 median router).
    pub fn set_router(e: Env, router: Address) {
        Self::admin(e.clone()).require_auth();
        e.storage().instance().set(&DataKey::Router, &router);
    }

    /// Configure (or change) the Soroswap Router used by `mint_single_asset`.
    /// Deliberately not a constructor param — avoids a Factory redeploy just
    /// to wire an external dependency; set once by admin after deploying.
    pub fn set_soroswap_router(e: Env, soroswap_router: Address) {
        Self::admin(e.clone()).require_auth();
        e.storage().instance().set(&DataKey::SoroswapRouter, &soroswap_router);
    }

    fn require_not_paused(e: &Env) {
        if Self::paused(e.clone()) {
            panic_with_error!(e, FolioError::Paused);
        }
    }
}

// SEP-41 share token: OZ audited base + burnable (burning without redeeming
// only donates value to remaining holders — allowed, harmless to others).
#[contractimpl(contracttrait)]
impl FungibleToken for NebulaFolio {
    type ContractType = Base;
}

#[contractimpl(contracttrait)]
impl FungibleBurnable for NebulaFolio {}

fn extend_ttl(e: &Env) {
    e.storage().instance().extend_ttl(TTL_THRESHOLD, TTL_EXTEND);
}

/// Pre-authorize `token.transfer(from, to, amount)` performed by a contract
/// this folio calls (the router). Required because the folio, not being the
/// direct caller of that transfer, must explicitly authorize spending its own
/// funds; args must match the eventual call exactly (hence exact-input swaps).
fn authorize_transfer(e: &Env, token: &Address, from: &Address, to: &Address, amount: i128) {
    let args: Vec<Val> = (from.clone(), to.clone(), amount).into_val(e);
    let entry = InvokerContractAuthEntry::Contract(SubContractInvocation {
        context: ContractContext {
            contract: token.clone(),
            fn_name: Symbol::new(e, "transfer"),
            args,
        },
        sub_invocations: vec![e],
    });
    e.authorize_as_current_contract(vec![e, entry]);
}

fn muldiv_floor(e: &Env, a: i128, b: i128, denom: i128) -> i128 {
    a.checked_mul(b)
        .unwrap_or_else(|| panic_with_error!(e, FolioError::Overflow))
        / denom
}

fn muldiv_ceil(e: &Env, a: i128, b: i128, denom: i128) -> i128 {
    let prod = a
        .checked_mul(b)
        .unwrap_or_else(|| panic_with_error!(e, FolioError::Overflow));
    (prod + denom - 1) / denom
}

#[cfg(test)]
mod test;
