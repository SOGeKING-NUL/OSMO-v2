//! Fixed-rate stand-in for the Aquarius AMM entry contract, used only to unit-test
//! `mint_single_asset`'s internal accounting in isolation (no network). The
//! mock is its own pool: it pulls the input into itself and pays the output
//! back to the folio. One-hop routes only — all unit tests build direct XLM
//! hub routes.

#![no_std]

use nebula_interfaces::{AquariusError, AquariusSwap};
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
    UnknownPair = 2,
}

#[contract]
pub struct MockAquariusRouter;

#[contractimpl]
impl MockAquariusRouter {
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

    pub fn swap_chained(
        e: Env,
        user: Address,
        swaps_chain: Vec<AquariusSwap>,
        token_in: Address,
        in_amount: u128,
        out_min: u128,
    ) -> Result<u128, AquariusError> {
        user.require_auth();
        if swaps_chain.len() != 1 {
            panic_with_error!(&e, MockRouterError::UnknownPair);
        }
        let token_out = swaps_chain.get_unchecked(0).2;
        let rate: i128 = e
            .storage()
            .instance()
            .get(&DataKey::Rate(RateKey {
                token_in: token_in.clone(),
                token_out: token_out.clone(),
            }))
            .unwrap_or_else(|| panic_with_error!(&e, MockRouterError::UnknownPair));

        let in_i128 = in_amount as i128;
        let amount_out = in_i128 * rate / 10i128.pow(7); // floor
        if amount_out < out_min as i128 {
            panic_with_error!(&e, MockRouterError::SlippageExceeded);
        }

        let this = e.current_contract_address();
        token::TokenClient::new(&e, &token_in).transfer(&user, &this, &in_i128);
        token::TokenClient::new(&e, &token_out).transfer(&this, &user, &amount_out);

        Ok(amount_out as u128)
    }
}
