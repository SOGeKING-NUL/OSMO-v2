// All contract addresses live in .env (see that file for how to update after
// a redeploy) - this module just reads them and attaches display metadata.

const env = import.meta.env;

export const NETWORK_PASSPHRASE = env.VITE_NETWORK_PASSPHRASE;
export const RPC_URL = env.VITE_RPC_URL;
export const HORIZON_URL = env.VITE_HORIZON_URL;
export const AQUARIUS_ID = env.VITE_AQUARIUS_ID || "CBQDHNBFBZYE4MKPWBSJOPIYLW4SFSXAXUTSXJN76GNKYVYPCKWC6QUK";
export const FOLIO_ID = env.VITE_FOLIO_ID;
export const ROUTER_ID = env.VITE_ROUTER_ID;

/** Native XLM SAC — the single-asset deposit / pool hub. */
export const XLM_TOKEN = env.VITE_TOKEN_XLM;

/**
 * Aquarius XLM-hub pool-index hashes used by the Pools page and deployment
 * route wiring. Populate these from Aquarius pool/path discovery for the
 * exact token contracts in the basket.
 */
export const POOLS = [
  { pair: "tstAQUA / XLM", id: env.VITE_POOL_TSTAQUA_XLM || "UNCONFIGURED_TSTAQUA_XLM", token: env.VITE_TOKEN_TSTAQUA },
  { pair: "tstVELO / XLM", id: env.VITE_POOL_TSTVELO_XLM || "UNCONFIGURED_TSTVELO_XLM", token: env.VITE_TOKEN_TSTVELO },
  { pair: "tstUSDC / XLM", id: env.VITE_POOL_TSTUSDC_XLM || "UNCONFIGURED_TSTUSDC_XLM", token: env.VITE_TOKEN_TSTUSDC },
  { pair: "tstEURC / XLM", id: env.VITE_POOL_TSTEURC_XLM || "UNCONFIGURED_TSTEURC_XLM", token: env.VITE_TOKEN_TSTEURC },
];

/**
 * Classic (non-native) assets in the basket - each requires the holder to
 * establish a trustline before they can receive it (see lib/folio.ts
 * ensureTrustlines). XLM is native and needs no trustline.
 */
export const TRUSTLINE_ASSETS = [
  { code: "tstAQUA", issuer: env.VITE_TEST_ISSUER },
  { code: "tstVELO", issuer: env.VITE_TEST_ISSUER },
  { code: "tstUSDC", issuer: env.VITE_TEST_ISSUER },
  { code: "tstEURC", issuer: env.VITE_TEST_ISSUER },
];

/** TESTNET ONLY - see .env for why this is safe to ship client-side here. */
export const TEST_ISSUER_SECRET = env.VITE_TEST_ISSUER_SECRET;

/** One drip's worth of each asset, in whole-token units (not stroops/units). */
export const FAUCET_AMOUNTS: Record<string, string> = {
  XLM: "20",
  tstAQUA: "1000000",
  tstVELO: "10000",
  tstUSDC: "1000",
  tstEURC: "1000",
};

/**
 * Display metadata per underlying token (SAC contract id -> info).
 * tst-prefixed tokens are self-issued testnet stand-ins whose ORACLE PRICE is
 * relayed from real mainnet Reflector data (scripts/price-relay.ps1) - except
 * tstVELO, which has no real Reflector coverage and uses a simulated price
 * (see docs/CHALLENGES_AND_DECISIONS.md).
 */
export const TOKEN_INFO: Record<string, { symbol: string; color: string; simulated?: boolean }> = {
  [env.VITE_TOKEN_XLM]: { symbol: "XLM", color: "#7b68ee" },
  [env.VITE_TOKEN_TSTAQUA]: { symbol: "tstAQUA", color: "#9f4ef5" },
  [env.VITE_TOKEN_TSTVELO]: { symbol: "tstVELO", color: "#f5a623", simulated: true },
  [env.VITE_TOKEN_TSTUSDC]: { symbol: "tstUSDC", color: "#2775ca" },
  [env.VITE_TOKEN_TSTEURC]: { symbol: "tstEURC", color: "#1a9c6b" },
};

export const SHARE_DECIMALS = 7;
export const PRICE_DECIMALS = 14;
