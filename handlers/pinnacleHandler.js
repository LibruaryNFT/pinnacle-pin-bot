// eventHandlers/pinnacleHandler.js - UPDATED
const { parseBuyerSellerFromNonFungibleToken } = require("./parseBuyerSeller");
const { fcl } = require("../flow");
const config = require("../config");
const { pinnacleBot, postTweet } = require("../twitterClients");
const { logTweetAttempt } = require("../tweetLogger");
const { getFlowPrice } = require("../metadata");
const { logSkippedEvent } = require("./skippedEventsLogger");
const fs = require("fs");

// Assuming pinnacle.cdc is in the flow directory relative to the project root
const pinnacleCadence = fs.readFileSync("./flow/pinnacle.cdc", "utf-8");
const PINNACLE_NFT_TYPE = "A.edf9df96c92f4595.Pinnacle.NFT";

async function handlePinnacle({
  event,
  txResults,
  displayPrice,
  marketplaceSource,
  nftType,
  nftId,
  nftUuid,
  buyer: providedBuyer,
  seller: providedSeller,
  skipBuyerSellerParsing = false,
  imageUrl = null,
}) {
  try {
    let buyer = providedBuyer;
    let seller = providedSeller;

    // Only parse buyer/seller if not already provided
    if (!skipBuyerSellerParsing) {
      const { seller: rawSeller, buyer: parsedBuyer } =
        parseBuyerSellerFromNonFungibleToken(txResults.events, nftId);
      buyer = parsedBuyer;
      seller = rawSeller;
    }

    // Fallback to storefront or event data seller if NonFungibleToken parsing fails
    const storeAddr = event.data?.storefrontAddress || "";
    if (seller === "UnknownSeller" && storeAddr) {
      seller = storeAddr;
    } else if (seller === "UnknownSeller" && event.data?.seller) {
      seller = event.data.seller;
    }

    // --- Determine address to query the script with ---
    const queryAddress =
      buyer !== "UnknownBuyer"
        ? buyer
        : seller !== "UnknownSeller"
        ? seller
        : null;
    if (!queryAddress) {
      console.error(
        `Cannot query Pinnacle script for NFT ID ${nftId}: No valid buyer or seller address found.`
      );
      const fallbackText = `${displayPrice} SALE on @DisneyPinnacle
Unknown Pin (ID: ${nftId})
Seller: ${seller}
Buyer: ${buyer}
(Could not fetch metadata - address unknown)`;
      return { tweetText: fallbackText, imageUrl: null };
    }

    // Call pinnacle script using the determined query address
    let pinData = null;
    try {
      console.log(
        `Querying Pinnacle script for NFT ID ${nftId} in collection of ${queryAddress}`
      );
      pinData = await fcl.query({
        cadence: pinnacleCadence,
        args: (arg, t) => [
          arg(queryAddress, t.Address),
          arg(String(nftId), t.UInt64),
        ],
      });
    } catch (err) {
      console.error(
        `Error querying pinnacle script for NFT ${nftId} with address ${queryAddress}:`,
        err
      );
      const fallbackText = `${displayPrice} SALE on @DisneyPinnacle
Unknown Pin (ID: ${nftId})
Seller: ${seller}
Buyer: ${buyer}
(Error fetching metadata)`;
      return { tweetText: fallbackText, imageUrl: null };
    }

    if (!pinData) {
      console.error(
        `Pinnacle script returned null for NFT ID ${nftId} in collection of ${queryAddress}`
      );
      const fallbackText = `${displayPrice} SALE on @DisneyPinnacle
Unknown Pin (ID: ${nftId})
Seller: ${seller}
Buyer: ${buyer}
(Could not fetch metadata - script returned null)`;
      return { tweetText: fallbackText, imageUrl: null };
    }

    // --- Parse fields from script output ---
    const editionID = pinData.editionID ?? "N/A";
    const serialNumber = pinData.serialNumber; // Can be null

    let characters = "N/A";
    if (pinData.traits) {
      const charactersTrait = pinData.traits.find(
        (trait) => trait.name === "Characters"
      );
      if (
        charactersTrait &&
        Array.isArray(charactersTrait.value) &&
        charactersTrait.value.length > 0
      ) {
        characters = charactersTrait.value.join(", ");
      } else if (charactersTrait && charactersTrait.value) {
        characters = String(charactersTrait.value);
      }
    }

    let editionName = "Unknown Edition";
    let maxSupply = "N/A";
    if (pinData.editions && pinData.editions.length > 0) {
      editionName = pinData.editions[0].name ?? editionName;
      if (pinData.editions[0].max != null) {
        maxSupply = pinData.editions[0].max.toString();
      }
    }

    // --- Construct Tweet ---
    const pinUrl = `https://disneypinnacle.com/pin/${editionID}`;

    let tweetLines = [
      `${displayPrice} SALE on @DisneyPinnacle`,
      `${editionName}`,
    ];

    if (serialNumber != null) {
      tweetLines.push(`Serial #: ${serialNumber}`);
    }

    tweetLines.push(`Max Mint: ${maxSupply}`);
    tweetLines.push(`Character(s): ${characters}`);
    tweetLines.push(`Edition ID: ${editionID}`);
    tweetLines.push(`Seller: ${seller}`);
    tweetLines.push(`Buyer: ${buyer}`);
    tweetLines.push(pinUrl);

    const tweetText = tweetLines.join("\n");

    return {
      tweetText,
      imageUrl,
    };
  } catch (error) {
    console.error("Error in handlePinnacle:", error);
    return null;
  }
}

