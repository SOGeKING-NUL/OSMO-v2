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
import {
  cardClass,
  Donut,
  Dot,
  PageHeader,
  StatCard,
  tokenSymbol,
} from "@/components/app/shared";

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
      <PageHeader
        title="Stellar Ecosystem Folio"
        subtitle="One SEF share tracks the whole basket of five Stellar assets. Mint against live oracle prices, or redeem any time — redemption is never pausable."
      />

      {/* NAV summary — dashboard metric row */}
      {navError ? (
        <div className={cn(cardClass, "px-6 py-5")}>
          <p className="rounded-lg border border-[#d95b21]/30 bg-[#d95b21]/6 px-4 py-3 text-sm text-[#d95b21]">
            NAV unavailable (oracle guard): {navError}
          </p>
        </div>
      ) : nav ? (
        <div className="grid gap-x-8 gap-y-6 sm:grid-cols-3">
          <StatCard
            label="NAV / share"
            value={`$${fmtUnits(nav.per_share, PRICE_DECIMALS, 6)}`}
            accent
          />
          <StatCard
            label="Total value"
            value={`$${fmtUnits(nav.total_value, PRICE_DECIMALS, 2)}`}
          />
          <StatCard
            label="Shares outstanding"
            value={fmtUnits(supply, SHARE_DECIMALS, 2)}
          />
        </div>
      ) : (
        <div className="grid gap-x-8 gap-y-6 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className={cn(cardClass, "h-[104px] animate-pulse")} />
          ))}
        </div>
      )}

      {/* Composition + position, side by side on wide screens */}
      <div className="grid gap-x-8 gap-y-6 mt-4 lg:grid-cols-3">
        <Card className={cn(cardClass, "lg:col-span-2")}>
          <CardHeader>
            <CardTitle className="font-heading text-lg">Composition</CardTitle>
            <CardDescription>
              Target weights versus what the folio holds on chain right now.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-8">
            <Donut assets={assets} />
            <div className="min-w-70 flex-1">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Asset</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead className="text-right">Held</TableHead>
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
                              className="ml-1 text-[#d95b21]"
                              title="No real oracle coverage - simulated price"
                            >
                              (sim)
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {pd
                            ? `$${fmtUnits(pd.price, PRICE_DECIMALS, 6)}`
                            : "—"}
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {(a.weight_bps / 100).toFixed(1)}%
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
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

        <Card className={cardClass}>
          <CardHeader>
            <CardTitle className="font-heading text-lg">Your position</CardTitle>
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
            <div className="mb-4 rounded-lg border border-[#d95b21]/30 bg-[#d95b21]/6 px-4 py-3">
              <p className="mb-2 text-sm text-[#d95b21]">
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

          <div className="space-y-5">
            <div className="space-y-3">
              <div className="flex items-baseline justify-between">
                <h3 className="font-heading text-sm font-bold uppercase tracking-wide text-[#0b1428]">
                  Mint
                </h3>
                <span className="text-xs text-gray-400">shares in</span>
              </div>
              <Input
                placeholder="e.g. 5"
                value={mintShares}
                onChange={(e) => {
                  setMintShares(e.target.value);
                  setQuote(null);
                }}
                disabled={busy || missingTrustlines.length > 0}
              />
              {quote ? (
                <>
                  <ul className="space-y-1.5 py-1 text-sm">
                    {quote.map((d, i) => (
                      <li
                        key={i}
                        className="flex justify-between tabular-nums text-gray-500"
                      >
                        <span>{tokenSymbol(assets[i]?.token ?? "")}</span>
                        <span className="font-medium text-[#0b1428]">
                          {fmtUnits(d, 7)}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    onClick={onMint}
                    className="w-full cursor-pointer rounded-full bg-[#1f4fb4] text-white hover:bg-[#1a44a0]"
                    disabled={busy || !address}
                  >
                    Confirm mint
                  </Button>
                </>
              ) : (
                <Button
                  onClick={onQuote}
                  className="w-full cursor-pointer rounded-full bg-[#1f4fb4] text-white hover:bg-[#1a44a0]"
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

            <div className="space-y-3 border-t border-black/6 pt-5">
              <div className="flex items-baseline justify-between">
                <h3 className="font-heading text-sm font-bold uppercase tracking-wide text-[#0b1428]">
                  Redeem
                </h3>
                <span className="text-xs text-gray-400">shares out</span>
              </div>
              <Input
                placeholder="e.g. 5"
                value={redeemShares}
                onChange={(e) => setRedeemShares(e.target.value)}
                className="cursor-pointer"
                disabled={busy}
              />
              <Button
                onClick={onRedeem}
                variant="outline"
                className="w-full cursor-pointer rounded-full border-2 border-black bg-white hover:bg-black/3"
                disabled={busy || !address || !redeemShares}
              >
                Redeem
              </Button>
            </div>
          </div>
          {status && (
            <p
              className={cn(
                "mt-4 wrap-break-word rounded-lg border px-4 py-2.5 text-sm",
                status.includes("failed") || status.includes("Failed")
                  ? "border-[#d95b21]/30 bg-[#d95b21]/6 text-[#d95b21]"
                  : "border-[#1f4fb4]/25 bg-[#1f4fb4]/6 text-[#1f4fb4]",
              )}
            >
              {status}
            </p>
          )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
