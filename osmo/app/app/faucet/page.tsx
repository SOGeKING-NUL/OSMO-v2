"use client";

// Testnet faucet: drips XLM + all four classic basket tokens to the connected
// wallet in a single Horizon transaction signed by the test issuer (secret is
// safe client-side here because this is a testnet-only account with no real funds).
// The issuer also automatically sets up every necessary trustline for the
// recipient before transferring, so a fresh wallet works out of the box.

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { FAUCET_AMOUNTS, TRUSTLINE_ASSETS } from "@/lib/config";
import { dripTestTokens } from "@/lib/faucet";
import { useWallet } from "@/components/app/wallet-provider";
import { useFolio } from "@/components/app/folio-provider";
import { cardClass, PageHeader } from "@/components/app/shared";

export default function FaucetPage() {
  const {
    address,
    missingTrustlines,
    addMissingTrustlines,
    refreshTrustlines,
  } = useWallet();
  const { refresh } = useFolio();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  async function onDrip() {
    if (!address) return;
    setBusy(true);
    setStatus("Sending tokens…");
    try {
      // If the wallet is missing trustlines, add them first so the payment
      // doesn't fail with "no trustline" on the receiving side.
      if (missingTrustlines.length > 0) {
        setStatus("Adding trustlines first…");
        await addMissingTrustlines();
        await refreshTrustlines();
      }
      await dripTestTokens(address);
      setStatus("Drip successful ✓ — tokens sent to your wallet.");
      await refresh();
    } catch (e: any) {
      setStatus(`Drip failed: ${e.message ?? e}`);
    } finally {
      setBusy(false);
    }
  }

  const tokens = [
    { code: "XLM", amount: FAUCET_AMOUNTS.XLM, color: "#7b68ee" },
    ...TRUSTLINE_ASSETS.map((a) => ({
      code: a.code,
      amount: FAUCET_AMOUNTS[a.code] ?? "—",
      color:
        a.code === "tstAQUA"
          ? "#9f4ef5"
          : a.code === "tstVELO"
            ? "#f5a623"
            : a.code === "tstUSDC"
              ? "#2775ca"
              : "#1a9c6b",
    })),
  ];

  return (
    <>
      <PageHeader
        title="Faucet"
        subtitle="Grab a free drip of every basket token so you can try minting SEF without any real assets. Trustlines are set up for you automatically."
      />

      <div className="grid gap-x-8 gap-y-6 lg:grid-cols-2">
        {/* What you'll receive */}
        <Card className={cardClass}>
          <CardHeader>
            <CardTitle className="font-heading text-lg">
              You&apos;ll receive
            </CardTitle>
            <CardDescription>One drip of each basket token.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-black/6">
              {tokens.map((t) => (
                <div
                  key={t.code}
                  className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                >
                  <span className="flex items-center gap-2.5">
                    <span
                      className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: t.color }}
                    />
                    <span className="text-sm font-medium text-[#0b1428]">
                      {t.code}
                    </span>
                  </span>
                  <span className="font-heading text-sm font-bold tabular-nums text-gray-500">
                    +{Number(t.amount).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Action */}
        <Card className={cardClass}>
          <CardHeader>
            <CardTitle className="font-heading text-lg">
              Request a drip
            </CardTitle>
            <CardDescription>
              One drip per request. Testnet Friendbot can top up your XLM if you
              need more gas.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {address ? (
              <>
                {missingTrustlines.length > 0 && (
                  <p className="rounded-lg border border-[#d95b21]/30 bg-[#d95b21]/6 px-4 py-2.5 text-sm text-[#d95b21]">
                    Missing trustlines for{" "}
                    <strong>
                      {missingTrustlines.map((a) => a.code).join(", ")}
                    </strong>{" "}
                    — they will be added automatically before the drip.
                  </p>
                )}
                <Button
                  onClick={onDrip}
                  disabled={busy}
                  className="w-full cursor-pointer rounded-full bg-[#1f4fb4] text-white hover:bg-[#1a44a0]"
                >
                  {busy ? "Sending…" : "Request tokens"}
                </Button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Connect your Freighter wallet to request tokens.
              </p>
            )}

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
      </div>
    </>
  );
}
