//! Shared types + cross-contract clients for Nebula DTF.
//!
//! We define the SEP-40 oracle interface ourselves instead of using the
//! `sep-40-oracle` crate: that crate pins soroban-sdk ^25 while OpenZeppelin
//! stellar-tokens (our audited share-token base) needs ^26 (see DECISION_LOG
//! ADR-009). The interface is ~30 lines and matches Reflector's contract.

#![no_std]

use soroban_sdk::{contractclient, contracterror, contracttype, Address, BytesN, Env, Symbol, Vec};

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

/// Placeholder error type for [`AquariusRouterApi`] — we never inspect the
/// real Aquarius AMM error variants, only whether the call succeeded;
/// any failure (ours or theirs) propagates as a trap, which is exactly the
/// atomic all-or-nothing behavior `mint_single_asset` wants.
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum AquariusError {
    Unknown = 1,
}

/// One Aquarius route hop: `(ordered_pool_tokens, pool_index_hash, token_out)`.
/// This matches the public Aquarius `swap_chained` contract signature.
pub type AquariusSwap = (Vec<Address>, BytesN<32>, Address);

/// Minimal client for the Aquarius AMM entry contract. Production Aquarius
/// exposes `swap_chained(user, swaps_chain, token_in, in_amount, out_min)`;
/// `mint_single_asset` stores the configured `swaps_chain` for each basket leg
/// and spends exact input amounts so the folio can authorize those transfers
/// precisely.
#[contractclient(name = "AquariusRouterClient")]
pub trait AquariusRouterApi {
    /// Swap exactly `in_amount` of `token_in` owned by `user` along the route,
    /// returning the final output amount. Any Aquarius failure traps, keeping
    /// the whole mint atomic.
    fn swap_chained(
        env: Env,
        user: Address,
        swaps_chain: Vec<AquariusSwap>,
        token_in: Address,
        in_amount: u128,
        out_min: u128,
    ) -> Result<u128, AquariusError>;
}
