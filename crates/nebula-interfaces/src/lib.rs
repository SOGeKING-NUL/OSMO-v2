//! Shared types + cross-contract clients for Nebula DTF.
//!
//! We define the SEP-40 oracle interface ourselves instead of using the
//! `sep-40-oracle` crate: that crate pins soroban-sdk ^25 while OpenZeppelin
//! stellar-tokens (our audited share-token base) needs ^26 (see DECISION_LOG
//! ADR-009). The interface is ~30 lines and matches Reflector's contract.

#![no_std]

use soroban_sdk::{contractclient, contracterror, contracttype, Address, Env, Symbol, Vec};

/// All prices returned by the OracleRouter are normalized to this many
/// decimals (matches Reflector's native 14).
pub const PRICE_DECIMALS: u32 = 14;

/// Asset identifier as understood by SEP-40 oracles (matches Reflector's
/// `Asset` enum): either a Stellar token contract address or an off-chain
/// ticker symbol.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum OracleAsset {
    Stellar(Address),
    Other(Symbol),
}

/// Price record returned by SEP-40 oracles.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PriceData {
    pub price: i128,
    pub timestamp: u64,
}

/// Minimal SEP-40 price feed client — enough for Reflector, DIA and mocks.
#[contractclient(name = "Sep40Client")]
pub trait Sep40PriceFeed {
    /// Most recent price for `asset`, in the feed's base asset & decimals.
    fn lastprice(env: Env, asset: OracleAsset) -> Option<PriceData>;
    /// Number of decimals all quoted prices use.
    fn decimals(env: Env) -> u32;
    /// Default tick period (seconds).
    fn resolution(env: Env) -> u32;
}

/// Client for Nebula's OracleRouter, used by Folio contracts.
#[contractclient(name = "OracleRouterClient")]
pub trait OracleRouterApi {
    /// USD price for `token`, normalized to [`PRICE_DECIMALS`].
    /// Traps with a contract error if the feed is missing, stale or invalid.
    fn price(env: Env, token: Address) -> PriceData;
}

/// Placeholder error type for [`SoroswapRouterApi`] — we never inspect the
/// real `CombinedRouterError` variants, only whether the call succeeded;
/// any failure (ours or theirs) propagates as a trap, which is exactly the
/// atomic all-or-nothing behavior `mint_single_asset` wants.
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum SoroswapError {
    Unknown = 1,
}

/// Minimal client for the real, third-party Soroswap Router (not a Nebula
/// contract) — just the two functions `mint_single_asset` needs. Verified
/// against the real deployed contract 2026-07-06 (see DECISION_LOG ADR-016):
/// testnet `CCJUD55AG6W5HAI5LRVNKAE5WDP5XGZBUDS5WNTIVDU7O264UZZE7BRD`.
///
/// We use exact-*input* (not exact-output) swaps: `mint_single_asset` decides
/// exactly how much it spends per leg, so it can pre-authorize that exact
/// transfer via `authorize_as_current_contract` (auth entries must match args
/// exactly — an exact-output swap's input isn't known until execution).
#[contractclient(name = "SoroswapRouterClient")]
pub trait SoroswapRouterApi {
    /// Swap exactly `amount_in` of `path[0]` for as much `path[last]` as
    /// possible (at least `amount_out_min`), sent to `to`. Returns the amount
    /// at each hop; traps on `amount_out_min` slippage or expired `deadline`.
    fn swap_exact_tokens_for_tokens(
        env: Env,
        amount_in: i128,
        amount_out_min: i128,
        path: Vec<Address>,
        to: Address,
        deadline: u64,
    ) -> Result<Vec<i128>, SoroswapError>;

    /// Deterministic address of the `token_a`/`token_b` pool (CREATE2-style —
    /// returns an address whether or not a pool is deployed there). Needed as
    /// the `to` of the swap's input transfer, which we must pre-authorize.
    fn router_pair_for(env: Env, token_a: Address, token_b: Address) -> Result<Address, SoroswapError>;
}
