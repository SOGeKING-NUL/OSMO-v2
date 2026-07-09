"use client";

// Folio overview: NAV summary, live composition, and the connected wallet's
// position with multi-asset mint / redeem.

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { PRICE_DECIMALS, SHARE_DECIMALS, TOKEN_INFO } from "@/lib/config";
import {
  fmtUnits,
  parseUnits,
  quoteMint,
  sendMint,
  sendRedeem,
  toBig,
} from "@/lib/folio";
import { useWallet } from "@/components/app/wallet-provider";
import { useFolio } from "@/components/app/folio-provider";
import { Donut, Dot, Stat, tokenSymbol } from "@/components/app/shared";

export default function FolioPage() {
  const { address, missingTrustlines, addMissingTrustlines } = useWallet();
  const { assets, nav, balances, supply, prices, myShares, navError, refresh } =
    useFolio();

  const [mintShares, setMintShares] = useState("");
  const [quote, setQuote] = useState<bigint[] | null>(null);
  const [redeemShares, setRedeemShares] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  async function onAddTrustlines() {
    setBusy(true);
    setStatus("Adding trustlines…");
    try {
      await addMissingTrustlines();
      setStatus("Trustlines added ✓");
    } catch (e: any) {
      setStatus(`Adding trustlines failed: ${e.message ?? e}`);
    } finally {
      setBusy(false);
    }
  }

  async function onQuote() {
    if (!address || !mintShares) return;
    setBusy(true);
    setStatus("");
    try {
      setQuote(
        await quoteMint(
          address,
          parseUnits(mintShares, SHARE_DECIMALS),
          assets.length,
        ),
      );
    } catch (e: any) {
      setStatus(`Quote failed: ${e.message ?? e}`);
    } finally {
      setBusy(false);
    }
  }

  async function onMint() {
    if (!address || !quote || !mintShares) return;
    setBusy(true);
    setStatus("Submitting mint…");
    try {
      await sendMint(address, parseUnits(mintShares, SHARE_DECIMALS), quote);
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
    if (!address || !redeemShares) return;
    setBusy(true);
    setStatus("Submitting redeem…");
    try {
      const outs = await sendRedeem(
        address,
        parseUnits(redeemShares, SHARE_DECIMALS),
      );
      setStatus(
        `Redeemed ✓ received: ${outs
          .map(
            (o, i) =>
              `${fmtUnits(o, 7)} ${tokenSymbol(assets[i]?.token ?? "")}`,
          )
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
    <>
      {/* NAV summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">
            Stellar Ecosystem Folio (SEF)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {navError ? (
            <p className="text-sm text-[#f0883e]">
              NAV unavailable (oracle guard): {navError}
            </p>
          ) : nav ? (
            <div className="flex flex-wrap gap-10">
              <Stat
                label="NAV / share"
                value={`$${fmtUnits(nav.per_share, PRICE_DECIMALS, 6)}`}
              />
              <Stat
                label="Total value"
                value={`$${fmtUnits(nav.total_value, PRICE_DECIMALS, 2)}`}
              />
              <Stat
                label="Shares outstanding"
                value={fmtUnits(supply, SHARE_DECIMALS, 2)}
              />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Loading…</p>
          )}
        </CardContent>
      </Card>

      {/* Composition */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Composition</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-6">
          <Donut assets={assets} />
          <div className="min-w-70 flex-1">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Asset</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Held by folio</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assets.map((a, i) => {
                  const pd = prices[a.token];
                  return (
                    <TableRow key={a.token}>
                      <TableCell className="font-medium text-foreground">
                        <Dot color={TOKEN_INFO[a.token]?.color} />
                        {tokenSymbol(a.token)}
                        {TOKEN_INFO[a.token]?.simulated && (
                          <span
                            className="ml-1 text-[#f0883e]"
                            title="No real oracle coverage - simulated price"
                          >
                            (simulated)
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {pd ? `$${fmtUnits(pd.price, PRICE_DECIMALS, 6)}` : "—"}
                      </TableCell>
                      <TableCell>{(a.weight_bps / 100).toFixed(1)}%</TableCell>
                      <TableCell>
                        {balances[i] !== undefined
                          ? fmtUnits(balances[i], a.decimals, 2)
                          : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Your position</CardTitle>
          <CardDescription>
            {address
              ? `${fmtUnits(myShares, SHARE_DECIMALS, 4)} SEF` +
                (nav
                  ? ` ≈ $${fmtUnits((toBig(myShares) * toBig(nav.per_share)) / 10n ** BigInt(SHARE_DECIMALS), PRICE_DECIMALS, 2)}`
                  : "")
              : "Connect a wallet to see your shares."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {address && missingTrustlines.length > 0 && (
            <div className="mb-4 rounded-md border border-[#f0883e] bg-[#f0883e]/10 px-4 py-3">
              <p className="mb-2 text-sm text-[#f0883e]">
                This wallet hasn't trusted{" "}
                {missingTrustlines.map((a) => a.code).join(", ")} yet.
                Trustlines are required once before minting (a base Stellar
                ledger rule for non-native assets). The{" "}
                <Link href="/app/faucet" className="underline">
                  faucet
                </Link>{" "}
                sets this up automatically, or do it alone:
              </p>
              <Button
                variant="outline"
                onClick={onAddTrustlines}
                disabled={busy}
              >
                Add trustlines only
              </Button>
            </div>
          )}

          <div className="flex flex-wrap gap-8">
            <div className="min-w-55 flex-1 space-y-2">
              <h3 className="text-sm font-semibold">Mint</h3>
              <Input
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
                  <ul className="list-disc pl-5 text-sm text-muted-foreground">
                    {quote.map((d, i) => (
                      <li key={i}>
                        {fmtUnits(d, 7)} {tokenSymbol(assets[i]?.token ?? "")}
                      </li>
                    ))}
                  </ul>
                  <Button onClick={onMint} disabled={busy || !address}>
                    Confirm mint
                  </Button>
                </>
              ) : (
                <Button
                  onClick={onQuote}
                  disabled={
                    busy ||
                    !address ||
                    !mintShares ||
                    missingTrustlines.length > 0
                  }
                >
                  Quote deposits
                </Button>
              )}
            </div>
            <div className="min-w-55 flex-1 space-y-2">
              <h3 className="text-sm font-semibold">Redeem</h3>
              <Input
                placeholder="shares e.g. 5"
                value={redeemShares}
                onChange={(e) => setRedeemShares(e.target.value)}
                disabled={busy}
              />
              <Button
                onClick={onRedeem}
                disabled={busy || !address || !redeemShares}
              >
                Redeem
              </Button>
            </div>
          </div>
          {status && (
            <p className={cn("mt-4 wrap-break-word text-sm text-[#1f4fb4]")}>
              {status}
            </p>
          )}
        </CardContent>
      </Card>
    </>
  );
}
