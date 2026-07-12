// Thin wrapper around the dynamic Soroban contract client.
// contract.Client.from fetches the contract spec from the chain, so there is
// no codegen bindings package to maintain (ADR-013).

import {
  getAddress,
  isAllowed,
  isConnected,
  requestAccess,
  signTransaction,
} from "@stellar/freighter-api";
import {
  Asset,
  BASE_FEE,
  Horizon,
  Operation,
  TransactionBuilder,
  contract,
} from "@stellar/stellar-sdk";
import {
  FOLIO_ID,
  HORIZON_URL,
  NETWORK_PASSPHRASE,
  ROUTER_ID,
  RPC_URL,
  TRUSTLINE_ASSETS,
} from "@/lib/config";

export interface AssetInfo {
  token: string;
  weight_bps: number;
  decimals: number;
}
export interface NavInfo {
  total_value: bigint;
  per_share: bigint;
}
export interface PriceData {
  price: bigint;
  timestamp: bigint;
}

type AnyClient = contract.Client & Record<string, any>;

let readClient: AnyClient | undefined;
let routerClient: AnyClient | undefined;

async function getReadClient(): Promise<AnyClient> {
  if (!readClient) {
    readClient = (await contract.Client.from({
      contractId: FOLIO_ID,
      networkPassphrase: NETWORK_PASSPHRASE,
      rpcUrl: RPC_URL,
    })) as AnyClient;
  }
  return readClient;
}

async function getRouterClient(): Promise<AnyClient> {
  if (!routerClient) {
    routerClient = (await contract.Client.from({
      contractId: ROUTER_ID,
      networkPassphrase: NETWORK_PASSPHRASE,
      rpcUrl: RPC_URL,
    })) as AnyClient;
  }
  return routerClient;
}

/** Client bound to the connected wallet, for state-changing calls. */
async function getWriteClient(publicKey: string): Promise<AnyClient> {
  return (await contract.Client.from({
    contractId: FOLIO_ID,
    networkPassphrase: NETWORK_PASSPHRASE,
    rpcUrl: RPC_URL,
    publicKey,
    signTransaction: (xdr: string, opts?: any) =>
      signTransaction(xdr, {
        networkPassphrase: opts?.networkPassphrase ?? NETWORK_PASSPHRASE,
        address: publicKey,
      }),
  })) as AnyClient;
}

// --- wallet ---

/** True when the Freighter extension is present in this browser. */
export async function isFreighterAvailable(): Promise<boolean> {
  try {
    const res = await isConnected();
    return !!res.isConnected;
  } catch {
    return false;
  }
}

export async function connectWallet(): Promise<string> {
  const access = await requestAccess();
  if (access.error) throw new Error(access.error);
  const addr = await getAddress();
  if (addr.error) throw new Error(addr.error);
  return addr.address;
}

/**
 * Silent re-connect for page reloads: succeeds only if the user has already
 * authorized this site in Freighter, and never opens a popup. Returns null
 * when not previously authorized or the extension is unavailable.
 */
export async function reconnectWallet(): Promise<string | null> {
  try {
    const allowed = await isAllowed();
    if (allowed.error || !allowed.isAllowed) return null;
    const addr = await getAddress();
    if (addr.error || !addr.address) return null;
    return addr.address;
  } catch {
    return null;
  }
}

// --- trustlines ---
// Classic (non-native) Stellar assets - every basket token except XLM -
// cannot be held by an account until it explicitly trusts that asset. This
// is a base-ledger requirement, unrelated to our contracts; skipping it is
// why a fresh wallet's first mint fails with "trustline entry is missing".

const horizon = new Horizon.Server(HORIZON_URL);

/** Which of the basket's classic assets `publicKey` has NOT yet trusted. */
export async function getMissingTrustlines(
  publicKey: string,
): Promise<{ code: string; issuer: string }[]> {
  const account = await horizon.loadAccount(publicKey);
  const trusted = new Set(
    account.balances
      .filter((b): b is typeof b & { asset_code: string; asset_issuer: string } => "asset_code" in b)
      .map((b) => `${b.asset_code}:${b.asset_issuer}`),
  );
  return TRUSTLINE_ASSETS.filter((a) => !trusted.has(`${a.code}:${a.issuer}`));
}

