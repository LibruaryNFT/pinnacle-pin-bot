// eventHandlers/index.js - Pinnacle-only version
require("dotenv").config();

const {
  getTransactionResults,
  executeGetEditionScript,
  getLatestBlock,
  getEvents,
  subscribeToEvents,
} = require("../flow");
const { postTweet, verifyCredentials } = require("../twitterClients");
const { logAllEvents } = require("./logger");
const {
  logTweetAttempt,
  logTweetSuccess,
  logTweetError,
} = require("../utils/logger");
const { fcl } = require("../flow");
const { handlePinnacle, handlePinnacleEvent } = require("./pinnacleHandler");
const { getFlowPrice } = require("../metadata");
const config = require("../config");
const { parseBuyerSellerFromNonFungibleToken } = require("./parseBuyerSeller");
const path = require("path");
const fs = require("fs");
const t = require("@onflow/types");

// Import the Twitter client
const { pinnacleBot } = require("../twitterClients");

// --- Constants ---
const PINNACLE_NFT_TYPE = "A.edf9df96c92f4595.Pinnacle.NFT";
const NFTSTOREFRONT_V2_STD_PREFIX = "A.4eb8a10cb9f87357.NFTStorefrontV2";
const FLOW_VAULT = "A.1654653399040a61.FlowToken.Vault";
const LISTING_COMPLETED_EVENT =
  "A.4eb8a10cb9f87357.NFTStorefrontV2.ListingCompleted";
const WITHDRAWN_EVENT = "A.1d7e57aa55817448.NonFungibleToken.Withdrawn";
const DEPOSITED_EVENT = "A.1d7e57aa55817448.NonFungibleToken.Deposited";
// --- End Constants ---

const postedTxIds = new Set();
let lastStatusUpdate = Date.now();
let eventsProcessed = 0;
let salesFound = 0;
let salesBelowThreshold = 0;
let lastBlockHeight = 0;

// Add retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000; // 2 seconds

// Add retry helper function
async function withRetry(
  operation,
  description = "Operation",
  maxRetries = MAX_RETRIES
) {
  let lastError;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      console.error(
        `Attempt ${i + 1}/${maxRetries} failed for ${description}:`,
        error
      );
      if (i < maxRetries - 1) {
        console.log(`Retrying in ${RETRY_DELAY / 1000}s...`);
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
      }
    }
  }
  throw new Error(
    `Failed after ${maxRetries} attempts: ${
      lastError?.message || "Unknown error"
    }`
  );
}

// --- Helper Functions ---
function parseCommandLineArgs() {
  const args = process.argv.slice(2);
  const options = {
    mode: "production",
    blockHeight: null,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith("--mode=")) {
      options.mode = arg.split("=")[1];
    } else if (arg.startsWith("--blockheight=")) {
      options.blockHeight = parseInt(arg.split("=")[1]);
    }
  }

  return options;
}

function determineMarketplaceSource(eventType) {
  if (eventType.startsWith(NFTSTOREFRONT_V2_STD_PREFIX))
    return "NFTStorefrontV2";
  return "Unknown";
}

async function ensureTxResults(event, txResults) {
  if (!txResults) {
    try {
      txResults = await withRetry(async () => {
        return await fcl.tx(event.transactionId).onceSealed();
      });
    } catch (err) {
      console.error(
        `Failed to get transaction results for ${event.transactionId} after ${MAX_RETRIES} retries:`,
        err.message
      );
      return null;
    }
  }

  // Extract NFT type properly
  let nftType = "Unknown";
  if (event.data?.nftType) {
    if (typeof event.data.nftType === "string") {
      nftType = event.data.nftType;
    } else if (event.data.nftType.typeID) {
      nftType = event.data.nftType.typeID;
    }
  }

  return {
    nftType,
    nftId: event.data?.nftID ?? "UnknownNFTID",
    nftUuid: event.data?.nftUUID ?? null,
    txResults,
  };
}

// --- Test Mode Functions ---
/**
 * Process a specific block for testing
 * @param {number} blockHeight - Block height to process
 */
