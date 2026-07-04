#![cfg(test)]

use crate::{NebulaOracleRouter, NebulaOracleRouterClient, RouterError};
use nebula_interfaces::{OracleAsset, PRICE_DECIMALS};
use nebula_mock_price_feed::{MockPriceFeed, MockPriceFeedClient};
use soroban_sdk::testutils::{Address as _, Ledger};
use soroban_sdk::{vec, Address, Env, Symbol, Vec};

const NOW: u64 = 1_760_000_000;
const MAX_AGE: u64 = 3_600;
const MAX_DIV_BPS: u32 = 500; // 5%

struct Setup {
    e: Env,
    router: NebulaOracleRouterClient<'static>,
    feed_a: MockPriceFeedClient<'static>,
    feed_b: MockPriceFeedClient<'static>,
    token: Address,
}

/// Router with one token; `dual` wires both mock feeds to it, else only A.
fn setup(feed_decimals: u32, dual: bool, allow_single: bool) -> Setup {
    let e = Env::default();
    e.mock_all_auths();
    e.ledger().with_mut(|l| l.timestamp = NOW);

    let admin = Address::generate(&e);
    let feed_a = MockPriceFeedClient::new(&e, &e.register(MockPriceFeed, (&admin, feed_decimals)));
    let feed_b = MockPriceFeedClient::new(&e, &e.register(MockPriceFeed, (&admin, feed_decimals)));
    let router = NebulaOracleRouterClient::new(
        &e,
        &e.register(
            NebulaOracleRouter,
            (&admin, MAX_AGE, MAX_DIV_BPS, allow_single),
        ),
    );

    let token = Address::generate(&e);
    let oa = OracleAsset::Stellar(token.clone());
    let mut feeds: Vec<(Address, OracleAsset)> = vec![&e, (feed_a.address.clone(), oa.clone())];
    if dual {
        feeds.push_back((feed_b.address.clone(), oa));
    }
    router.set_feeds(&token, &feeds);

    Setup { e, router, feed_a, feed_b, token }
}

fn px(dec: u32, units: i128) -> i128 {
    units * 10i128.pow(dec)
}

// --- single-feed behavior (v1 semantics preserved) ---

#[test]
fn returns_fresh_price_normalized() {
    let s = setup(14, false, true);
    let oa = OracleAsset::Stellar(s.token.clone());
    s.feed_a.set_price(&oa, &(25 * 10i128.pow(PRICE_DECIMALS - 2)), &NOW);
    let pd = s.router.price(&s.token);
    assert_eq!(pd.price, 25 * 10i128.pow(12));
    assert_eq!(pd.timestamp, NOW);
}

#[test]
fn rescales_feed_decimals_both_ways() {
    let s8 = setup(8, false, true);
    let oa = OracleAsset::Stellar(s8.token.clone());
    s8.feed_a.set_price(&oa, &px(8, 3), &NOW);
    assert_eq!(s8.router.price(&s8.token).price, px(14, 3));

    let s18 = setup(18, false, true);
    let oa = OracleAsset::Stellar(s18.token.clone());
    s18.feed_a.set_price(&oa, &px(18, 2), &NOW);
    assert_eq!(s18.router.price(&s18.token).price, px(14, 2));
}

#[test]
fn normalizes_millisecond_timestamps() {
    let s = setup(14, false, true);
    let oa = OracleAsset::Stellar(s.token.clone());
    s.feed_a.set_price(&oa, &px(14, 1), &(NOW * 1000));
    assert_eq!(s.router.price(&s.token).timestamp, NOW);
}

#[test]
fn rejects_stale_missing_nonpositive_and_unregistered() {
    let s = setup(14, false, true);
    let oa = OracleAsset::Stellar(s.token.clone());

    let unknown = Address::generate(&s.e);
    assert_eq!(s.router.try_price(&unknown), Err(Ok(RouterError::NoFeed.into())));

    assert_eq!(s.router.try_price(&s.token), Err(Ok(RouterError::NoPrice.into())));

    s.feed_a.set_price(&oa, &0, &NOW);
    assert_eq!(s.router.try_price(&s.token), Err(Ok(RouterError::InvalidPrice.into())));

    s.feed_a.set_price(&oa, &px(14, 1), &(NOW - MAX_AGE - 1));
    assert_eq!(s.router.try_price(&s.token), Err(Ok(RouterError::StalePrice.into())));
}