async function handlePinnacleEvent(
  event,
  txResults,
  providedBuyer = null,
  providedSeller = null
) {
  const {
    nftId,
    nftType,
    salePrice,
    commissionAmount,
    commissionReceiver,
    customID,
    expiry,
    listingResourceID,
    nftUUID,
    salePaymentVaultType,
    storefrontResourceID,
  } = event.data || {};

  // Extract NFT type properly
  const nftTypeStr = typeof nftType === "string" ? nftType : nftType?.typeID;

  if (
    !nftId ||
    nftId === "UnknownNFTID" ||
    !nftTypeStr ||
    nftTypeStr !== PINNACLE_NFT_TYPE
  ) {
    const reason = {
      nftId: nftId || "undefined",
      nftType: nftTypeStr || "undefined",
      expectedType: PINNACLE_NFT_TYPE,
    };

    logSkippedEvent(event, txResults, reason);
    return null;
  }

  let buyer = providedBuyer;
  let seller = providedSeller;

  // Only parse buyer/seller if not provided
  if (!buyer || !seller) {
    const { seller: rawSeller, buyer: parsedBuyer } =
      parseBuyerSellerFromNonFungibleToken(txResults.events, nftId);
    buyer = parsedBuyer;
    seller = rawSeller;
  }

  // Fallback to storefront or event data seller if NonFungibleToken parsing fails
  const storeAddr = event.data?.storefrontAddress || "";
  if (seller === "UnknownSeller" && storeAddr) {
    seller = storeAddr;
  } else if (seller === "UnknownSeller" && event.data?.seller) {
    seller = event.data.seller;
  }

  // Create event record
  const eventRecord = {
    eventType: "ListingCompleted",
    transactionId: event.transactionId,
    timestamp: new Date(),
    nftId,
    nftType: nftTypeStr,
    nftUUID,
    salePrice,
    commissionAmount,
    commissionReceiver,
    customID,
    expiry,
    listingResourceID,
    salePaymentVaultType,
    storefrontResourceID,
    seller,
    buyer,
    marketplaceSource: "NFTStorefrontV2",
  };

  // Log the event
  if (config.DEBUG_LOG_ALL_EVENTS) {
    console.log("Pinnacle NFT Event:", eventRecord);
  }

  return eventRecord;
}

module.exports = { handlePinnacle, handlePinnacleEvent };
