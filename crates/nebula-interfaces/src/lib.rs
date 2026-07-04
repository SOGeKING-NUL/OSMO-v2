//! Shared types + cross-contract clients for Nebula DTF.
//!
//! We define the SEP-40 oracle interface ourselves instead of using the
//! `sep-40-oracle` crate: that crate pins soroban-sdk ^25 while OpenZeppelin
//! stellar-tokens (our audited share-token base) needs ^26 (see DECISION_LOG
//! ADR-009). The interface is ~30 lines and matches Reflector's contract.

#![no_std]

use soroban_sdk::{contractclient, contracttype, Address, Env, Symbol};

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
