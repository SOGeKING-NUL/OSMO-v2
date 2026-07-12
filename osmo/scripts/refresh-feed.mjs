// Re-stamp the testnet MockPriceFeed with fresh timestamps (and live mainnet
// Reflector prices where available) so the oracle router's staleness guard
// stops reverting nav(). Pure Node — no `stellar` CLI required.
//
// This is the JS port of scripts/refresh-prices.ps1 + price-relay.ps1, meant to
// run from the osmo/ directory (which has @stellar/stellar-sdk installed):
//
//   # PowerShell:
//   $env:NEBULA_ADMIN_SECRET = "S...";  node scripts/refresh-feed.mjs
//   # bash:
//   NEBULA_ADMIN_SECRET=S... node scripts/refresh-feed.mjs
//   # add --dry-run to fetch prices and print without writing on-chain.
//
// The admin secret is the nebula-admin identity (public GA45OKGD...), the only
// signer the MockPriceFeed accepts for set_price. It is read from the env var
// so it never has to live in a file. Nothing here touches mainnet state — the
// mainnet call is a read-only simulation.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  Keypair,
  TransactionBuilder,
  contract,
  rpc,
} from "@stellar/stellar-sdk";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DRY_RUN = process.argv.includes("--dry-run");

// --- load testnet addresses from osmo/.env.local -------------------------
function loadEnv() {
  const raw = readFileSync(join(__dirname, "..", ".env.local"), "utf8");
  const env = {};
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2];
  }
  return env;
}
const env = loadEnv();

const NETWORK_PASSPHRASE = env.NEXT_PUBLIC_NETWORK_PASSPHRASE;
const RPC_URL = env.NEXT_PUBLIC_RPC_URL;
const MOCK_FEED_ID = env.NEXT_PUBLIC_MOCK_FEED_ID;

// testnet SAC (the feed is keyed by these) -> its live mainnet price source.
const MAINNET_ORACLE = "CALI2BYU2JE6WVRUFYTS6MSBNEHGJ35P4AVCZYF3B6QOE3QKOB2PLE6M";
const MAINNET_RPC = "https://mainnet.sorobanrpc.com";
const MAINNET_PASSPHRASE = "Public Global Stellar Network ; September 2015";

const ASSETS = [
  { sym: "XLM", token: env.NEXT_PUBLIC_TOKEN_XLM, mainnet: "CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA" },
  { sym: "tstAQUA", token: env.NEXT_PUBLIC_TOKEN_TSTAQUA, mainnet: "CAUIKL3IYGMERDRUN6YSCLWVAKIFG5Q4YJHUKM4S4NJZQIA3BAS6OJPK" },
  { sym: "tstEURC", token: env.NEXT_PUBLIC_TOKEN_TSTEURC, mainnet: "CDTKPWPLOURQA2SGTKTUQOWRCBZEORB4BWBOMJ3D3ZTQQSGE5F6JBQLV" },
  // USDC is the oracle's own numeraire ($1.00); VELO has no Reflector coverage.
  { sym: "tstUSDC", token: env.NEXT_PUBLIC_TOKEN_TSTUSDC, fixed: 100000000000000n },
  { sym: "tstVELO", token: env.NEXT_PUBLIC_TOKEN_TSTVELO, fixed: 2000000000000n },
];

const oracleAsset = (id) => ({ tag: "Stellar", values: [id] });

async function main() {
  const secret = process.env.NEBULA_ADMIN_SECRET;
  if (!secret && !DRY_RUN) {
    console.error(
      "ERROR: set NEBULA_ADMIN_SECRET (the nebula-admin secret, public GA45OKGD...).\n" +
        "       Add --dry-run to preview prices without it.",
    );
    process.exit(1);
  }

  const now = BigInt(Math.floor(Date.now() / 1000));
  console.log(`Feed: ${MOCK_FEED_ID}\nStamp timestamp: ${now}  (${new Date().toISOString()})\n`);

  // 1) source prices — live mainnet where possible, static/last-known otherwise.
  const mainnet = await contract.Client.from({
    contractId: MAINNET_ORACLE,
    networkPassphrase: MAINNET_PASSPHRASE,
    rpcUrl: MAINNET_RPC,
  });
  const feed = await contract.Client.from({
    contractId: MOCK_FEED_ID,
    networkPassphrase: NETWORK_PASSPHRASE,
    rpcUrl: RPC_URL,
  });

  for (const a of ASSETS) {
    if (a.fixed !== undefined) {
      a.price = a.fixed;
      a.source = "static";
      continue;
    }
    try {
      const pd = (await mainnet.lastprice({ asset: oracleAsset(a.mainnet) })).result;
      if (pd && pd.price > 0n) {
        a.price = BigInt(pd.price);
        a.source = "mainnet";
        continue;
      }
      throw new Error("empty mainnet price");
    } catch (e) {
      // fall back to the price already on the testnet feed, just re-stamped.
      try {
        const cur = (await feed.lastprice({ asset: oracleAsset(a.token) })).result;
        a.price = BigInt(cur.price);
        a.source = "last-known (mainnet read failed: " + e.message + ")";
      } catch {
        console.error(`  ${a.sym}: no price available at all — skipping`);
      }
    }
  }

  console.log("Prices to write (14 decimals):");
  for (const a of ASSETS) if (a.price !== undefined) console.log(`  ${a.sym.padEnd(8)} ${a.price}  [${a.source}]`);
  console.log("");

  if (DRY_RUN) {
    console.log("--dry-run: nothing written.");
    return;
  }

  // 2) write each fresh price, signed by nebula-admin.
  const kp = Keypair.fromSecret(secret);
  const signer = await contract.Client.from({
    contractId: MOCK_FEED_ID,
    networkPassphrase: NETWORK_PASSPHRASE,
    rpcUrl: RPC_URL,
    publicKey: kp.publicKey(),
    signTransaction: async (xdr) => {
      const tx = TransactionBuilder.fromXDR(xdr, NETWORK_PASSPHRASE);
      tx.sign(kp);
      return { signedTxXdr: tx.toXDR(), signerAddress: kp.publicKey() };
    },
  });
  console.log(`Signing as ${kp.publicKey()}\n`);

  for (const a of ASSETS) {
    if (a.price === undefined) continue;
    const tx = await signer.set_price({
      asset: oracleAsset(a.token),
      price: a.price,
      timestamp: now,
    });
    const sent = await tx.signAndSend();
    const status = sent.getTransactionResponse?.status ?? "sent";
    console.log(`  ${a.sym.padEnd(8)} set_price -> ${status}`);
  }
  console.log("\nDone. nav() should now succeed until the feed ages past router.max_age (24h).");
}

main().catch((e) => {
  console.error("FAILED:", e);
  process.exit(1);
});
