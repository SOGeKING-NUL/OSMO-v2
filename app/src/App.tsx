import { useCallback, useEffect, useState } from "react";
import { FAUCET_AMOUNTS, PRICE_DECIMALS, SHARE_DECIMALS, TOKEN_INFO } from "./config";
import { dripTestTokens } from "./lib/faucet";
import {
  AssetInfo,
  NavInfo,
  PriceData,
  addTrustlines,
  connectWallet,
  fetchAssetPrices,
  fetchAssets,
  fetchBalances,
  fetchNav,
  fetchShareBalance,
  fetchTotalSupply,
  fmtUnits,
  getMissingTrustlines,
  parseUnits,
  quoteMint,
  sendMint,
  sendRedeem,
  toBig,
} from "./lib/folio";

const POLL_MS = 5000;

function tokenSymbol(id: string): string {
  return TOKEN_INFO[id]?.symbol ?? `${id.slice(0, 4)}…${id.slice(-4)}`;
}

/** SVG donut of target weights. */
function Donut({ assets }: { assets: AssetInfo[] }) {
  const R = 40;
  const C = 2 * Math.PI * R;
  let offset = 0;
  return (
    <svg viewBox="0 0 100 100" className="donut" role="img" aria-label="Basket composition">
      {assets.map((a) => {
        const frac = a.weight_bps / 10_000;
        const seg = (
          <circle
            key={a.token}
            cx="50"
            cy="50"
            r={R}
            fill="none"
            stroke={TOKEN_INFO[a.token]?.color ?? "#888"}
            strokeWidth="14"
            strokeDasharray={`${frac * C} ${C}`}
            strokeDashoffset={-offset}
            transform="rotate(-90 50 50)"
          />
        );
        offset += frac * C;
        return seg;
      })}
    </svg>
  );
}

