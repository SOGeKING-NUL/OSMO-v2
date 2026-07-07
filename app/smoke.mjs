// Node smoke test: dynamic client against the live testnet folio.
// Run: node smoke.mjs
import { contract } from "@stellar/stellar-sdk";

const c = await contract.Client.from({
  contractId: "CCFC3Z74YYOXMRZMXZTSGO4KCARSZW3CDSNLGV63E5RAEBWIGW2E54LB",
  networkPassphrase: "Test SDF Network ; September 2015",
  rpcUrl: "https://soroban-testnet.stellar.org",
});

const nav = (await c.nav()).result;
const assets = (await c.get_assets()).result;
const supply = (await c.total_supply()).result;
console.log("nav:", nav);
console.log("assets:", assets.length, assets.map((a) => a.token.slice(0, 6)).join(","));
console.log("supply:", supply);
if (typeof nav.per_share !== "bigint" || nav.per_share <= 0n) throw new Error("bad NAV");
if (assets.length !== 5) throw new Error("bad assets");
console.log("SMOKE OK");

// verify per-asset prices via the router (new: fetchAssetPrices path)
const routerId = "CDNQIEPDPXERUSA3NT7XOY7TTO2DDQLJN2QHDQF5WECYT2I7VDUDMJJP";
const router = await contract.Client.from({
  contractId: routerId,
  networkPassphrase: "Test SDF Network ; September 2015",
  rpcUrl: "https://soroban-testnet.stellar.org",
});
for (const a of assets) {
  const pd = (await router.price({ token: a.token })).result;
  console.log(`  ${a.token.slice(0,6)} price:`, pd);
}