/** Establish trustlines for `assets` in a single signed transaction. */
export async function addTrustlines(
  publicKey: string,
  assets: { code: string; issuer: string }[],
): Promise<void> {
  if (assets.length === 0) return;
  const account = await horizon.loadAccount(publicKey);
  let tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  });
  for (const a of assets) {
    tx = tx.addOperation(Operation.changeTrust({ asset: new Asset(a.code, a.issuer) }));
  }
  const built = tx.setTimeout(60).build();
  const signed = await signTransaction(built.toXDR(), {
    networkPassphrase: NETWORK_PASSPHRASE,
    address: publicKey,
  });
  if (signed.error) throw new Error(signed.error);
  const signedTx = TransactionBuilder.fromXDR(signed.signedTxXdr, NETWORK_PASSPHRASE);
  const res = await horizon.submitTransaction(signedTx);
  if (!res.successful) throw new Error("trustline transaction failed");
}

// --- reads ---

/**
 * The SDK returns the raw value on success, but a Rust-style `Err { error,
 * unwrap() }` object (never throws) when the contract call reverts (e.g. the
 * oracle router's staleness/divergence guard tripped inside nav()). Detect
 * that shape and unwrap it so a revert becomes a real thrown Error instead
 * of silently flowing an {error: {...}} object into the UI as if it were data.
 */
function unwrapResult<T>(result: unknown): T {
  if (result && typeof (result as { unwrap?: unknown }).unwrap === "function") {
    try {
      return (result as { unwrap(): T }).unwrap();
    } catch (e: any) {
      const msg = e?.message || (result as any)?.error?.message;
      throw new Error(msg || "contract call reverted");
    }
  }
  return result as T;
}

export async function fetchAssets(): Promise<AssetInfo[]> {
  const c = await getReadClient();
  return unwrapResult((await c.get_assets()).result);
}

export async function fetchNav(): Promise<NavInfo> {
  const c = await getReadClient();
  return unwrapResult((await c.nav()).result);
}

export async function fetchBalances(): Promise<bigint[]> {
  const c = await getReadClient();
  return unwrapResult((await c.balances()).result);
}

export async function fetchShareBalance(account: string): Promise<bigint> {
  const c = await getReadClient();
  return unwrapResult((await c.balance({ account })).result);
}

export async function fetchTotalSupply(): Promise<bigint> {
  const c = await getReadClient();
  return unwrapResult((await c.total_supply()).result);
}

/**
 * Live per-asset prices straight from the OracleRouter (14 decimals), keyed
 * by token address. One asset's feed reverting (stale/divergent) doesn't
 * blank the others - each call is isolated.
 */
export async function fetchAssetPrices(tokens: string[]): Promise<Record<string, PriceData | null>> {
  const c = await getRouterClient();
  const entries = await Promise.all(
    tokens.map(async (token) => {
      try {
        const pd = unwrapResult<PriceData>((await c.price({ token })).result);
        return [token, pd] as const;
      } catch {
        return [token, null] as const;
      }
    }),
  );
  return Object.fromEntries(entries);
}

// --- writes ---

const BIG_MAX = (1n << 100n).toString();

/** Simulate a mint to learn the required per-asset deposits (ratio helper). */
export async function quoteMint(
  publicKey: string,
  sharesOut: bigint,
  nAssets: number,
): Promise<bigint[]> {
  const c = await getWriteClient(publicKey);
  const tx = await c.mint({
    user: publicKey,
    shares_out: sharesOut,
    max_deposits: Array(nAssets).fill(BIG_MAX),
  });
  return unwrapResult(tx.result);
}

