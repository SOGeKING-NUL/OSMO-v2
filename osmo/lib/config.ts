// Public testnet deployment defaults. Env vars can override these after a
// redeploy, but local/Vercel env drift should not blank the frontend.
//
// Next.js inlines `process.env.NEXT_PUBLIC_*` at build time only when referenced
// as a full literal, so each var is spelled out here rather than looped over.

const CURRENT_TESTNET = {
  NETWORK_PASSPHRASE: "Test SDF Network ; September 2015",
  RPC_URL: "https://soroban-testnet.stellar.org",
  HORIZON_URL: "https://horizon-testnet.stellar.org",
  TEST_ISSUER: "GDIYTKW2SS3OVYPHZJ2QOJSSKVPME5GQLRHDJNZ3OZRP6QJHAEFXTZT3",
  FOLIO_ID: "CCOMNDEZSPR7ZXCPCVOKCGQEPAG33UAYTTR526P63P7HIPEXPJXVCQKB",
  ROUTER_ID: "CDNQIEPDPXERUSA3NT7XOY7TTO2DDQLJN2QHDQF5WECYT2I7VDUDMJJP",
  TOKEN_XLM: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
  TOKEN_TSTAQUA: "CBGN3EZONL2CJK4342UBBMNVTQRX2DD6QSE45EKEGCYHCE5W76CTV37L",
  TOKEN_TSTVELO: "CCKCOVTJ7V3VXZYUJXMNQZT6O5JEX6CKCGXW3HCJSIYMTLAX2K6E5Z3T",
  TOKEN_TSTUSDC: "CAK7ZU7IWDNJWB5W4F73RDNAYQMO5DVHDNGL5NLUYCGWTYDWF444VMX7",
  TOKEN_TSTEURC: "CAHXEUFDYCQ6GHFXL52CFSPAOMYIJHFDHN7B2NO6ZRRXFRNLLSHMYJXX",
  POOL_TSTAQUA_XLM: "CCC3VMBMHZDKCMIMUP6R4F5S5BFLU3KMEVESHAVPGEQSVKOE7VEUSWGA",
  POOL_TSTVELO_XLM: "CBJDDMLEODNQ3T74C6JD33WC4I2LO2ZNY6T2SA3AWRV36S37FP2MPHDX",
  POOL_TSTUSDC_XLM: "CAO4ISEQ5PO3TCXOTDYI3OMZVE3OKNFDJUKWQ43PR4P36XSW5KHMY5G3",
  POOL_TSTEURC_XLM: "CDZCWDK7MI6QH3XLHIEDG3UXNGPCFODCXEPQWKOP7E6L4OI6KB5TYVBD",
};

function publicEnv(value: string | undefined, fallback: string): string {
  return value?.trim() || fallback;
}

export const NETWORK_PASSPHRASE = publicEnv(
  process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE,
  CURRENT_TESTNET.NETWORK_PASSPHRASE,
);
export const RPC_URL = publicEnv(process.env.NEXT_PUBLIC_RPC_URL, CURRENT_TESTNET.RPC_URL);
export const HORIZON_URL = publicEnv(
  process.env.NEXT_PUBLIC_HORIZON_URL,
  CURRENT_TESTNET.HORIZON_URL,
);
export const FOLIO_ID = publicEnv(process.env.NEXT_PUBLIC_FOLIO_ID, CURRENT_TESTNET.FOLIO_ID);
export const ROUTER_ID = publicEnv(process.env.NEXT_PUBLIC_ROUTER_ID, CURRENT_TESTNET.ROUTER_ID);

/** Native XLM SAC — the single-asset deposit / pool hub. */
export const XLM_TOKEN = publicEnv(
  process.env.NEXT_PUBLIC_TOKEN_XLM,
  CURRENT_TESTNET.TOKEN_XLM,
);