async function processTestBlock(blockHeight) {
  console.log(
    `\n=== Testing Pinnacle NFT Event Processing at Block ${blockHeight} ===\n`
  );
  console.log("-------- Price Threshold (USD) --------");
  console.log(`Pinnacle Bot: >= $${config.PINNACLE_PRICE_THRESHOLD}`);
  console.log("----------------------------------------\n");

  try {
    // Verify Twitter credentials first
    const isInitialized = await verifyCredentials();
    if (!isInitialized) {
      console.error(
        "Failed to initialize Twitter client. Please check your .env file."
      );
      process.exit(1);
    }
    console.log("Twitter client initialized successfully.\n");

    console.log(`Fetching events for block ${blockHeight}...`);
    const blockResults = await withRetry(async () => {
      const result = await getEvents(
        LISTING_COMPLETED_EVENT,
        blockHeight,
        blockHeight
      );
      return result || [];
    }, "Fetching events for test block");

    // Extract and decode events from block results
    const events = blockResults.flatMap((block) => {
      return (block.events || []).map((event) => {
        // Decode the base64 payload
        const decodedPayload = Buffer.from(event.payload, "base64").toString();
        const parsedPayload = JSON.parse(decodedPayload);

        // Extract the actual event data from the payload
        const eventData = parsedPayload.value.fields.reduce((acc, field) => {
          if (field.name === "nftType") {
            // Special handling for nftType
            acc[field.name] = {
              typeID: field.value.value.staticType.typeID,
            };
          } else if (field.value.type === "UFix64") {
            acc[field.name] = parseFloat(field.value.value);
          } else if (field.value.type === "UInt64") {
            acc[field.name] = field.value.value;
          } else if (field.value.type === "Bool") {
            acc[field.name] = field.value.value;
          } else if (field.value.type === "Optional") {
            acc[field.name] = field.value.value?.value || null;
          } else {
            acc[field.name] = field.value.value;
          }
          return acc;
        }, {});

        // Debug log the event data
        console.log("\nDecoded Event Data:");
        console.log("----------------------------------------");
        console.log(JSON.stringify(eventData, null, 2));
        console.log("----------------------------------------\n");

        // Create the properly formatted event object
        return {
          type: event.type,
          transactionId: event.transaction_id,
          transactionIndex: parseInt(event.transaction_index),
          eventIndex: parseInt(event.event_index),
          data: eventData,
        };
      });
    });

    if (!events || events.length === 0) {
      console.log("No events found in this block.");
      return;
    }

    console.log(`Found ${events.length} events in block ${blockHeight}`);
    console.log("Processing events...\n");

    // Process each event
    for (const event of events) {
      try {
        // Debug log the event before processing
        console.log("\nProcessing Event:");
        console.log("----------------------------------------");
        console.log(JSON.stringify(event, null, 2));
        console.log("----------------------------------------\n");

        await handleEvent(event, true);
      } catch (error) {
        console.error("Error processing event:", error?.message || error);
      }
    }

    console.log("\n=== Test Block Processing Complete ===");
  } catch (error) {
    console.error("Error during test:", error?.message || error);
    if (error?.stack) {
      console.error("Stack trace:", error.stack);
    }
  }
}

