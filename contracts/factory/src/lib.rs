//! FolioFactory — deploys Folios from a stored wasm hash and keeps a registry.
//!
//! Versioning (ADR-006): Folios are immutable; new Folio logic = admin uploads
//! new wasm, calls `set_wasm_hash`, and *future* folios use it. Existing
//! folios are untouched; users opt in by moving.

#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, Address, BytesN, Env, String, Vec,
};

const TTL_THRESHOLD: u32 = 17_280;
const TTL_EXTEND: u32 = 518_400;

#[contracttype]
enum DataKey {
    Admin,
    FolioWasmHash,
    Folios,
}

#[contract]
pub struct NebulaFactory;

#[contractimpl]
impl NebulaFactory {
    pub fn __constructor(e: Env, admin: Address, folio_wasm_hash: BytesN<32>) {
        e.storage().instance().set(&DataKey::Admin, &admin);
        e.storage()
            .instance()
            .set(&DataKey::FolioWasmHash, &folio_wasm_hash);
        e.storage()
            .instance()
            .set(&DataKey::Folios, &Vec::<Address>::new(&e));
    }

    /// Deploy + initialize a new Folio. Admin-gated in Phase 1 (folio curation
    /// is part of the product; permissionless creation is a later decision).
    #[allow(clippy::too_many_arguments)]
    pub fn create_folio(
        e: Env,
        salt: BytesN<32>,
        folio_admin: Address,
        router: Address,
        name: String,
        symbol: String,
        tokens: Vec<Address>,
        weights_bps: Vec<u32>,
    ) -> Address {
        Self::admin(e.clone()).require_auth();
        e.storage().instance().extend_ttl(TTL_THRESHOLD, TTL_EXTEND);

        let wasm_hash: BytesN<32> =
            e.storage().instance().get(&DataKey::FolioWasmHash).unwrap();

        let folio = e
            .deployer()
            .with_current_contract(salt)
            .deploy_v2(
                wasm_hash,
                (folio_admin, router, name, symbol, tokens, weights_bps),
            );

        let mut folios: Vec<Address> = e.storage().instance().get(&DataKey::Folios).unwrap();
        folios.push_back(folio.clone());
        e.storage().instance().set(&DataKey::Folios, &folios);

        e.events().publish((symbol_short!("created"),), folio.clone());
        folio
    }

    /// Point future deployments at a new Folio wasm (ADR-006 versioning).
    pub fn set_wasm_hash(e: Env, folio_wasm_hash: BytesN<32>) {
        Self::admin(e.clone()).require_auth();
        e.storage()
            .instance()
            .set(&DataKey::FolioWasmHash, &folio_wasm_hash);
    }

    // --- views ---

    pub fn admin(e: Env) -> Address {
        e.storage().instance().get(&DataKey::Admin).unwrap()
    }

    pub fn wasm_hash(e: Env) -> BytesN<32> {
        e.storage().instance().get(&DataKey::FolioWasmHash).unwrap()
    }

    pub fn folios(e: Env) -> Vec<Address> {
        e.storage().instance().get(&DataKey::Folios).unwrap()
    }
}

#[cfg(test)]
mod test;
