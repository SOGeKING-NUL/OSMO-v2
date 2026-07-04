#![cfg(test)]
//! Requires the folio wasm to be built first:
//!   stellar contract build   (or scripts/test.ps1, which does both)

use crate::{NebulaFactory, NebulaFactoryClient};
use nebula_mock_price_feed::MockPriceFeed;
use nebula_oracle_router::NebulaOracleRouter;
use soroban_sdk::testutils::{Address as _, BytesN as _};
use soroban_sdk::{vec, Address, BytesN, Env, String};

mod folio_wasm {
    soroban_sdk::contractimport!(
        file = "../../target/wasm32v1-none/release/nebula_folio.wasm"
    );
}

#[test]
fn creates_registered_working_folio() {
    let e = Env::default();
    e.mock_all_auths();

    let admin = Address::generate(&e);
    let feed = e.register(MockPriceFeed, (&admin, 14u32));
    let router = e.register(NebulaOracleRouter, (&admin, 3600u64, 500u32, true));

    let wasm_hash = e.deployer().upload_contract_wasm(folio_wasm::WASM);
    let factory_id = e.register(NebulaFactory, (&admin, wasm_hash.clone()));
    let factory = NebulaFactoryClient::new(&e, &factory_id);
    assert_eq!(factory.wasm_hash(), wasm_hash);

    // two SAC test tokens
    let t0 = e.register_stellar_asset_contract_v2(admin.clone()).address();
    let t1 = e.register_stellar_asset_contract_v2(admin.clone()).address();

    let folio_addr = factory.create_folio(
        &BytesN::random(&e),
        &admin,
        &router,
        &String::from_str(&e, "Test Folio"),
        &String::from_str(&e, "TF"),
        &vec![&e, t0, t1],
        &vec![&e, 6_000u32, 4_000u32],
    );

    assert_eq!(factory.folios().len(), 1);
    assert_eq!(factory.folios().get_unchecked(0), folio_addr);

    // deployed folio is live and configured
    let folio = folio_wasm::Client::new(&e, &folio_addr);
    assert_eq!(folio.symbol(), String::from_str(&e, "TF"));
    assert_eq!(folio.get_assets().len(), 2);
    assert_eq!(folio.paused(), false);
    let _ = feed; // feed only needed so router constructor deps exist
}

#[test]
fn same_salt_cannot_deploy_twice() {
    let e = Env::default();
    e.mock_all_auths();
    let admin = Address::generate(&e);
    let router = e.register(NebulaOracleRouter, (&admin, 3600u64, 500u32, true));
    let wasm_hash = e.deployer().upload_contract_wasm(folio_wasm::WASM);
    let factory = NebulaFactoryClient::new(&e, &e.register(NebulaFactory, (&admin, wasm_hash)));

    let t0 = e.register_stellar_asset_contract_v2(admin.clone()).address();
    let t1 = e.register_stellar_asset_contract_v2(admin.clone()).address();
    let salt = BytesN::random(&e);
    let args = (
        &salt,
        &admin,
        &router,
        &String::from_str(&e, "A"),
        &String::from_str(&e, "A"),
        &vec![&e, t0, t1],
        &vec![&e, 5_000u32, 5_000u32],
    );
    factory.create_folio(args.0, args.1, args.2, args.3, args.4, args.5, args.6);
    // second deploy with identical salt must fail at the host level
    assert!(factory
        .try_create_folio(args.0, args.1, args.2, args.3, args.4, args.5, args.6)
        .is_err());
}