// Add continuous block monitoring
async function monitorBlocks() {
  try {
    const latestBlock = await withRetry(async () => {
      return await getLatestBlock();
    });

    if (!latestBlock) {
      throw new Error("Failed to get latest block");
    }

    const currentHeight = latestBlock.height;
    const timestamp = new Date().toISOString();

    if (lastBlockHeight === 0) {
      lastBlockHeight = currentHeight;
      console.log(
        `[${timestamp}] Starting block monitoring at height ${currentHeight}`
      );
    } else if (currentHeight > lastBlockHeight) {
      console.log(
        `[${timestamp}] Block ${lastBlockHeight} → ${currentHeight} (${
          currentHeight - lastBlockHeight
        } new blocks)`
      );
      lastBlockHeight = currentHeight;
    }
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] Error getting latest block after ${MAX_RETRIES} retries:`,
      error.message
    );
  }
}

// Add status update function
async function updateStatus() {
  const now = Date.now();
  if (now - lastStatusUpdate >= 10000) {
    // Update every 10 seconds
    try {
      console.log(
        `\nStats: Events: ${eventsProcessed} | Sales: ${salesFound} (${salesBelowThreshold} below $${config.PINNACLE_PRICE_THRESHOLD})`
      );

      lastStatusUpdate = now;
      eventsProcessed = 0;
      salesFound = 0;
      salesBelowThreshold = 0;
    } catch (error) {
      console.error("Error updating status:", error);
    }
  }
}

// --- Main Event Handler ---
async function handleEvent(event, isTestMode = false) {
  eventsProcessed++;
  if (!pinnacleBot && !isTestMode) {
    console.error(
      "Twitter client not available in handleEvent. Aborting processing."
    );
    return;
  }

  const txId = event.transactionId;
  try {
    if (postedTxIds.has(txId)) return;
    if (!event.data?.purchased) return;

    // Initial extraction
    const rawPrice = parseFloat(
      event.data?.salePrice || event.data?.price || "0"
    );
    if (rawPrice <= 0) return;

    const rawVault = event.data?.salePaymentVaultType;
    let vaultType = "";
    if (typeof rawVault === "string") {
      vaultType = rawVault.trim();
    } else if (rawVault && typeof rawVault === "object") {
      const maybe =
        rawVault.staticType?.typeID ??
        rawVault.value?.typeID ??
        rawVault.typeID;
      if (typeof maybe === "string") vaultType = maybe.trim();
    } else if (rawVault != null) {
      vaultType = String(rawVault).trim();
    }

    const evtType = event.type;
    const marketplaceSource = determineMarketplaceSource(evtType);

    // Price conversion
    const flowUsd = await getFlowPrice();
    if (flowUsd === null) return;

    const priceUSD = vaultType === FLOW_VAULT ? rawPrice * flowUsd : rawPrice;
    if (priceUSD <= 0) return;

    const displayPrice =
      vaultType === FLOW_VAULT
        ? `${rawPrice.toFixed(2)} FLOW (~$${priceUSD.toFixed(2)} USD)`
        : `$${priceUSD.toFixed(2)} USD (~${(priceUSD / flowUsd).toFixed(
            2
          )} FLOW)`;

    // Fetch Tx results using REST endpoint
    const txResults = await getTransactionResults(txId);
    if (!txResults) return;

    const {
      txResults: txResultsData,
      nftType,
      nftId,
    } = await ensureTxResults(event, txResults);

    // Only process Pinnacle events
    if (nftType !== PINNACLE_NFT_TYPE) return;

    salesFound++;
    const pinnacleThreshold = config.PINNACLE_PRICE_THRESHOLD;

    // In test mode, process all sales regardless of price
    const shouldProcess = isTestMode || priceUSD >= pinnacleThreshold;
    if (shouldProcess) {
      // Get buyer and seller information
      const { buyer, seller } = parseBuyerSellerFromNonFungibleToken(
        txResultsData.events,
        nftType,
        nftId
      );

      // Skip if we can't get buyer/seller info
      if (
        !buyer ||
        !seller ||
        buyer === "UnknownBuyer" ||
        seller === "UnknownSeller"
      ) {
        console.log(
          `Skipping - Could not determine buyer/seller for NFT ${nftId}`
        );
        return;
      }

      console.log(
        `\nFound Pinnacle Sale${isTestMode ? "" : " Above Threshold"}:`
      );
      console.log(`Price: ${displayPrice}`);
      console.log(`NFT ID: ${nftId}`);

      if (nftId !== "UnknownNFTID" && nftType !== "Unknown") {
        // First get the NFT data including editionID using pinnacle.cdc
        const scriptPath = path.join(__dirname, "..", "flow", "pinnacle.cdc");
        const script = fs.readFileSync(scriptPath, "utf8");

        const nftData = await fcl
          .send([
            fcl.script(script),
            fcl.args([fcl.arg(buyer, t.Address), fcl.arg(nftId, t.UInt64)]),
          ])
          .then(fcl.decode);

        if (!nftData) {
          console.log(`No NFT data found for ID: ${nftId}`);
          return;
        }

        // Now get the edition data using the editionID
        const editionData = await executeGetEditionScript(nftData.editionID);
        let imageUrl = null;

        if (editionData?.renderID) {
          // Using front.png for full image, front_cropped.png is also available
          imageUrl = `https://assets.disneypinnacle.com/render/${editionData.renderID}/front.png`;
        }

        const handlerArgs = {
          event,
          txResults,
          displayPrice: `$${parseFloat(event.data.salePrice).toFixed(2)} USD`,
          marketplaceSource: "NFTStorefrontV2",
          nftType: event.data.nftType.typeID,
          nftId,
          nftUuid: event.data?.nftUUID ?? null,
          buyer,
          seller,
          skipBuyerSellerParsing: true,
          imageUrl,
          editionData,
        };

        const tweetRes = await handlePinnacle(handlerArgs);
        if (tweetRes?.tweetText) {
          if (isTestMode) {
            console.log("\nWould tweet:");
            console.log("----------------------------------------");
            console.log(tweetRes.tweetText);
            if (imageUrl) {
              console.log("\nImage URL:", imageUrl);
            }
            console.log("----------------------------------------\n");
          } else {
            // Define tweetData before the try block so it's available in catch
            const tweetData = {
              nftId,
              price: priceUSD,
              editionId: editionData?.id,
              renderID: editionData?.renderID,
              imageUrl,
              tweetText: tweetRes.tweetText,
              editionData: editionData
                ? {
                    id: editionData.id,
                    renderID: editionData.renderID,
                    seriesID: editionData.seriesID,
                    setID: editionData.setID,
                    shapeID: editionData.shapeID,
                    variant: editionData.variant,
                    description: editionData.description,
                    traits: editionData.traits,
                  }
                : null,
            };

            try {
              logTweetAttempt(tweetData);

              if (!editionData?.renderID) {
                throw new Error(
                  `No renderID found in edition data for NFT ${nftId}`
                );
              }

              await postTweet(tweetRes.tweetText, imageUrl);
              postedTxIds.add(txId);
              logTweetSuccess(tweetData);
            } catch (e) {
              logTweetError(tweetData, e);
            }
          }
        }

        // Handle Pinnacle event with the already parsed buyer/seller
        if (
          nftId &&
          nftId !== "UnknownNFTID" &&
          nftType === PINNACLE_NFT_TYPE
        ) {
          await handlePinnacleEvent(event, txResults, buyer, seller);
        }
      }
    } else {
      salesBelowThreshold++;
      console.log(
        `Skipped - Price $${priceUSD.toFixed(2)} below $${
          config.PINNACLE_PRICE_THRESHOLD
        } threshold`
      );
    }

    await updateStatus();
  } catch (err) {
    console.error(`Error in handleEvent for tx ${txId}:`, err);
  }
}