export default function App() {
  const [assets, setAssets] = useState<AssetInfo[]>([]);
  const [nav, setNav] = useState<NavInfo | null>(null);
  const [balances, setBalances] = useState<bigint[]>([]);
  const [supply, setSupply] = useState<bigint>(0n);
  const [prices, setPrices] = useState<Record<string, PriceData | null>>({});
  const [wallet, setWallet] = useState<string>("");
  const [myShares, setMyShares] = useState<bigint>(0n);
  const [status, setStatus] = useState<string>("");
  const [navError, setNavError] = useState<string>("");

  const [mintShares, setMintShares] = useState("");
  const [quote, setQuote] = useState<bigint[] | null>(null);
  const [redeemShares, setRedeemShares] = useState("");
  const [busy, setBusy] = useState(false);
  const [missingTrustlines, setMissingTrustlines] = useState<{ code: string; issuer: string }[]>([]);

  const refresh = useCallback(async () => {
    try {
      const [n, b, s] = await Promise.all([fetchNav(), fetchBalances(), fetchTotalSupply()]);
      setNav(n);
      setBalances(b);
      setSupply(s);
      setNavError("");
      if (wallet) setMyShares(await fetchShareBalance(wallet));
    } catch (e: any) {
      // a tripped oracle breaker (stale/divergent) fails nav() — surface it
      setNavError(String(e?.message ?? e));
    }
    if (assets.length) {
      fetchAssetPrices(assets.map((a) => a.token)).then(setPrices);
    }
  }, [wallet, assets]);

  useEffect(() => {
    fetchAssets().then(setAssets).catch((e) => setStatus(String(e)));
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, POLL_MS);
    return () => clearInterval(t);
  }, [refresh]);

  async function onConnect() {
    try {
      const addr = await connectWallet();
      setWallet(addr);
      setStatus("");
      // classic assets (everything but XLM) need a trustline before this
      // wallet can hold them - a fresh account almost certainly lacks these
      setMissingTrustlines(await getMissingTrustlines(addr));
    } catch (e: any) {
      setStatus(`Wallet: ${e.message ?? e}`);
    }
  }

  async function onAddTrustlines() {
    if (!wallet || missingTrustlines.length === 0) return;
    setBusy(true);
    setStatus("Adding trustlines…");
    try {
      await addTrustlines(wallet, missingTrustlines);
      setMissingTrustlines(await getMissingTrustlines(wallet));
      setStatus("Trustlines added ✓");
    } catch (e: any) {
      setStatus(`Adding trustlines failed: ${e.message ?? e}`);
    } finally {
      setBusy(false);
    }
  }

  /** One-click onboarding: trustlines (if needed) then the token drip. */
  async function onFaucet() {
    if (!wallet) return;
    setBusy(true);
    try {
      const missing = await getMissingTrustlines(wallet);
      if (missing.length > 0) {
        setStatus("Adding trustlines…");
        await addTrustlines(wallet, missing);
        setMissingTrustlines([]);
      }
      setStatus("Requesting test tokens…");
      await dripTestTokens(wallet);
      setStatus("Test tokens received ✓ — refresh balances above may take a moment");
    } catch (e: any) {
      setStatus(`Faucet failed: ${e.message ?? e}`);
    } finally {
      setBusy(false);
    }
  }

  async function onQuote() {
    if (!wallet || !mintShares) return;
    setBusy(true);
    setStatus("");
    try {
      setQuote(await quoteMint(wallet, parseUnits(mintShares, SHARE_DECIMALS), assets.length));
    } catch (e: any) {
      setStatus(`Quote failed: ${e.message ?? e}`);
    } finally {
      setBusy(false);
    }
  }

  async function onMint() {
    if (!wallet || !quote || !mintShares) return;
    setBusy(true);
    setStatus("Submitting mint…");
    try {
      await sendMint(wallet, parseUnits(mintShares, SHARE_DECIMALS), quote);
      setStatus(`Minted ${mintShares} shares ✓`);
      setQuote(null);
      setMintShares("");
      await refresh();
    } catch (e: any) {
      setStatus(`Mint failed: ${e.message ?? e}`);
    } finally {
      setBusy(false);
    }
  }

  async function onRedeem() {
    if (!wallet || !redeemShares) return;
    setBusy(true);
    setStatus("Submitting redeem…");
    try {
      const outs = await sendRedeem(wallet, parseUnits(redeemShares, SHARE_DECIMALS));
      setStatus(
        `Redeemed ✓ received: ${outs
          .map((o, i) => `${fmtUnits(o, 7)} ${tokenSymbol(assets[i]?.token ?? "")}`)
          .join(", ")}`,
      );
      setRedeemShares("");
      await refresh();
    } catch (e: any) {
      setStatus(`Redeem failed: ${e.message ?? e}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main>
      <header>
        <h1>
          Nebula <span className="accent">DTF</span>
        </h1>
        {wallet ? (
          <code className="wallet">{wallet.slice(0, 4)}…{wallet.slice(-4)}</code>
        ) : (
          <button onClick={onConnect}>Connect Freighter</button>
        )}
      </header>

      <section className="card">
        <h2>Stellar Ecosystem Folio (SEF)</h2>
        {navError ? (
          <p className="warn">NAV unavailable (oracle guard): {navError}</p>
        ) : nav ? (
          <div className="navrow">
            <div>
              <div className="label">NAV / share</div>
              <div className="big">${fmtUnits(nav.per_share, PRICE_DECIMALS, 6)}</div>
            </div>
            <div>
              <div className="label">Total value</div>
              <div className="big">${fmtUnits(nav.total_value, PRICE_DECIMALS, 2)}</div>
            </div>
            <div>
              <div className="label">Shares outstanding</div>
              <div className="big">{fmtUnits(supply, SHARE_DECIMALS, 2)}</div>
            </div>
          </div>
        ) : (
          <p>Loading…</p>
        )}
      </section>

      <section className="card composition">
        <Donut assets={assets} />
        <table>
          <thead>
            <tr>
              <th>Asset</th>
              <th>Price</th>
              <th>Target</th>
              <th>Held by folio</th>
            </tr>
          </thead>
          <tbody>
            {assets.map((a, i) => {
              const pd = prices[a.token];
              return (
                <tr key={a.token}>
                  <td>
                    <span className="dot" style={{ background: TOKEN_INFO[a.token]?.color ?? "#888" }} />
                    {tokenSymbol(a.token)}
                    {TOKEN_INFO[a.token]?.simulated && (
                      <span className="warn" title="No real oracle coverage - simulated price">
                        {" "}(simulated)
                      </span>
                    )}
                  </td>
                  <td>{pd ? `$${fmtUnits(pd.price, PRICE_DECIMALS, 6)}` : "—"}</td>
                  <td>{(a.weight_bps / 100).toFixed(1)}%</td>
                  <td>{balances[i] !== undefined ? fmtUnits(balances[i], a.decimals, 2) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {wallet && (
        <section className="card faucet">
          <h2>Testnet faucet</h2>
          <p>
            Free demo tokens, one click: {FAUCET_AMOUNTS.XLM} XLM, {FAUCET_AMOUNTS.tstAQUA} tstAQUA,{" "}
            {FAUCET_AMOUNTS.tstVELO} tstVELO, {FAUCET_AMOUNTS.tstUSDC} tstUSDC,{" "}
            {FAUCET_AMOUNTS.tstEURC} tstEURC. Sets up trustlines automatically if needed.
          </p>
          <button onClick={onFaucet} disabled={busy}>
            Get test tokens
          </button>
        </section>
      )}

      <section className="card">
        <h2>Your position</h2>
        <p>
          {wallet
            ? `${fmtUnits(myShares, SHARE_DECIMALS, 4)} SEF` +
              (nav
                ? ` ≈ $${fmtUnits((toBig(myShares) * toBig(nav.per_share)) / 10n ** BigInt(SHARE_DECIMALS), PRICE_DECIMALS, 2)}`
                : "")
            : "Connect a wallet to see your shares."}
        </p>

        {wallet && missingTrustlines.length > 0 && (
          <div className="trustline-banner">
            <p>
              This wallet hasn't trusted {missingTrustlines.map((a) => a.code).join(", ")} yet —
              required once before minting (a base Stellar ledger rule for non-native assets, not
              specific to this app). The faucet above sets this up automatically, or do it alone:
            </p>
            <button onClick={onAddTrustlines} disabled={busy}>
              Add trustlines only
            </button>
          </div>
        )}

        <div className="actions">
          <div>
            <h3>Mint</h3>
            <input
              placeholder="shares e.g. 5"
              value={mintShares}
              onChange={(e) => {
                setMintShares(e.target.value);
                setQuote(null);
              }}
              disabled={busy || missingTrustlines.length > 0}
            />
            {quote ? (
              <>
                <ul className="quote">
                  {quote.map((d, i) => (
                    <li key={i}>
                      {fmtUnits(d, 7)} {tokenSymbol(assets[i]?.token ?? "")}
                    </li>
                  ))}
                </ul>
                <button onClick={onMint} disabled={busy || !wallet}>
                  Confirm mint
                </button>
              </>
            ) : (
              <button
                onClick={onQuote}
                disabled={busy || !wallet || !mintShares || missingTrustlines.length > 0}
              >
                Quote deposits
              </button>
            )}
          </div>
          <div>
            <h3>Redeem</h3>
            <input
              placeholder="shares e.g. 5"
              value={redeemShares}
              onChange={(e) => setRedeemShares(e.target.value)}
              disabled={busy}
            />
            <button onClick={onRedeem} disabled={busy || !wallet || !redeemShares}>
              Redeem
            </button>
          </div>
        </div>
        {status && <p className="status">{status}</p>}
      </section>

      <footer>
        Testnet · proportional mint/redeem, no swaps · redemption is never pausable
      </footer>
    </main>
  );
}