/** Execute a mint with a 0.5% buffer over the quoted deposits. */
export async function sendMint(
  publicKey: string,
  sharesOut: bigint,
  quoted: bigint[],
): Promise<bigint[]> {
  const c = await getWriteClient(publicKey);
  const max = quoted.map((d) => (toBig(d) * 1005n) / 1000n + 1n);
  const tx = await c.mint({
    user: publicKey,
    shares_out: sharesOut,
    max_deposits: max,
  });
  const { result } = await tx.signAndSend();
  return unwrapResult(result);
}

export async function sendRedeem(
  publicKey: string,
  shares: bigint,
): Promise<bigint[]> {
  const c = await getWriteClient(publicKey);
  const tx = await c.redeem({ user: publicKey, shares });
  const { result } = await tx.signAndSend();
  return unwrapResult(result);
}

/**
 * Single-asset deposit: deposit `depositAmount` of `depositToken` (e.g. XLM),
 * the contract swaps into the whole basket via Soroswap and mints shares.
 * Simulate first (no signature) to preview the shares, then send.
 */
export async function quoteMintSingle(
  publicKey: string,
  depositToken: string,
  depositAmount: bigint,
): Promise<bigint> {
  const c = await getWriteClient(publicKey);
  const tx = await c.mint_single_asset({
    user: publicKey,
    deposit_token: depositToken,
    deposit_amount: depositAmount,
    min_shares_out: 0n,
    deadline: BigInt(Math.floor(Date.now() / 1000) + 300),
  });
  return toBig(unwrapResult<bigint>(tx.result));
}

export async function sendMintSingle(
  publicKey: string,
  depositToken: string,
  depositAmount: bigint,
  quotedShares: bigint,
): Promise<bigint> {
  const c = await getWriteClient(publicKey);
  // accept up to 1% fewer shares than quoted (pool state can shift slightly)
  const minShares = (toBig(quotedShares) * 99n) / 100n;
  const tx = await c.mint_single_asset({
    user: publicKey,
    deposit_token: depositToken,
    deposit_amount: depositAmount,
    min_shares_out: minShares,
    deadline: BigInt(Math.floor(Date.now() / 1000) + 300),
  });
  const { result } = await tx.signAndSend();
  return toBig(unwrapResult<bigint>(result));
}

// --- pools (read reserves straight from each Soroswap pair contract) ---

export interface PoolReserves {
  reserve0: bigint;
  reserve1: bigint;
}

const poolClients: Record<string, AnyClient> = {};

export async function fetchPoolReserves(poolId: string): Promise<PoolReserves | null> {
  try {
    if (!poolClients[poolId]) {
      poolClients[poolId] = (await contract.Client.from({
        contractId: poolId,
        networkPassphrase: NETWORK_PASSPHRASE,
        rpcUrl: RPC_URL,
      })) as AnyClient;
    }
    const res = unwrapResult<bigint[]>((await poolClients[poolId].get_reserves()).result);
    return { reserve0: toBig(res[0]), reserve1: toBig(res[1]) };
  } catch {
    return null; // pool not seeded yet
  }
}

// --- formatting ---

/** Coerce a chain-returned i128 (bigint/number/string, SDK-build-dependent) to bigint. */
export function toBig(v: bigint | number | string): bigint {
  return typeof v === "bigint" ? v : BigInt(v);
}

export function fmtUnits(v: bigint | number | string, decimals: number, dp = 4): string {
  // the browser build of the Stellar SDK doesn't always hand back an i128
  // as a native bigint (sometimes number/string) - normalize defensively
  const val = typeof v === "bigint" ? v : BigInt(v);
  const base = 10n ** BigInt(decimals);
  const whole = val / base;
  const frac = (val < 0n ? -val : val) % base;
  const fracStr = frac.toString().padStart(decimals, "0").slice(0, dp);
  return `${whole.toString()}.${fracStr}`;
}

export function parseUnits(s: string, decimals: number): bigint {
  const [whole, frac = ""] = s.trim().split(".");
  const fracPadded = (frac + "0".repeat(decimals)).slice(0, decimals);
  return BigInt(whole || "0") * 10n ** BigInt(decimals) + BigInt(fracPadded || "0");
}