// --- Main Entry Point ---
async function main() {
  const options = parseCommandLineArgs();

  if (options.mode === "test") {
    if (!options.blockHeight) {
      console.error(
        "Block height is required in test mode. Use --blockheight=<number>"
      );
      process.exit(1);
    }
    await processTestBlock(options.blockHeight);
  } else {
    // Production mode - start listening for events
    console.log("Starting in production mode...");
    console.log("=== Pinnacle NFT Event Monitor ===");
    console.log(`FLOW Access Node: ${config.FLOW_ACCESS_NODE}`);
    console.log("-------- Monitor Status --------");
    console.log(
      `Event Logging: ${config.DEBUG_LOG_ALL_EVENTS ? "ENABLED" : "DISABLED"}`
    );
    console.log("\n-------- Price Thresholds (USD) --------");
    console.log(`Pinnacle Bot: > $${config.PINNACLE_PRICE_THRESHOLD}`);
    console.log("\n-------- Monitored Contracts --------");
    console.log("NFTStorefrontV2: 0x4eb8a10cb9f87357");
    console.log("----------------------------------------\n");

    try {
      // Initialize Twitter client
      const isInitialized = await verifyCredentials();
      if (!isInitialized) {
        console.error(
          "Failed to initialize Twitter client. Please check your .env file."
        );
        process.exit(1);
      }

      // Configure FCL
      fcl
        .config()
        .put("accessNode.api", config.FLOW_ACCESS_NODE)
        .put("fcl.pollingInterval", 2000);

      // Start event subscription
      await subscribeToEvents({
        fcl,
        events: [LISTING_COMPLETED_EVENT],
        onEvent: handleEvent,
        onError: (err) => console.error("Subscription error:", err),
      });

      console.log(
        "Event subscription started. Waiting for Pinnacle NFT events..."
      );
    } catch (error) {
      console.error("Error in production mode:", error);
      process.exit(1);
    }
  }
}

// Run the main function if this file is being run directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { handleEvent, processTestBlock };
