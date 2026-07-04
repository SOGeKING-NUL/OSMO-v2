//! OracleRouter v2 — one deployment shared by all Folios (ADR-005, ADR-010).
//!
//! Maps a Stellar token to one or two SEP-40 feeds (Reflector primary, DIA
//! secondary) and returns a validated price: positive, fresh, normalized to
//! `PRICE_DECIMALS`.
//!
//! Two-source semantics (the divergence circuit breaker):
//! - both feeds valid → prices must agree within `max_divergence_bps`,
//!   else the call traps (`Divergence`) and everything priced through the
//!   router (bootstrap, nav) halts until feeds re-converge or admin repoints;
//! - one feed valid → used only if `allow_single` is set, else `SingleSource`;
//! - none valid → the most specific error from the primary feed.
//!
//! Recurring Folio mint/redeem never touch this contract (ADR-011), so a
//! tripped breaker can never trap user funds.

#![no_std]

use nebula_interfaces::{OracleAsset, PriceData, Sep40Client, PRICE_DECIMALS};
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, Address, Env, Vec,
};

// ~1 day / ~30 days at 5s ledgers: keep instance state alive while used.
const TTL_THRESHOLD: u32 = 17_280;
const TTL_EXTEND: u32 = 518_400;

const MAX_FEEDS: u32 = 2;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum RouterError {
    NoFeed = 1,
    NoPrice = 2,
    StalePrice = 3,
    InvalidPrice = 4,
    Divergence = 5,
    SingleSource = 6,
    BadConfig = 7,
}

/// Where to get one price for one token.
#[contracttype]
#[derive(Clone)]
pub struct FeedSpec {
    /// SEP-40 contract (Reflector / DIA / mock).
    pub feed: Address,
    /// Identifier the feed knows the asset by (not necessarily our token
    /// address — e.g. testnet TAQUA maps to Reflector's `Other("AQUA")`).
    pub asset: OracleAsset,
    /// Feed's price decimals, cached at registration.
    pub feed_decimals: u32,
}

#[contracttype]
enum DataKey {
    Admin,
    MaxAgeSecs,
    MaxDivergenceBps,
    AllowSingle,
    Feeds(Address),
}

#[contract]
pub struct NebulaOracleRouter;

#[contractimpl]
impl NebulaOracleRouter {
    /// `max_divergence_bps`: max relative gap between two valid feeds
    /// (e.g. 500 = 5%). `allow_single`: accept one valid feed when the other
    /// is down/stale (true is pragmatic; false is strict dual-source).
    pub fn __constructor(
        e: Env,
        admin: Address,
        max_age_secs: u64,
        max_divergence_bps: u32,
        allow_single: bool,
    ) {
        e.storage().instance().set(&DataKey::Admin, &admin);
        e.storage().instance().set(&DataKey::MaxAgeSecs, &max_age_secs);
        e.storage()
            .instance()
            .set(&DataKey::MaxDivergenceBps, &max_divergence_bps);
        e.storage().instance().set(&DataKey::AllowSingle, &allow_single);
    }

    /// Register (or replace) the 1–2 feeds used to price `token`.
    /// Order matters: feeds[0] is primary — its error is reported when no
    /// source is usable.
    pub fn set_feeds(e: Env, token: Address, feeds: Vec<(Address, OracleAsset)>) {
        Self::admin(e.clone()).require_auth();
        if feeds.is_empty() || feeds.len() > MAX_FEEDS {
            panic_with_error!(&e, RouterError::BadConfig);
        }
        let mut specs: Vec<FeedSpec> = Vec::new(&e);
        for i in 0..feeds.len() {
            let (feed, asset) = feeds.get_unchecked(i);
            let feed_decimals = Sep40Client::new(&e, &feed).decimals();
            specs.push_back(FeedSpec { feed, asset, feed_decimals });
        }
        e.storage().instance().set(&DataKey::Feeds(token), &specs);
    }

    pub fn set_max_age(e: Env, max_age_secs: u64) {
        Self::admin(e.clone()).require_auth();
        e.storage().instance().set(&DataKey::MaxAgeSecs, &max_age_secs);
    }

    pub fn set_divergence(e: Env, max_divergence_bps: u32) {
        Self::admin(e.clone()).require_auth();
        e.storage()
            .instance()
            .set(&DataKey::MaxDivergenceBps, &max_divergence_bps);
    }

    pub fn set_allow_single(e: Env, allow_single: bool) {
        Self::admin(e.clone()).require_auth();
        e.storage().instance().set(&DataKey::AllowSingle, &allow_single);
    }

