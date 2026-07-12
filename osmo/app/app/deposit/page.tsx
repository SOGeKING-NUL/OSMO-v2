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
import { Stat } from "@/components/app/shared";

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
      {/* Current position summary */}
      {address && nav && (
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Your position</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-10">
              <Stat
                label="SEF balance"
                value={fmtUnits(myShares, SHARE_DECIMALS, 4)}
              />
              <Stat
                label="Value"
                value={`$${fmtUnits(
                  (toBig(myShares) * toBig(nav.per_share)) /
                    10n ** BigInt(SHARE_DECIMALS),
                  14,
                  2,
                )}`}
              />
              <Stat
                label="NAV / share"
                value={`$${fmtUnits(nav.per_share, 14, 6)}`}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Deposit form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Deposit XLM → SEF</CardTitle>
          <CardDescription>
            Send any amount of XLM. The contract routes it through Aquarius into
            the full basket composition and mints SEF shares in a single
            transaction — no need to hold all five tokens yourself.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!address && (
            <p className="text-sm text-muted-foreground">
              Connect your Freighter wallet to deposit.
            </p>
          )}

          <div className="flex max-w-sm flex-col gap-3">
            <label className="text-sm font-medium" htmlFor="deposit-amount">
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
              disabled={busy || !address}
            />

            {quotedShares !== null ? (
              <>
                <p className="text-sm text-muted-foreground">
                  You will receive approximately{" "}
                  <strong>
                    {fmtUnits(quotedShares, SHARE_DECIMALS, 4)} SEF
                  </strong>{" "}
                  (1% slippage tolerance applied).
                </p>
                <div className="flex gap-2">
                  <Button onClick={onDeposit} disabled={busy || !address}>
                    Confirm deposit
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setQuotedShares(null)}
                    disabled={busy}
                  >
                    Cancel
                  </Button>
                </div>
              </>
            ) : (
              <Button onClick={onQuote} disabled={busy || !address || !amount}>
                Preview shares
              </Button>
            )}
          </div>

          {status && (
            <p
              className={cn(
                "wrap-break-word text-sm",
                status.includes("✓") ? "text-[#1f4fb4]" : "text-[#f0883e]",
              )}
            >
              {status}
            </p>
          )}

          <div className="mt-4 rounded-md border bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
            <strong>How it works:</strong> Your XLM is swapped through separate
            XLM ↔ token Aquarius routes for each basket asset. The contract reads
            live pool prices to determine the optimal split. Slippage tolerance
            is 1% per swap leg.
          </div>
        </CardContent>
      </Card>
    </>
  );
}
