// All contract addresses live in .env.local (see .env.example for how to update
// after a redeploy) - this module just reads them and attaches display metadata.
//
// Next.js inlines `process.env.NEXT_PUBLIC_*` at build time only when referenced
// as a full literal, so each var is spelled out here rather than looped over.

export const NETWORK_PASSPHRASE = process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE as string;
export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL as string;
export const HORIZON_URL = process.env.NEXT_PUBLIC_HORIZON_URL as string;
export const FOLIO_ID = process.env.NEXT_PUBLIC_FOLIO_ID as string;
export const ROUTER_ID = process.env.NEXT_PUBLIC_ROUTER_ID as string;

/** Native XLM SAC — the single-asset deposit / pool hub. */
export const XLM_TOKEN = process.env.NEXT_PUBLIC_TOKEN_XLM as string;

/**
 * Seeded Soroswap XLM-hub pools we read reserves from for the Pools page.
 * (Read directly from chain — the public Soroswap testnet dashboard indexes
 * pools through its own pipeline and doesn't list ones created outside its UI.)
 */
export const POOLS = [
  { pair: "tstAQUA / XLM", id: process.env.NEXT_PUBLIC_POOL_TSTAQUA_XLM as string, token: process.env.NEXT_PUBLIC_TOKEN_TSTAQUA as string },
  { pair: "tstVELO / XLM", id: process.env.NEXT_PUBLIC_POOL_TSTVELO_XLM as string, token: process.env.NEXT_PUBLIC_TOKEN_TSTVELO as string },
  { pair: "tstUSDC / XLM", id: process.env.NEXT_PUBLIC_POOL_TSTUSDC_XLM as string, token: process.env.NEXT_PUBLIC_TOKEN_TSTUSDC as string },
  { pair: "tstEURC / XLM", id: process.env.NEXT_PUBLIC_POOL_TSTEURC_XLM as string, token: process.env.NEXT_PUBLIC_TOKEN_TSTEURC as string },
];

/**
 * Classic (non-native) assets in the basket - each requires the holder to
 * establish a trustline before they can receive it (see lib/folio.ts
 * getMissingTrustlines). XLM is native and needs no trustline.
 */
export const TRUSTLINE_ASSETS = [
  { code: "tstAQUA", issuer: process.env.NEXT_PUBLIC_TEST_ISSUER as string },
  { code: "tstVELO", issuer: process.env.NEXT_PUBLIC_TEST_ISSUER as string },
  { code: "tstUSDC", issuer: process.env.NEXT_PUBLIC_TEST_ISSUER as string },
  { code: "tstEURC", issuer: process.env.NEXT_PUBLIC_TEST_ISSUER as string },
];

/** TESTNET ONLY - see .env.example for why this is safe to ship client-side here. */
export const TEST_ISSUER_SECRET = process.env.NEXT_PUBLIC_TEST_ISSUER_SECRET as string;

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
  [process.env.NEXT_PUBLIC_TOKEN_XLM as string]: { symbol: "XLM", color: "#7b68ee" },
  [process.env.NEXT_PUBLIC_TOKEN_TSTAQUA as string]: { symbol: "tstAQUA", color: "#9f4ef5" },
  [process.env.NEXT_PUBLIC_TOKEN_TSTVELO as string]: { symbol: "tstVELO", color: "#f5a623", simulated: true },
  [process.env.NEXT_PUBLIC_TOKEN_TSTUSDC as string]: { symbol: "tstUSDC", color: "#2775ca" },
  [process.env.NEXT_PUBLIC_TOKEN_TSTEURC as string]: { symbol: "tstEURC", color: "#1a9c6b" },
};

export const SHARE_DECIMALS = 7;
export const PRICE_DECIMALS = 14;
