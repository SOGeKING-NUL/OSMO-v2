#![cfg(test)]

use crate::{FolioError, NebulaFolio, NebulaFolioClient};
use nebula_interfaces::OracleAsset;
use nebula_mock_price_feed::{MockPriceFeed, MockPriceFeedClient};
use nebula_mock_soroswap_router::{MockSoroswapRouter, MockSoroswapRouterClient};
use nebula_oracle_router::{NebulaOracleRouter, NebulaOracleRouterClient};
use soroban_sdk::testutils::{Address as _, Ledger};
use soroban_sdk::token::{StellarAssetClient, TokenClient};
use soroban_sdk::{vec, Address, Env, String, Vec};

const NOW: u64 = 1_760_000_000;
const MAX_AGE: u64 = 3_600;
const D7: i128 = 10_000_000; // one whole 7-dec unit

// Test basket mimicking XLM / USDC / AQUA at 50/30/20.
const WEIGHTS: [u32; 3] = [5_000, 3_000, 2_000];
// $0.25, $1.00, $0.0004 at 14 decimals
const PRICES: [i128; 3] = [25 * 10i128.pow(12), 10i128.pow(14), 4 * 10i128.pow(10)];
// $100 total at target ratio: 200 XLM, 30 USDC, 50_000 AQUA
const GOOD_DEPOSITS: [i128; 3] = [200 * D7, 30 * D7, 50_000 * D7];

