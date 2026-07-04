//! Settable SEP-40 price feed. Used in unit tests and deployable to testnet
//! for basket assets Reflector's testnet oracle does not quote.
//! NEVER deploy to mainnet.

#![no_std]

use nebula_interfaces::{OracleAsset, PriceData};
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env};

#[contracttype]
enum DataKey {
    Admin,
    Decimals,
    Price(OracleAsset),
}

#[contract]
pub struct MockPriceFeed;

#[contractimpl]
impl MockPriceFeed {
    pub fn __constructor(e: Env, admin: Address, decimals: u32) {
        e.storage().instance().set(&DataKey::Admin, &admin);
        e.storage().instance().set(&DataKey::Decimals, &decimals);
    }

    /// Set the price for an asset. `timestamp` in Unix seconds; pass the
    /// current ledger time for a fresh price, an old value to test staleness.
    pub fn set_price(e: Env, asset: OracleAsset, price: i128, timestamp: u64) {
        let admin: Address = e.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        e.storage()
            .instance()
            .set(&DataKey::Price(asset), &PriceData { price, timestamp });
    }

    // --- SEP-40 ---

    pub fn lastprice(e: Env, asset: OracleAsset) -> Option<PriceData> {
        e.storage().instance().get(&DataKey::Price(asset))
    }

    pub fn decimals(e: Env) -> u32 {
        e.storage().instance().get(&DataKey::Decimals).unwrap()
    }

    pub fn resolution(_e: Env) -> u32 {
        300 // 5 minutes, matching Reflector
    }
}
