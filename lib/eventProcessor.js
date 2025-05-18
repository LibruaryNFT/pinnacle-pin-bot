// lib/eventProcessor.js
const fcl = require("@onflow/fcl");
const { log } = require("./logger");
const cfg = require("../config");
const { twitterClient } = require("../twitterClients"); // you already had this
const { getEdition } = require("../metadata"); // your existing helper
const { getUsdPrice } = require("../flow"); // flowprice.cdc wrapper

/**
 * Extract buyer & seller by scanning Withdrawn/Deposited events in the same tx
 */
async function getBuyerSeller(txId) {
  const txResult = await fcl.tx(txId).onceSealed();
  let seller = "unknown",
    buyer = "unknown";

  txResult.events.forEach((ev) => {
    const id = ev.type;
    if (id === "A.1d7e57aa55817448.NonFungibleToken.Withdrawn") {
      seller = ev.data.from?.value ?? "unknown";
    }
    if (id === "A.1d7e57aa55817448.NonFungibleToken.Deposited") {
      buyer = ev.data.to?.value ?? "unknown";
    }
  });
  return { seller, buyer };
}

/**
 * Compose Disney Pinnacle tweet exactly like test script
 */
function composeTweet(details) {
  const { usd, meta, editionId, seller, buyer } = details;

  return `$${usd.toFixed(2)} USD SALE on @DisneyPinnacle
${meta.title}
Max Mint: ${meta.maxMint}
Character(s): ${meta.characters.join(", ")}
Edition ID: ${editionId}
Seller: 0x${seller.replace(/^0x/, "")}
Buyer: 0x${buyer.replace(/^0x/, "")}
https://disneypinnacle.com/pin/${editionId}

Image URL: ${meta.imageUrl}`;
}

/**
 * Main handler – call from both test and prod
 */
async function handleListing(evt, { isDryRun = false } = {}) {
  try {
    // ── filter only Pinnacle NFT events ──
    if (evt.data.nftType.typeID !== cfg.PINNACLE_NFT_TYPE) return;

    // basic fields
    const { transactionId, data } = evt;
    const salePrice = Number(data.salePrice);
    const vaultType = data.salePaymentVaultType?.staticType?.typeID;

    // sale price in USD (simple rule: DUC vault == already USD)
    const usd =
      vaultType === "A.ead892083b3e2c6c.DapperUtilityCoin.Vault"
        ? salePrice
        : await getUsdPrice(vaultType, salePrice);

    // honour price threshold in prod
    if (!isDryRun && usd < cfg.PRICE_THRESHOLD_USD) return;

    // pull buyer / seller
    const { seller, buyer } = await getBuyerSeller(transactionId);

    // look up edition & metadata
    const editionId = await getEdition(data.nftID); // your existing Cadence script
    const meta = await require("../utils").formatEdition(editionId); // reuse formatter

    // compose tweet
    const tweet = composeTweet({ usd, meta, editionId, seller, buyer });

    if (cfg.TWITTER_DRY_RUN || isDryRun) {
      log("info", "Would tweet:\n" + tweet + "\n");
    } else {
      await twitterClient.v2.tweet(tweet);
      log("info", `Tweeted sale ${editionId} for $${usd}`);
    }
  } catch (err) {
    log("error", "handleListing failed", err);
  }
}

module.exports = { handleListing };
