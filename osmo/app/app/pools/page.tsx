"use client";

// Pools page: live reserve data for every seeded XLM-hub Soroswap pair that
// the folio uses for single-asset deposit routing.
// Note: the Soroswap public testnet dashboard doesn't index pools created
// outside its UI - we query the pair contracts directly via the Soroban RPC.

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import {
  cardClass,
  Dot,
  PageHeader,
  tokenSymbol,
} from "@/components/app/shared";
import { TOKEN_INFO } from "@/lib/config";

/** Compute the implied XLM price of the paired token from pool reserves.
 *  reserve0 is the paired token (7 decimals), reserve1 is XLM (7 decimals).
 *  price_xlm = reserve0 / reserve1  (token units per XLM)
 *  We want XLM per token: reserve1 / reserve0.
 */
function impliedXlmPrice(
  reserve0: bigint,
  reserve1: bigint,
  tokenDecimals = 7,
): string {
  if (reserve0 === 0n) return "—";
  // price in XLM per token-unit, scaled to PRICE_DECIMALS for display
  const scale = 10n ** BigInt(PRICE_DECIMALS);
  const price = (toBig(reserve1) * scale) / toBig(reserve0);
  return fmtUnits(price, PRICE_DECIMALS, 6);
}

export default function PoolsPage() {
  const { pools, prices } = useFolio();

  return (
    <>
      <PageHeader
        title="Soroswap Pools"
        subtitle="Reserve data read directly from each XLM-hub pair contract on Stellar testnet — the pools that power the single-asset deposit route."
      />

      <Card className={cardClass}>
        <CardHeader>
          <CardTitle className="font-heading text-lg">Pair reserves</CardTitle>
          <CardDescription>
            Depositing XLM triggers a swap through each of these pairs to build
            the full basket composition in one transaction.
          </CardDescription>
        </CardHeader>
        <CardContent>
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
                          {fmtUnits(r.reserve0, 7, 2)} {tokenSymbol(p.token)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {fmtUnits(r.reserve1, 7, 2)} XLM
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
                        Not seeded yet
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

      <Card className={cardClass}>
        <CardHeader>
          <CardTitle className="font-heading text-lg">
            About these pools
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Each pool is a 50/50 constant-product AMM seeded manually for
            testnet purposes. The <strong>deposit route</strong> on the Deposit
            tab splits incoming XLM across all four pairs proportionally to the
            folio's target weights, then delivers the swapped tokens directly to
            the folio contract which mints SEF shares.
          </p>
        </CardContent>
      </Card>
    </>
  );
}
