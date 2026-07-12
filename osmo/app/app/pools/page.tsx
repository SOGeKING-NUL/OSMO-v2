"use client";

// Pools page: live reserve data for every configured XLM-hub Aquarius pool
// that the folio uses for single-asset deposit routing.

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { POOLS, PRICE_DECIMALS } from "@/lib/config";
import { fmtUnits, toBig } from "@/lib/folio";
import { useFolio } from "@/components/app/folio-provider";
import { Dot, tokenSymbol } from "@/components/app/shared";
import { TOKEN_INFO } from "@/lib/config";

/** Compute XLM per paired token from Aquarius reserves.
 *  We query tokens as [XLM, paired token], so reserve0 is XLM and reserve1 is
 *  the paired token.
 */
function impliedXlmPrice(reserve0: bigint, reserve1: bigint): string {
  if (reserve1 === 0n) return "—";
  // price in XLM per token-unit, scaled to PRICE_DECIMALS for display
  const scale = 10n ** BigInt(PRICE_DECIMALS);
  const price = (toBig(reserve0) * scale) / toBig(reserve1);
  return fmtUnits(price, PRICE_DECIMALS, 6);
}

export default function PoolsPage() {
  const { pools, prices } = useFolio();

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Aquarius Pools</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">
            Live reserve data read from the Aquarius AMM entry contract on
            Stellar testnet. These pools power the single-asset deposit route —
            depositing XLM triggers a swap through each configured pool to build
            the full basket composition in one transaction.
          </p>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pair</TableHead>
                <TableHead className="text-right">Reserve (token)</TableHead>
                <TableHead className="text-right">Reserve (XLM)</TableHead>
                <TableHead className="text-right">
                  Implied price (XLM/token)
                </TableHead>
                <TableHead className="text-right">Oracle price (USD)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {POOLS.map((p) => {
                const r = pools[p.id];
                const pd = prices[p.token];
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium text-foreground">
                      <Dot color={TOKEN_INFO[p.token]?.color} />
                      {p.pair}
                    </TableCell>
                    {r ? (
                      <>
                        <TableCell className="text-right tabular-nums">
                          {fmtUnits(r.reserve1, 7, 2)} {tokenSymbol(p.token)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {fmtUnits(r.reserve0, 7, 2)} XLM
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {impliedXlmPrice(r.reserve0, r.reserve1)} XLM
                        </TableCell>
                      </>
                    ) : (
                      <TableCell
                        className="text-right text-muted-foreground"
                        colSpan={3}
                      >
                        Not configured yet
                      </TableCell>
                    )}
                    <TableCell className="text-right tabular-nums">
                      {pd ? `$${fmtUnits(pd.price, PRICE_DECIMALS, 6)}` : "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">About these pools</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Each pool is an Aquarius AMM route configured for testnet use. The{" "}
            <strong>deposit route</strong> on the Deposit tab splits incoming
            XLM across all four routes proportionally to the folio&apos;s target
            weights, then delivers the swapped tokens directly to the folio
            contract which mints SEF shares.
          </p>
          <p>
            Aquarius pool-index hashes are set in <code>.env.local</code> — see{" "}
            <code>.env.example</code> for the variable names. Prices are sourced
            from Reflector oracle relay (tstVELO uses a simulated price because
            Reflector has no VELO feed).
          </p>
        </CardContent>
      </Card>
    </>
  );
}
