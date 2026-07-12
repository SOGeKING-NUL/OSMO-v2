"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { SHARE_DECIMALS, XLM_TOKEN } from "@/lib/config";
import {
  fmtUnits,
  parseUnits,
  quoteMintSingle,
  sendMintSingle,
  toBig,
} from "@/lib/folio";
import { useWallet } from "@/components/app/wallet-provider";
import { useFolio } from "@/components/app/folio-provider";
import { cardClass, PageHeader, StatCard } from "@/components/app/shared";

export default function DepositPage() {
  const { address } = useWallet();
  const { nav, myShares, refresh } = useFolio();

  const [amount, setAmount] = useState("");
  const [quotedShares, setQuotedShares] = useState<bigint | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  async function onQuote() {
    if (!address || !amount) return;
    setBusy(true);
    setStatus("");
    try {
      const shares = await quoteMintSingle(
        address,
        XLM_TOKEN,
        parseUnits(amount, 7),
      );
      setQuotedShares(shares);
    } catch (e: any) {
      setStatus(`Quote failed: ${e.message ?? e}`);
    } finally {
      setBusy(false);
    }
  }

  async function onDeposit() {
    if (!address || !quotedShares || !amount) return;
    setBusy(true);
    setStatus("Submitting deposit…");
    try {
      const received = await sendMintSingle(
        address,
        XLM_TOKEN,
        parseUnits(amount, 7),
        quotedShares,
      );
      setStatus(
        `Deposited ✓ — received ${fmtUnits(received, SHARE_DECIMALS, 4)} SEF`,
      );
      setQuotedShares(null);
      setAmount("");
      await refresh();
    } catch (e: any) {
      setStatus(`Deposit failed: ${e.message ?? e}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Deposit XLM"
        subtitle="Bring only XLM. The contract routes it through Soroswap into the full basket and mints SEF for you in a single transaction."
      />

      {/* Current position summary — metric row */}
      {address && nav && (
        <div className="grid gap-x-8 gap-y-6 sm:grid-cols-3">
          <StatCard
            label="SEF balance"
            value={fmtUnits(myShares, SHARE_DECIMALS, 4)}
            accent
          />
          <StatCard
            label="Value"
            value={`$${fmtUnits(
              (toBig(myShares) * toBig(nav.per_share)) /
                10n ** BigInt(SHARE_DECIMALS),
              14,
              2,
            )}`}
          />
          <StatCard
            label="NAV / share"
            value={`$${fmtUnits(nav.per_share, 14, 6)}`}
          />
        </div>
      )}

      <div className="grid gap-x-8 mt-4 gap-y-6 lg:grid-cols-3">
        {/* Deposit form */}
        <Card className={cn(cardClass, "lg:col-span-2")}>
          <CardHeader>
            <CardTitle className="font-heading text-lg">
              Deposit XLM → SEF
            </CardTitle>
            <CardDescription>
              Send any amount of XLM — no need to hold all five basket tokens
              yourself.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!address && (
              <p className="text-sm text-muted-foreground">
                Connect your Freighter wallet to deposit.
              </p>
            )}

            <div className="flex flex-col gap-3">
              <label
                className="text-[11px] font-medium uppercase tracking-wider text-gray-400"
                htmlFor="deposit-amount"
              >
                XLM amount
              </label>
              <Input
                id="deposit-amount"
                placeholder="e.g. 100"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setQuotedShares(null);
                }}
                className="h-14 text-2xl font-semibold tabular-nums"
                disabled={busy || !address}
              />

              {quotedShares !== null ? (
                <>
                  <p className="rounded-lg border border-[#1f4fb4]/20 bg-[#1f4fb4]/6 px-3 py-2.5 text-sm text-gray-700">
                    You will receive approximately{" "}
                    <strong className="text-[#1f4fb4]">
                      {fmtUnits(quotedShares, SHARE_DECIMALS, 4)} SEF
                    </strong>{" "}
                    (1% slippage tolerance applied).
                  </p>
                  <div className="flex gap-2">
                    <Button
                      onClick={onDeposit}
                      className="flex-1 cursor-pointer rounded-full bg-[#1f4fb4] text-white hover:bg-[#1a44a0]"
                      disabled={busy || !address}
                    >
                      Confirm deposit
                    </Button>
                    <Button
                      variant="outline"
                      className="cursor-pointer rounded-full border-2"
                      onClick={() => setQuotedShares(null)}
                      disabled={busy}
                    >
                      Cancel
                    </Button>
                  </div>
                </>
              ) : (
                <Button
                  onClick={onQuote}
                  className="cursor-pointer rounded-full bg-[#1f4fb4] text-white hover:bg-[#1a44a0]"
                  disabled={busy || !address || !amount}
                >
                  Preview shares
                </Button>
              )}
            </div>

            {status && (
              <p
                className={cn(
                  "wrap-break-word rounded-lg border px-4 py-2.5 text-sm",
                  status.includes("✓")
                    ? "border-[#1f4fb4]/25 bg-[#1f4fb4]/6 text-[#1f4fb4]"
                    : "border-[#d95b21]/30 bg-[#d95b21]/6 text-[#d95b21]",
                )}
              >
                {status}
              </p>
            )}
          </CardContent>
        </Card>

        {/* How it works */}
        <Card className={cardClass}>
          <CardHeader>
            <CardTitle className="font-heading text-lg">How it works</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-4">
              {[
                "Enter an XLM amount and preview the SEF you'd receive.",
                "The contract splits your XLM across a Soroswap pool for each basket asset, at live pool prices.",
                "SEF is minted straight to your wallet in one signed transaction.",
              ].map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#1f4fb4]/10 text-xs font-bold text-[#1f4fb4]">
                    {i + 1}
                  </span>
                  <span className="text-sm leading-relaxed text-gray-600">
                    {step}
                  </span>
                </li>
              ))}
            </ol>
            <p className="mt-5 border-t border-black/6 pt-4 text-xs leading-relaxed text-gray-500">
              Slippage tolerance is 1% per swap leg.
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
