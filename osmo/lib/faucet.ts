// TESTNET-ONLY faucet: signs payments as the token issuer directly in the
// browser (see .env.example for why that's an acceptable trade-off here, and
// why it must never be done for a real/mainnet issuer). Payments FROM the
// issuing account are how new units of a classic Stellar asset get into
// circulation - no separate "mint" call needed, unlike the SAC/Soroban side.
//
// The destination must already trust each asset (see getMissingTrustlines /
// addTrustlines in lib/folio.ts) - a payment to an untrusted asset fails the
// same way a Folio transfer would.

import { Asset, Horizon, Keypair, Operation, TransactionBuilder } from "@stellar/stellar-sdk";
import { FAUCET_AMOUNTS, HORIZON_URL, NETWORK_PASSPHRASE, TEST_ISSUER_SECRET, TRUSTLINE_ASSETS } from "@/lib/config";

const horizon = new Horizon.Server(HORIZON_URL);

/** Send one drip of every basket asset (+ some XLM for fees) to `destination`. */
export async function dripTestTokens(destination: string): Promise<void> {
  const issuer = Keypair.fromSecret(TEST_ISSUER_SECRET);
  const issuerAccount = await horizon.loadAccount(issuer.publicKey());

  let tx = new TransactionBuilder(issuerAccount, {
    fee: (100 * (TRUSTLINE_ASSETS.length + 1)).toString(),
    networkPassphrase: NETWORK_PASSPHRASE,
  }).addOperation(
    Operation.payment({ destination, asset: Asset.native(), amount: FAUCET_AMOUNTS.XLM }),
  );
  for (const a of TRUSTLINE_ASSETS) {
    tx = tx.addOperation(
      Operation.payment({
        destination,
        asset: new Asset(a.code, a.issuer),
        amount: FAUCET_AMOUNTS[a.code],
      }),
    );
  }

  const built = tx.setTimeout(60).build();
  built.sign(issuer);
  const res = await horizon.submitTransaction(built);
  if (!res.successful) throw new Error("faucet transaction failed");
}