#[test]
fn symbol_mapped_assets_work() {
    // testnet TAQUA can map to Reflector's Other("AQUA")
    let s = setup(14, false, true);
    let taqua = Address::generate(&s.e);
    let sym = OracleAsset::Other(Symbol::new(&s.e, "AQUA"));
    s.router
        .set_feeds(&taqua, &vec![&s.e, (s.feed_a.address.clone(), sym.clone())]);
    s.feed_a.set_price(&sym, &px(14, 1), &NOW);
    assert_eq!(s.router.price(&taqua).price, px(14, 1));
}

// --- two-feed median + divergence breaker ---

#[test]
fn two_valid_feeds_return_midpoint_and_older_timestamp() {
    let s = setup(14, true, true);
    let oa = OracleAsset::Stellar(s.token.clone());
    s.feed_a.set_price(&oa, &px(14, 100), &NOW);
    s.feed_b.set_price(&oa, &px(14, 102), &(NOW - 10)); // +2%, within 5%
    let pd = s.router.price(&s.token);
    assert_eq!(pd.price, px(14, 101));
    assert_eq!(pd.timestamp, NOW - 10);
}

#[test]
fn divergence_beyond_threshold_trips_breaker() {
    let s = setup(14, true, true);
    let oa = OracleAsset::Stellar(s.token.clone());
    s.feed_a.set_price(&oa, &px(14, 100), &NOW);
    s.feed_b.set_price(&oa, &(px(14, 105) + 1), &NOW); // just past 5%
    assert_eq!(s.router.try_price(&s.token), Err(Ok(RouterError::Divergence.into())));

    // exactly at the threshold is allowed
    s.feed_b.set_price(&oa, &px(14, 105), &NOW);
    assert_eq!(s.router.price(&s.token).price, px(14, 102) + 5 * 10i128.pow(13));
}

#[test]
fn one_stale_feed_falls_back_when_allow_single() {
    let s = setup(14, true, true);
    let oa = OracleAsset::Stellar(s.token.clone());
    s.feed_a.set_price(&oa, &px(14, 100), &NOW);
    s.feed_b.set_price(&oa, &px(14, 500), &(NOW - MAX_AGE - 1)); // stale + wild
    // stale outlier ignored, primary used
    assert_eq!(s.router.price(&s.token).price, px(14, 100));
}

#[test]
fn one_valid_feed_rejected_when_strict_dual() {
    let s = setup(14, true, false); // allow_single = false
    let oa = OracleAsset::Stellar(s.token.clone());
    s.feed_a.set_price(&oa, &px(14, 100), &NOW);
    // feed_b has no data
    assert_eq!(s.router.try_price(&s.token), Err(Ok(RouterError::SingleSource.into())));
}

#[test]
fn both_feeds_dead_reports_primary_error() {
    let s = setup(14, true, true);
    let oa = OracleAsset::Stellar(s.token.clone());
    s.feed_a.set_price(&oa, &px(14, 1), &(NOW - MAX_AGE - 1));
    // b: no data at all
    assert_eq!(s.router.try_price(&s.token), Err(Ok(RouterError::StalePrice.into())));
}

#[test]
fn set_feeds_rejects_empty_and_too_many() {
    let s = setup(14, false, true);
    let oa = OracleAsset::Stellar(s.token.clone());
    let empty: Vec<(Address, OracleAsset)> = vec![&s.e];
    assert_eq!(
        s.router.try_set_feeds(&s.token, &empty),
        Err(Ok(RouterError::BadConfig.into()))
    );
    let three = vec![
        &s.e,
        (s.feed_a.address.clone(), oa.clone()),
        (s.feed_b.address.clone(), oa.clone()),
        (s.feed_a.address.clone(), oa),
    ];
    assert_eq!(
        s.router.try_set_feeds(&s.token, &three),
        Err(Ok(RouterError::BadConfig.into()))
    );
}