    /// Validated USD price of `token`, normalized to `PRICE_DECIMALS`.
    /// With two valid sources returns their midpoint (median of 2) and the
    /// older timestamp; traps on divergence beyond `max_divergence_bps`.
    pub fn price(e: Env, token: Address) -> PriceData {
        e.storage().instance().extend_ttl(TTL_THRESHOLD, TTL_EXTEND);
        let specs: Vec<FeedSpec> = e
            .storage()
            .instance()
            .get(&DataKey::Feeds(token))
            .unwrap_or_else(|| panic_with_error!(&e, RouterError::NoFeed));

        let max_age: u64 = e.storage().instance().get(&DataKey::MaxAgeSecs).unwrap();
        let mut valid: Vec<PriceData> = Vec::new(&e);
        let mut first_err: Option<RouterError> = None;
        for i in 0..specs.len() {
            match fetch_one(&e, &specs.get_unchecked(i), max_age) {
                Ok(pd) => valid.push_back(pd),
                Err(err) => {
                    if first_err.is_none() {
                        first_err = Some(err);
                    }
                }
            }
        }

        match valid.len() {
            0 => panic_with_error!(&e, first_err.unwrap_or(RouterError::NoPrice)),
            1 => {
                let allow_single: bool =
                    e.storage().instance().get(&DataKey::AllowSingle).unwrap();
                if specs.len() > 1 && !allow_single {
                    panic_with_error!(&e, RouterError::SingleSource);
                }
                valid.get_unchecked(0)
            }
            _ => {
                let a = valid.get_unchecked(0);
                let b = valid.get_unchecked(1);
                let (lo, hi) = if a.price <= b.price {
                    (a.price, b.price)
                } else {
                    (b.price, a.price)
                };
                let max_div: u32 = e
                    .storage()
                    .instance()
                    .get(&DataKey::MaxDivergenceBps)
                    .unwrap();
                // (hi - lo) / lo > max_div / 10_000  → circuit break
                if (hi - lo)
                    .checked_mul(10_000)
                    .unwrap_or_else(|| panic_with_error!(&e, RouterError::InvalidPrice))
                    > lo
                        .checked_mul(max_div as i128)
                        .unwrap_or_else(|| panic_with_error!(&e, RouterError::InvalidPrice))
                {
                    panic_with_error!(&e, RouterError::Divergence);
                }
                PriceData {
                    price: (a.price + b.price) / 2,
                    timestamp: a.timestamp.min(b.timestamp),
                }
            }
        }
    }

    // --- views ---

    pub fn admin(e: Env) -> Address {
        e.storage().instance().get(&DataKey::Admin).unwrap()
    }

    pub fn max_age(e: Env) -> u64 {
        e.storage().instance().get(&DataKey::MaxAgeSecs).unwrap()
    }

    pub fn divergence_bps(e: Env) -> u32 {
        e.storage().instance().get(&DataKey::MaxDivergenceBps).unwrap()
    }

    pub fn allow_single(e: Env) -> bool {
        e.storage().instance().get(&DataKey::AllowSingle).unwrap()
    }

    pub fn feeds(e: Env, token: Address) -> Option<Vec<FeedSpec>> {
        e.storage().instance().get(&DataKey::Feeds(token))
    }
}

/// Fetch + validate one feed. `try_lastprice` so a broken feed contract
/// degrades to an error instead of trapping the whole transaction.
fn fetch_one(e: &Env, spec: &FeedSpec, max_age: u64) -> Result<PriceData, RouterError> {
    let pd = match Sep40Client::new(e, &spec.feed).try_lastprice(&spec.asset) {
        Ok(Ok(Some(pd))) => pd,
        _ => return Err(RouterError::NoPrice),
    };
    if pd.price <= 0 {
        return Err(RouterError::InvalidPrice);
    }
    // ponytail: some feeds report ms, most report seconds. >1e11 can only
    // be ms (1e11 s = year 5138); normalize instead of a per-feed flag.
    let ts = if pd.timestamp > 100_000_000_000 {
        pd.timestamp / 1000
    } else {
        pd.timestamp
    };
    let now = e.ledger().timestamp();
    if ts > now || now - ts > max_age {
        return Err(RouterError::StalePrice);
    }
    Ok(PriceData {
        price: normalize(e, pd.price, spec.feed_decimals),
        timestamp: ts,
    })
}

/// Rescale `price` from `from_decimals` to `PRICE_DECIMALS`.
fn normalize(e: &Env, price: i128, from_decimals: u32) -> i128 {
    if from_decimals == PRICE_DECIMALS {
        price
    } else if from_decimals < PRICE_DECIMALS {
        price
            .checked_mul(10i128.pow(PRICE_DECIMALS - from_decimals))
            .unwrap_or_else(|| panic_with_error!(e, RouterError::InvalidPrice))
    } else {
        price / 10i128.pow(from_decimals - PRICE_DECIMALS)
    }
}

#[cfg(test)]
mod test;