struct Setup {
    e: Env,
    admin: Address,
    user: Address,
    tokens: Vec<Address>,
    sac_admins: [StellarAssetClient<'static>; 3],
    feed: MockPriceFeedClient<'static>,
    folio: NebulaFolioClient<'static>,
}

fn setup() -> Setup {
    let e = Env::default();
    e.mock_all_auths();
    e.ledger().with_mut(|l| l.timestamp = NOW);

    let admin = Address::generate(&e);
    let user = Address::generate(&e);

    // three SAC test tokens standing in for XLM / USDC / AQUA
    let sacs = [
        e.register_stellar_asset_contract_v2(admin.clone()),
        e.register_stellar_asset_contract_v2(admin.clone()),
        e.register_stellar_asset_contract_v2(admin.clone()),
    ];
    let tokens: Vec<Address> = vec![
        &e,
        sacs[0].address(),
        sacs[1].address(),
        sacs[2].address(),
    ];
    let sac_admins = [
        StellarAssetClient::new(&e, &sacs[0].address()),
        StellarAssetClient::new(&e, &sacs[1].address()),
        StellarAssetClient::new(&e, &sacs[2].address()),
    ];

    // oracle: mock feed behind the real router (single-feed, allow_single)
    let feed_id = e.register(MockPriceFeed, (&admin, 14u32));
    let feed = MockPriceFeedClient::new(&e, &feed_id);
    let router_id = e.register(NebulaOracleRouter, (&admin, MAX_AGE, 500u32, true));
    let router = NebulaOracleRouterClient::new(&e, &router_id);
    for i in 0..3 {
        let t = tokens.get_unchecked(i as u32);
        router.set_feeds(
            &t,
            &vec![&e, (feed_id.clone(), OracleAsset::Stellar(t.clone()))],
        );
        feed.set_price(&OracleAsset::Stellar(t.clone()), &PRICES[i], &NOW);
    }

    let folio_id = e.register(
        NebulaFolio,
        (
            &admin,
            &router_id,
            String::from_str(&e, "Stellar Ecosystem Folio"),
            String::from_str(&e, "SEF"),
            tokens.clone(),
            vec![&e, WEIGHTS[0], WEIGHTS[1], WEIGHTS[2]],
        ),
    );
    let folio = NebulaFolioClient::new(&e, &folio_id);

    // fund the user generously
    for sac in &sac_admins {
        sac.mint(&user, &(1_000_000 * D7));
    }

    Setup { e, admin, user, tokens, sac_admins, feed, folio }
}

fn deposits(s: &Setup, arr: [i128; 3]) -> Vec<i128> {
    vec![&s.e, arr[0], arr[1], arr[2]]
}

// --- bootstrap ---

#[test]
fn bootstrap_mints_dollar_shares() {
    let s = setup();
    let shares = s.folio.init_mint(&s.user, &deposits(&s, GOOD_DEPOSITS));
    assert_eq!(shares, 100 * D7); // $100 → 100.0 shares
    assert_eq!(s.folio.balance(&s.user), 100 * D7);
    assert_eq!(s.folio.total_supply(), 100 * D7);
    // folio custodies the deposits
    let bals = s.folio.balances();
    for i in 0..3 {
        assert_eq!(bals.get_unchecked(i as u32), GOOD_DEPOSITS[i]);
    }
    // NAV: $100 total, $1.00/share
    let nav = s.folio.nav();
    assert_eq!(nav.total_value, 100 * 10i128.pow(14));
    assert_eq!(nav.per_share, 10i128.pow(14));
}

#[test]
fn bootstrap_rejects_bad_ratio() {
    let s = setup();
    // double the USDC leg: 30% weight becomes ~46%
    let bad = deposits(&s, [200 * D7, 60 * D7, 50_000 * D7]);
    assert_eq!(
        s.folio.try_init_mint(&s.user, &bad),
        Err(Ok(FolioError::RatioOutOfTolerance.into()))
    );
}

#[test]
fn bootstrap_rejects_dust() {
    let s = setup();
    // ratio fine, but total < $1
    let dust = deposits(&s, [GOOD_DEPOSITS[0] / 1000, GOOD_DEPOSITS[1] / 1000, GOOD_DEPOSITS[2] / 1000]);
    assert_eq!(
        s.folio.try_init_mint(&s.user, &dust),
        Err(Ok(FolioError::AmountTooSmall.into()))
    );
}

#[test]
fn bootstrap_only_once() {
    let s = setup();
    s.folio.init_mint(&s.user, &deposits(&s, GOOD_DEPOSITS));
    assert_eq!(
        s.folio.try_init_mint(&s.user, &deposits(&s, GOOD_DEPOSITS)),
        Err(Ok(FolioError::AlreadyBootstrapped.into()))
    );
}

#[test]
fn bootstrap_rejects_stale_oracle() {
    let s = setup();
    let t = s.tokens.get_unchecked(0);
    s.feed.set_price(
        &OracleAsset::Stellar(t),
        &PRICES[0],
        &(NOW - MAX_AGE - 1),
    );
    // router error surfaces as an invoke error, not FolioError
    assert!(s.folio.try_init_mint(&s.user, &deposits(&s, GOOD_DEPOSITS)).is_err());
}

// --- proportional mint ---

#[test]
fn mint_pulls_exact_pro_rata_deposits() {
    let s = setup();
    s.folio.init_mint(&s.user, &deposits(&s, GOOD_DEPOSITS));

    let user2 = Address::generate(&s.e);
    for sac in &s.sac_admins {
        sac.mint(&user2, &(1_000_000 * D7));
    }
    // mint 50 shares = half the current supply → half of every balance
    let max = deposits(&s, [i128::MAX >> 1, i128::MAX >> 1, i128::MAX >> 1]);
    let paid = s.folio.mint(&user2, &(50 * D7), &max);
    for i in 0..3u32 {
        assert_eq!(paid.get_unchecked(i), GOOD_DEPOSITS[i as usize] / 2);
    }
    assert_eq!(s.folio.balance(&user2), 50 * D7);
    assert_eq!(s.folio.total_supply(), 150 * D7);
    // mint is oracle-free: NAV per share unchanged
    assert_eq!(s.folio.nav().per_share, 10i128.pow(14));
}

#[test]
fn mint_respects_max_deposit_bounds() {
    let s = setup();
    s.folio.init_mint(&s.user, &deposits(&s, GOOD_DEPOSITS));
    // max on the first leg is one stroop short of what's required
    let max = deposits(&s, [100 * D7 - 1, i128::MAX >> 1, i128::MAX >> 1]);
    assert_eq!(
        s.folio.try_mint(&s.user, &(50 * D7), &max),
        Err(Ok(FolioError::SlippageExceeded.into()))
    );
}

#[test]
fn mint_requires_bootstrap() {
    let s = setup();
    let max = deposits(&s, [i128::MAX >> 1, i128::MAX >> 1, i128::MAX >> 1]);
    assert_eq!(
        s.folio.try_mint(&s.user, &(50 * D7), &max),
        Err(Ok(FolioError::NotBootstrapped.into()))
    );
}

#[test]
fn mint_works_with_stale_oracle() {
    // proves the oracle is out of the recurring money path
    let s = setup();
    s.folio.init_mint(&s.user, &deposits(&s, GOOD_DEPOSITS));
    for i in 0..3u32 {
        let t = s.tokens.get_unchecked(i);
        s.feed
            .set_price(&OracleAsset::Stellar(t), &PRICES[i as usize], &(NOW - MAX_AGE * 10));
    }
    let max = deposits(&s, [i128::MAX >> 1, i128::MAX >> 1, i128::MAX >> 1]);
    let paid = s.folio.mint(&s.user, &(100 * D7), &max);
    assert_eq!(paid.get_unchecked(0), GOOD_DEPOSITS[0]);
}

// --- redeem ---

#[test]
fn redeem_returns_pro_rata_and_burns() {
    let s = setup();
    s.folio.init_mint(&s.user, &deposits(&s, GOOD_DEPOSITS));

    let before: [i128; 3] = [
        TokenClient::new(&s.e, &s.tokens.get_unchecked(0)).balance(&s.user),
        TokenClient::new(&s.e, &s.tokens.get_unchecked(1)).balance(&s.user),
        TokenClient::new(&s.e, &s.tokens.get_unchecked(2)).balance(&s.user),
    ];
    let outs = s.folio.redeem(&s.user, &(25 * D7)); // a quarter
    for i in 0..3u32 {
        assert_eq!(outs.get_unchecked(i), GOOD_DEPOSITS[i as usize] / 4);
        let after = TokenClient::new(&s.e, &s.tokens.get_unchecked(i)).balance(&s.user);
        assert_eq!(after - before[i as usize], GOOD_DEPOSITS[i as usize] / 4);
    }
    assert_eq!(s.folio.total_supply(), 75 * D7);
    assert_eq!(s.folio.balance(&s.user), 75 * D7);
}

#[test]
fn full_redeem_empties_folio() {
    let s = setup();
    s.folio.init_mint(&s.user, &deposits(&s, GOOD_DEPOSITS));
    s.folio.redeem(&s.user, &(100 * D7));
    assert_eq!(s.folio.total_supply(), 0);
    let bals = s.folio.balances();
    for i in 0..3u32 {
        assert_eq!(bals.get_unchecked(i), 0);
    }
}

#[test]
fn redeem_works_while_paused_and_with_dead_oracle() {
    let s = setup();
    s.folio.init_mint(&s.user, &deposits(&s, GOOD_DEPOSITS));
    s.folio.set_paused(&true);
    // stale everything — redeem must not care
    for i in 0..3u32 {
        let t = s.tokens.get_unchecked(i);
        s.feed
            .set_price(&OracleAsset::Stellar(t), &PRICES[i as usize], &0u64);
    }
    let outs = s.folio.redeem(&s.user, &(100 * D7));
    assert_eq!(outs.get_unchecked(0), GOOD_DEPOSITS[0]);
}

#[test]
fn redeem_before_bootstrap_errors_cleanly() {
    let s = setup();
    assert_eq!(
        s.folio.try_redeem(&s.user, &(10 * D7)),
        Err(Ok(FolioError::NotBootstrapped.into()))
    );
}

#[test]
fn redeem_rejects_more_than_balance() {
    let s = setup();
    s.folio.init_mint(&s.user, &deposits(&s, GOOD_DEPOSITS));
    assert!(s.folio.try_redeem(&s.user, &(101 * D7)).is_err());
}

// --- pause / admin ---

#[test]
fn pause_blocks_mint_paths_only() {
    let s = setup();
    s.folio.set_paused(&true);
    assert_eq!(
        s.folio.try_init_mint(&s.user, &deposits(&s, GOOD_DEPOSITS)),
        Err(Ok(FolioError::Paused.into()))
    );
    s.folio.set_paused(&false);
    s.folio.init_mint(&s.user, &deposits(&s, GOOD_DEPOSITS));
    s.folio.set_paused(&true);
    let max = deposits(&s, [i128::MAX >> 1, i128::MAX >> 1, i128::MAX >> 1]);
    assert_eq!(
        s.folio.try_mint(&s.user, &(10 * D7), &max),
        Err(Ok(FolioError::Paused.into()))
    );
}

// --- construction guards ---

#[test]
#[should_panic(expected = "Error(Contract, #1)")] // BadConfig
fn constructor_rejects_bad_weights() {
    let s = setup();
    s.e.register(
        NebulaFolio,
        (
            &s.admin,
            &s.folio.router(),
            String::from_str(&s.e, "Bad"),
            String::from_str(&s.e, "BAD"),
            s.tokens.clone(),
            vec![&s.e, 5_000u32, 3_000u32, 1_000u32], // sums to 9000
        ),
    );
}

#[test]
#[should_panic(expected = "Error(Contract, #1)")] // BadConfig
fn constructor_rejects_duplicate_tokens() {
    let s = setup();
    let t0 = s.tokens.get_unchecked(0);
    s.e.register(
        NebulaFolio,
        (
            &s.admin,
            &s.folio.router(),
            String::from_str(&s.e, "Bad"),
            String::from_str(&s.e, "BAD"),
            vec![&s.e, t0.clone(), t0.clone()],
            vec![&s.e, 5_000u32, 5_000u32],
        ),
    );
}

// --- share token surface ---

#[test]
fn share_token_metadata_and_transfer() {
    let s = setup();
    assert_eq!(s.folio.decimals(), 7);
    assert_eq!(s.folio.symbol(), String::from_str(&s.e, "SEF"));
    s.folio.init_mint(&s.user, &deposits(&s, GOOD_DEPOSITS));
    let user2 = Address::generate(&s.e);
    s.folio.transfer(&s.user, &user2, &(10 * D7));
    assert_eq!(s.folio.balance(&user2), 10 * D7);
    // transferee can redeem
    let outs = s.folio.redeem(&user2, &(10 * D7));
    assert_eq!(outs.get_unchecked(0), GOOD_DEPOSITS[0] / 10);
}

// --- mint_single_asset ---
// Basket is tokens[0]="XLM" 50% / tokens[1]="USDC" 30% / tokens[2]="AQUA" 20%
// at prices $0.25 / $1.00 / $0.0004 (see PRICES/WEIGHTS above). Depositing
// tokens[0]: its own value-slice stays as tokens[0], the other two slices
// swap through the mock router. Mock rate is OUTPUT-per-input, 7-dec fixed
// point: amount_out = amount_in * rate / 10^7.

const DEADLINE: u64 = NOW + 300;

// rates that exactly match the oracle cross-rates (zero slippage):
//   token0->token1: $0.25 -> $1.00, so 0.25 out per in -> 0.25 * 10^7
const RATE_T0_T1_FAIR: i128 = 2_500_000;
//   token0->token2: $0.25 -> $0.0004, so 625 out per in -> 625 * 10^7
const RATE_T0_T2_FAIR: i128 = 6_250_000_000;

struct SingleAssetSetup {
    s: Setup,
    depositor: Address,
}

/// Wires a mock router with the given token0->token1 / token0->token2 rates,
/// funds it to pay out, and funds a fresh depositor with 1,000 token0 only.
fn setup_single_asset(rate_1: i128, rate_2: i128) -> SingleAssetSetup {
    let s = setup();
    s.folio.init_mint(&s.user, &deposits(&s, GOOD_DEPOSITS));

    let router_id = s.e.register(MockSoroswapRouter, (&s.admin,));
    let router = MockSoroswapRouterClient::new(&s.e, &router_id);
    let t0 = s.tokens.get_unchecked(0);
    let t1 = s.tokens.get_unchecked(1);
    let t2 = s.tokens.get_unchecked(2);
    router.set_rate(&t0, &t1, &rate_1);
    router.set_rate(&t0, &t2, &rate_2);
    // fund the router (acts as its own pool) so it can pay outputs
    s.sac_admins[1].mint(&router_id, &(1_000_000 * D7));
    s.sac_admins[2].mint(&router_id, &(1_000_000_000 * D7));

    s.folio.set_soroswap_router(&router_id);

    let depositor = Address::generate(&s.e);
    s.sac_admins[0].mint(&depositor, &(1_000 * D7));

    SingleAssetSetup { s, depositor }
}

#[test]
fn mint_single_asset_mints_fair_shares() {
    // deposit 40 token0 (=$10) into a $100 folio. Split by value: 50% stays
    // as token0 (20), 30% -> token1 (12 t0 -> 3 t1), 20% -> token2 (8 t0 ->
    // 5000 t2). Value added = $10 -> 10 shares at $1.00/share.
    let sa = setup_single_asset(RATE_T0_T1_FAIR, RATE_T0_T2_FAIR);
    let t0 = sa.s.tokens.get_unchecked(0);
    let shares = sa.s.folio.mint_single_asset(&sa.depositor, &t0, &(40 * D7), &(10 * D7), &DEADLINE);

    assert_eq!(shares, 10 * D7);
    assert_eq!(sa.s.folio.balance(&sa.depositor), 10 * D7);
    // depositor spent the whole deposit (no refund in exact-input design)
    assert_eq!(
        TokenClient::new(&sa.s.e, &t0).balance(&sa.depositor),
        1_000 * D7 - 40 * D7
    );
    // basket grew proportionally
    let bals = sa.s.folio.balances();
    assert_eq!(bals.get_unchecked(0), GOOD_DEPOSITS[0] + 20 * D7);
    assert_eq!(bals.get_unchecked(1), GOOD_DEPOSITS[1] + 3 * D7);
    assert_eq!(bals.get_unchecked(2), GOOD_DEPOSITS[2] + 5_000 * D7);
    // NAV/share preserved: $110 over 110 shares = $1.00
    assert_eq!(sa.s.folio.nav().per_share, 10i128.pow(14));
}

#[test]
fn mint_single_asset_slippage_reduces_shares_and_can_trip_min() {
    // token1 leg pays only half the fair rate: 12 t0 -> 1.5 t1 instead of 3.
    // value added = 55 (t0) + 31.5 (t1) + 22 (t2) - 100 = $8.5 -> 8.5 shares.
    // depositor bears the slippage; existing holders are NOT diluted.
    let sa = setup_single_asset(RATE_T0_T1_FAIR / 2, RATE_T0_T2_FAIR);
    let t0 = sa.s.tokens.get_unchecked(0);

    // demanding 10 shares reverts - only 8.5 of value actually landed
    assert_eq!(
        sa.s.folio.try_mint_single_asset(&sa.depositor, &t0, &(40 * D7), &(10 * D7), &DEADLINE),
        Err(Ok(FolioError::SlippageExceeded.into()))
    );
    // accepting the honest 8.5 succeeds, and NAV/share never drops below $1
    let shares = sa.s.folio.mint_single_asset(&sa.depositor, &t0, &(40 * D7), &(8 * D7), &DEADLINE);
    assert_eq!(shares, 85_000_000); // 8.5 shares
    assert!(sa.s.folio.nav().per_share >= 10i128.pow(14));
}

#[test]
fn mint_single_asset_rejects_when_paused() {
    let sa = setup_single_asset(RATE_T0_T1_FAIR, RATE_T0_T2_FAIR);
    sa.s.folio.set_paused(&true);
    assert_eq!(
        sa.s.folio.try_mint_single_asset(
            &sa.depositor,
            &sa.s.tokens.get_unchecked(0),
            &(40 * D7),
            &(10 * D7),
            &DEADLINE,
        ),
        Err(Ok(FolioError::Paused.into()))
    );
}

#[test]
fn mint_single_asset_requires_bootstrap() {
    let s = setup(); // no init_mint
    let router_id = s.e.register(MockSoroswapRouter, (&s.admin,));
    s.folio.set_soroswap_router(&router_id);
    let depositor = Address::generate(&s.e);
    s.sac_admins[0].mint(&depositor, &(1_000 * D7));
    assert_eq!(
        s.folio.try_mint_single_asset(
            &depositor,
            &s.tokens.get_unchecked(0),
            &(40 * D7),
            &(1),
            &DEADLINE,
        ),
        Err(Ok(FolioError::NotBootstrapped.into()))
    );
}

#[test]
fn mint_single_asset_rejects_expired_deadline() {
    let sa = setup_single_asset(RATE_T0_T1_FAIR, RATE_T0_T2_FAIR);
    assert_eq!(
        sa.s.folio.try_mint_single_asset(
            &sa.depositor,
            &sa.s.tokens.get_unchecked(0),
            &(40 * D7),
            &(10 * D7),
            &(NOW - 1),
        ),
        Err(Ok(FolioError::DeadlinePassed.into()))
    );
}

#[test]
fn mint_single_asset_rejects_below_min_shares_out() {
    let sa = setup_single_asset(RATE_T0_T1_FAIR, RATE_T0_T2_FAIR);
    // demand more shares than the deposit's value can buy (10 possible, ask 11)
    assert_eq!(
        sa.s.folio.try_mint_single_asset(
            &sa.depositor,
            &sa.s.tokens.get_unchecked(0),
            &(40 * D7),
            &(11 * D7),
            &DEADLINE,
        ),
        Err(Ok(FolioError::SlippageExceeded.into()))
    );
}

#[test]
fn mint_single_asset_rejects_when_soroswap_not_configured() {
    let s = setup();
    s.folio.init_mint(&s.user, &deposits(&s, GOOD_DEPOSITS));
    let depositor = Address::generate(&s.e);
    s.sac_admins[0].mint(&depositor, &(1_000 * D7));
    assert_eq!(
        s.folio.try_mint_single_asset(
            &depositor,
            &s.tokens.get_unchecked(0),
            &(40 * D7),
            &(1),
            &DEADLINE,
        ),
        Err(Ok(FolioError::SoroswapNotConfigured.into()))
    );
}
