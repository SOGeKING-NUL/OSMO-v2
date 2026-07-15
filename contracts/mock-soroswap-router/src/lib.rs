//! Fixed-rate stand-in for the real Soroswap Router, used only to unit-test
//! `mint_single_asset`'s internal accounting in isolation (no network). The
//! real router's behavior (input pulled from `to`, no separate approve step;
//! `router_pair_for` a deterministic address) was verified live against the
//! actual testnet contract before writing this — see DECISION_LOG ADR-016.
//!
//! This mock is its own "pair": it pulls the input into itself and pays the
//! output back out, so `router_pair_for` returns the mock's own address —
//! which is exactly the `to` the Folio pre-authorizes the input transfer to.
//! Two-hop paths only (`path.len() == 2`) — all `mint_single_asset` builds.

#![no_std]

use nebula_interfaces::SoroswapError;
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, token, Address, Env, Vec,
};

#[derive(Clone)]
#[contracttype]
struct RateKey {
    token_in: Address,
    token_out: Address,
}

#[contracttype]
enum DataKey {
    Admin,
    Rate(RateKey),
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum MockRouterError {
    SlippageExceeded = 1,
    DeadlinePassed = 2,
    UnknownPair = 3,
}

#[contract]
pub struct MockSoroswapRouter;

#[contractimpl]
impl MockSoroswapRouter {
    pub fn __constructor(e: Env, admin: Address) {
        e.storage().instance().set(&DataKey::Admin, &admin);
    }

    /// `rate` = output units per input unit, 7-dec fixed point:
    /// `amount_out = amount_in * rate / 10^7`.
    pub fn set_rate(e: Env, token_in: Address, token_out: Address, rate: i128) {
        let admin: Address = e.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        e.storage()
            .instance()
            .set(&DataKey::Rate(RateKey { token_in, token_out }), &rate);
    }

    pub fn router_pair_for(
        e: Env,
        _token_a: Address,
        _token_b: Address,
    ) -> Result<Address, SoroswapError> {
        // the mock is its own pool
        Ok(e.current_contract_address())
    }

    pub fn swap_exact_tokens_for_tokens(
        e: Env,
        amount_in: i128,
        amount_out_min: i128,
        path: Vec<Address>,
        to: Address,
        deadline: u64,
    ) -> Result<Vec<i128>, SoroswapError> {
        to.require_auth();
        if e.ledger().timestamp() > deadline {
            panic_with_error!(&e, MockRouterError::DeadlinePassed);
        }
        if path.len() != 2 {
            panic_with_error!(&e, MockRouterError::UnknownPair);
        }
        let token_in = path.get_unchecked(0);
        let token_out = path.get_unchecked(1);
        let rate: i128 = e
            .storage()
            .instance()
            .get(&DataKey::Rate(RateKey {
                token_in: token_in.clone(),
                token_out: token_out.clone(),
            }))
            .unwrap_or_else(|| panic_with_error!(&e, MockRouterError::UnknownPair));

        let amount_out = amount_in * rate / 10i128.pow(7); // floor
        if amount_out < amount_out_min {
            panic_with_error!(&e, MockRouterError::SlippageExceeded);
        }

        let this = e.current_contract_address();
        token::TokenClient::new(&e, &token_in).transfer(&to, &this, &amount_in);
        token::TokenClient::new(&e, &token_out).transfer(&this, &to, &amount_out);

        Ok(Vec::from_array(&e, [amount_in, amount_out]))
    }
}