const TSTAQUA_TOKEN = publicEnv(
  process.env.NEXT_PUBLIC_TOKEN_TSTAQUA,
  CURRENT_TESTNET.TOKEN_TSTAQUA,
);
const TSTVELO_TOKEN = publicEnv(
  process.env.NEXT_PUBLIC_TOKEN_TSTVELO,
  CURRENT_TESTNET.TOKEN_TSTVELO,
);
const TSTUSDC_TOKEN = publicEnv(
  process.env.NEXT_PUBLIC_TOKEN_TSTUSDC,
  CURRENT_TESTNET.TOKEN_TSTUSDC,
);
const TSTEURC_TOKEN = publicEnv(
  process.env.NEXT_PUBLIC_TOKEN_TSTEURC,
  CURRENT_TESTNET.TOKEN_TSTEURC,
);

/**
 * Seeded Soroswap XLM-hub pools we read reserves from for the Pools page.
 * (Read directly from chain — the public Soroswap testnet dashboard indexes
 * pools through its own pipeline and doesn't list ones created outside its UI.)
 */
export const POOLS = [
  {
    pair: "tstAQUA / XLM",
    id: publicEnv(process.env.NEXT_PUBLIC_POOL_TSTAQUA_XLM, CURRENT_TESTNET.POOL_TSTAQUA_XLM),
    token: TSTAQUA_TOKEN,
  },
  {
    pair: "tstVELO / XLM",
    id: publicEnv(process.env.NEXT_PUBLIC_POOL_TSTVELO_XLM, CURRENT_TESTNET.POOL_TSTVELO_XLM),
    token: TSTVELO_TOKEN,
  },
  {
    pair: "tstUSDC / XLM",
    id: publicEnv(process.env.NEXT_PUBLIC_POOL_TSTUSDC_XLM, CURRENT_TESTNET.POOL_TSTUSDC_XLM),
    token: TSTUSDC_TOKEN,
  },
  {
    pair: "tstEURC / XLM",
    id: publicEnv(process.env.NEXT_PUBLIC_POOL_TSTEURC_XLM, CURRENT_TESTNET.POOL_TSTEURC_XLM),
    token: TSTEURC_TOKEN,
  },
];

/**
 * Classic (non-native) assets in the basket - each requires the holder to
 * establish a trustline before they can receive it (see lib/folio.ts
 * getMissingTrustlines). XLM is native and needs no trustline.
 */
export const TRUSTLINE_ASSETS = [
  {
    code: "tstAQUA",
    issuer: publicEnv(process.env.NEXT_PUBLIC_TEST_ISSUER, CURRENT_TESTNET.TEST_ISSUER),
  },
  {
    code: "tstVELO",
    issuer: publicEnv(process.env.NEXT_PUBLIC_TEST_ISSUER, CURRENT_TESTNET.TEST_ISSUER),
  },
  {
    code: "tstUSDC",
    issuer: publicEnv(process.env.NEXT_PUBLIC_TEST_ISSUER, CURRENT_TESTNET.TEST_ISSUER),
  },
  {
    code: "tstEURC",
    issuer: publicEnv(process.env.NEXT_PUBLIC_TEST_ISSUER, CURRENT_TESTNET.TEST_ISSUER),
  },
];

/** TESTNET ONLY - see .env.example for why this is safe to ship client-side here. */
export const TEST_ISSUER_SECRET = process.env.NEXT_PUBLIC_TEST_ISSUER_SECRET ?? "";

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
  [XLM_TOKEN]: { symbol: "XLM", color: "#7b68ee" },
  [TSTAQUA_TOKEN]: { symbol: "tstAQUA", color: "#9f4ef5" },
  [TSTVELO_TOKEN]: { symbol: "tstVELO", color: "#f5a623", simulated: true },
  [TSTUSDC_TOKEN]: { symbol: "tstUSDC", color: "#2775ca" },
  [TSTEURC_TOKEN]: { symbol: "tstEURC", color: "#1a9c6b" },
};

export const SHARE_DECIMALS = 7;
export const PRICE_DECIMALS = 14;
