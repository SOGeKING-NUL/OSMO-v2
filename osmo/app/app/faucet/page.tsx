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
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Testnet Faucet</CardTitle>
          <CardDescription>
            Get a free drip of every basket token so you can try minting SEF
            shares without needing real assets. One drip per request; testnet
            Friendbot can top up your XLM if you need more gas.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Token list */}
          <div className="flex flex-wrap gap-3">
            {tokens.map((t) => (
              <div
                key={t.code}
                className="flex items-center gap-2 rounded-full border bg-background px-4 py-2 text-sm font-medium"
              >
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ background: t.color }}
                />
                <span className="text-muted-foreground">
                  {Number(t.amount).toLocaleString()} {t.code}
                </span>
              </div>
            ))}
          </div>

          {/* Action */}
          {address ? (
            <div className="space-y-3">
              {missingTrustlines.length > 0 && (
                <p className="text-sm text-[#f0883e]">
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
                className="w-full sm:w-auto"
              >
                {busy ? "Sending…" : "Request tokens"}
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Connect your Freighter wallet to request tokens.
            </p>
          )}

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

          <div className="rounded-md border bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
            <strong>Testnet only.</strong> The test issuer secret is embedded
            client-side because this account holds no real value — it only
            exists to distribute testnet tokens. Never do this on mainnet.
          </div>
        </CardContent>
      </Card>
    </>
  );
}
