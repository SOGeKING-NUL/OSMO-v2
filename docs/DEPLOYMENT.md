# Nebula DTF — Current Deployment (testnet)

Living reference: **overwrite this file after every redeploy**, unlike `DECISION_LOG.md`
(append-only history) or `CHALLENGES_AND_DECISIONS.md` (append-only findings). This doc
answers one question: "what's live right now, and who controls it."

Source of truth for addresses: `.stellar/nebula-testnet.json` (git-ignored, machine-local) and
`app/.env` (git-ignored — holds a secret, see below; `app/.env.example` is the checked-in
template).

---

## Contracts (network: testnet)

Explorer pattern: `https://stellar.expert/explorer/testnet/contract/<ID>`

| Contract | Address |
|---|---|
| **Folio v2 (SEF — adds `mint_single_asset`)** | [`CCOMNDEZSPR7ZXCPCVOKCGQEPAG33UAYTTR526P63P7HIPEXPJXVCQKB`](https://stellar.expert/explorer/testnet/contract/CCOMNDEZSPR7ZXCPCVOKCGQEPAG33UAYTTR526P63P7HIPEXPJXVCQKB) |
| Folio v1 (superseded, still live) | [`CCFC3Z74YYOXMRZMXZTSGO4KCARSZW3CDSNLGV63E5RAEBWIGW2E54LB`](https://stellar.expert/explorer/testnet/contract/CCFC3Z74YYOXMRZMXZTSGO4KCARSZW3CDSNLGV63E5RAEBWIGW2E54LB) |
| OracleRouter | [`CDNQIEPDPXERUSA3NT7XOY7TTO2DDQLJN2QHDQF5WECYT2I7VDUDMJJP`](https://stellar.expert/explorer/testnet/contract/CDNQIEPDPXERUSA3NT7XOY7TTO2DDQLJN2QHDQF5WECYT2I7VDUDMJJP) |
| Factory | [`CDB4QKNAOXY35X6IJK6ISFJ222YLZ7RH6JU6YKK5A4U6XZ4M62MAUS7U`](https://stellar.expert/explorer/testnet/contract/CDB4QKNAOXY35X6IJK6ISFJ222YLZ7RH6JU6YKK5A4U6XZ4M62MAUS7U) |
| MockPriceFeed | [`CA4FRZJLT2GXNNXHNWW46WL2A3MIZMYUMCP3ZHDLVP2UI7KD2FHYOIPS`](https://stellar.expert/explorer/testnet/contract/CA4FRZJLT2GXNNXHNWW46WL2A3MIZMYUMCP3ZHDLVP2UI7KD2FHYOIPS) |

## Basket tokens (SEF: XLM 40 / tstAQUA 20 / tstVELO 15 / tstUSDC 15 / tstEURC 10)

| Token | Address | Price source |
|---|---|---|
| XLM (native SAC) | [`CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC`](https://stellar.expert/explorer/testnet/contract/CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC) | real, relayed from mainnet Reflector |
| tstAQUA | [`CBGN3EZONL2CJK4342UBBMNVTQRX2DD6QSE45EKEGCYHCE5W76CTV37L`](https://stellar.expert/explorer/testnet/contract/CBGN3EZONL2CJK4342UBBMNVTQRX2DD6QSE45EKEGCYHCE5W76CTV37L) | real, relayed from mainnet Reflector |
| tstVELO | [`CCKCOVTJ7V3VXZYUJXMNQZT6O5JEX6CKCGXW3HCJSIYMTLAX2K6E5Z3T`](https://stellar.expert/explorer/testnet/contract/CCKCOVTJ7V3VXZYUJXMNQZT6O5JEX6CKCGXW3HCJSIYMTLAX2K6E5Z3T) | **simulated — no real feed exists (ADR-014)** |
| tstUSDC | [`CAK7ZU7IWDNJWB5W4F73RDNAYQMO5DVHDNGL5NLUYCGWTYDWF444VMX7`](https://stellar.expert/explorer/testnet/contract/CAK7ZU7IWDNJWB5W4F73RDNAYQMO5DVHDNGL5NLUYCGWTYDWF444VMX7) | fixed $1.00 (oracle's own numeraire) |
| tstEURC | [`CAHXEUFDYCQ6GHFXL52CFSPAOMYIJHFDHN7B2NO6ZRRXFRNLLSHMYJXX`](https://stellar.expert/explorer/testnet/contract/CAHXEUFDYCQ6GHFXL52CFSPAOMYIJHFDHN7B2NO6ZRRXFRNLLSHMYJXX) | real, relayed from mainnet Reflector |

## Reference: mainnet Reflector (read-only source for the relay, not a Nebula contract)

`CALI2BYU2JE6WVRUFYTS6MSBNEHGJ35P4AVCZYF3B6QOE3QKOB2PLE6M` — "Stellar Pubnet Pulse Oracle",
queried read-only from `scripts/price-relay.ps1`. See ADR-014 in `DECISION_LOG.md`.

## Aquarius AMM routes (testnet)

OSMO now uses the Aquarius AMM entry contract for `mint_single_asset`.

| Contract | Address |
|---|---|
| Aquarius AMM entry (testnet) | [`CBQDHNBFBZYE4MKPWBSJOPIYLW4SFSXAXUTSXJN76GNKYVYPCKWC6QUK`](https://stellar.expert/explorer/testnet/contract/CBQDHNBFBZYE4MKPWBSJOPIYLW4SFSXAXUTSXJN76GNKYVYPCKWC6QUK) |

The folio stores one Aquarius route for each XLM -> basket-token leg via
`set_aquarius_route(token_in, token_out, route)`. Route entries use Aquarius'
public `swap_chained` shape: `(pool_tokens, pool_index, token_out)`.

Required local config keys in `.stellar/nebula-testnet.json`:

| Pair | Config key |
|---|---|
| XLM / tstAQUA | `aquarius_pool_tstaqua_xlm` |
| XLM / tstVELO | `aquarius_pool_tstvelo_xlm` |
| XLM / tstUSDC | `aquarius_pool_tstusdc_xlm` |
| XLM / tstEURC | `aquarius_pool_tsteurc_xlm` |

After filling those pool-index hashes from Aquarius pool/path discovery, run
`scripts/seed-pools.ps1` to verify reserves are readable, then
`scripts/deploy-folio-v2.ps1` to wire the Aquarius router and routes into a
fresh folio.

---

## Local CLI identities (`stellar keys ls`)

| Identity | Address | Role |
|---|---|---|
| **`nebula-admin`** | `GA45OKGDSZ62BTHWDTJXTPCVRQANB75A7WU6WJL3XQIY2FBCKFJJFU5N` | **Owner of every contract above.** Deployed Factory/OracleRouter/MockPriceFeed; set as `admin` on the Folio and router. Can pause/unpause the Folio, change oracle feeds/config, push a new Folio version via the factory. |
| `nebula-test-issuer` | `GDIYTKW2SS3OVYPHZJ2QOJSSKVPME5GQLRHDJNZ3OZRP6QJHAEFXTZT3` | Issuer of the 4 fake test tokens. No control over any contract — only power is minting more of those 4 worthless assets. Its secret is the one embedded in the app's faucet (`VITE_TEST_ISSUER_SECRET`, testnet-only — see `app/.env.example`). |
| `nebula-user` | `GDX3PNEUFDL33DQUSOSL2ZFULRUE3OVZOESMK3FR6ERS7DWJXYQSOL7J` | Plain demo account, no admin rights. Holds the first ~99.99998 SEF shares from performing the original bootstrap deposit. |

Get any secret locally with `stellar keys secret <name>` — never commit these; `nebula-admin`'s
and `nebula-user`'s never need to leave your machine, `nebula-test-issuer`'s is the one
intentionally placed in `app/.env` (git-ignored) for the faucet.
