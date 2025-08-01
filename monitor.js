require("dotenv").config();
const fcl = require("@onflow/fcl");
const fetch = require("node-fetch");
const t = require("@onflow/types");
const fs = require("fs");
const path = require("path");
const { TwitterApi } = require("twitter-api-v2");
const { subscribeToEvents } = require("fcl-subscribe");

/* ── File Logging Setup ─────────────────────────────────── */
// Create log file with timestamp
const logFileName = `pinnacle-bot-${new Date().toISOString().split('T')[0]}.log`;
const logFilePath = path.join(__dirname, logFileName);

// Function to write to log file
function writeToLogFile(message) {
  try {
    fs.appendFileSync(logFilePath, message + '\n');
  } catch (error) {
    // Silently fail if we can't write to log file
  }
}

/* ── Config ─────────────────────────────────────────────── */
const config = {
  /* Flow */
  FLOW_ACCESS_NODE:
    process.env.FLOW_ACCESS_NODE || "https://mainnet.onflow.org",
  FLOW_REST_ENDPOINT:
    process.env.FLOW_REST_ENDPOINT || "https://rest-mainnet.onflow.org",

  /* Pinnacle */
  PINNACLE_NFT_TYPE: "A.edf9df96c92f4595.Pinnacle.NFT",
  PINNACLE_PRICE_THRESHOLD: 200,
  EVENT_TYPES: {
    LISTING_COMPLETED: [
      "A.4eb8a10cb9f87357.NFTStorefrontV2.ListingCompleted",
      "A.3cdbb3d569211ff3.NFTStorefrontV2.ListingCompleted",
    ],
    OFFER_COMPLETED: "A.b8ea91944fd51c43.OffersV2.OfferCompleted",
  },

  /* Command-line flag parsing */
  ENABLE_TWEETS: process.argv.includes("--live-tweets"),
  IS_BACKFILL: process.argv.includes("--backfill"),
};

/* ── Image Cache ────────────────────────────────────────── */
// Removed caching to ensure images are always included in tweets

/* ── Logger ─────────────────────────────────────────────── */
function log(type, message, data = {}) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${type.toUpperCase()}: ${message}`;
  
  // Console output
  console.log(logMessage);
  if (Object.keys(data).length > 0) {
    const dataMessage = JSON.stringify(data, null, 2);
    console.log(dataMessage);
  }
  
  // File output
  writeToLogFile(logMessage);
  if (Object.keys(data).length > 0) {
    writeToLogFile(JSON.stringify(data, null, 2));
  }
}

/* ── Twitter Client ─────────────────────────────────────── */
let twitterClient;
if (config.ENABLE_TWEETS) {
  twitterClient = new TwitterApi({
    appKey: process.env.TWITTER_API_KEY,
    appSecret: process.env.TWITTER_API_SECRET,
    accessToken: process.env.PINNACLEPINBOT_ACCESS_TOKEN,
    accessSecret: process.env.PINNACLEPINBOT_ACCESS_SECRET,
  });
}

/* ── Flow Setup ─────────────────────────────────────────── */
fcl
  .config()
  .put("accessNode.api", config.FLOW_ACCESS_NODE)
  .put("fcl.eventPollRate", 500); // Reduced to 500ms for faster response

/* ── Cadence Scripts ────────────────────────────────────── */
let pinnacleScript, editionScript;
try {
  pinnacleScript = fs.readFileSync(
    path.join(__dirname, "flow", "pinnacle.cdc"),
    "utf8"
  );
  editionScript = fs.readFileSync(
    path.join(__dirname, "flow", "get_edition.cdc"),
    "utf8"
  );
} catch (error) {
  log("error", "Failed to load Cadence scripts from /flow directory.", error);
  process.exit(1);
}

/* ── Helper Functions ───────────────────────────────────── */
async function retry(op, n = 3, d = 1000) {
  let lastErr;
  for (let i = 0; i < n; i++) {
    try {
      return await op();
    } catch (err) {
      lastErr = err;
      if (i < n - 1) await new Promise((r) => setTimeout(r, d));
    }
  }
  throw lastErr;
}

async function get(url) {
  return retry(async () => {
    const res = await fetch(url);
    if (!res.ok) {
      const errorBody = await res.text();
      throw new Error(`Request Failed: ${res.status} ${res.statusText} - ${errorBody}`);
    }
    return res.json();
  });
}

function extract(v) {
  if (!v || typeof v !== "object") return v;
  
  // Handle Type objects specifically
  if (v.type === "Type" && v.value && v.value.staticType && v.value.staticType.typeID) {
    return v.value.staticType.typeID;
  }
  
  // Handle regular value objects
  if ("value" in v) {
    return extract(v.value);
  }
  
  return v;
}

function decodeEvent(evt) {
  if (!evt || !evt.payload) return evt;
  if (evt.data) return evt; // Already decoded
  try {
    const j = JSON.parse(Buffer.from(evt.payload, "base64").toString());
    const obj = {};
    j.value.fields.forEach((f) => {
      obj[f.name] = extract(f.value);
    });
    return { ...evt, data: obj };
  } catch (e) {
    log('warn', 'Could not decode event payload', { payload: evt.payload });
    return evt;
  }
}

function decodeEventPayloadBase64(payloadBase64) {
  try {
    const buff = Buffer.from(payloadBase64, "base64");
    return JSON.parse(buff.toString("utf-8"));
  } catch {
    return null;
  }
}

function unwrapAddressField(fieldValue) {
  // Case 1: plain string
  if (typeof fieldValue === "string") return fieldValue;
  
  // Case 2: { value:"0xabc", type:"Address" }
  if (fieldValue && typeof fieldValue.value === "string")
    return fieldValue.value;
  
  // Case 3: { value:{ value:"0xabc", type:"Address" }, type:"Optional" }
  if (
    fieldValue &&
    typeof fieldValue.value === "object" &&
    fieldValue.value.value &&
    typeof fieldValue.value.value === "string"
  ) {
    return fieldValue.value.value;
  }
  
  // Case 4: { value:{ value:"0xabc", type:"Address" }, type:"Optional" } - different structure
  if (
    fieldValue &&
    typeof fieldValue.value === "object" &&
    fieldValue.value.value &&
    typeof fieldValue.value.value === "string" &&
    fieldValue.value.type === "Address"
  ) {
    return fieldValue.value.value;
  }
  
  // Case 5: Direct object with address property
  if (fieldValue && typeof fieldValue === "object" && fieldValue.address) {
    return fieldValue.address;
  }
  
  // Case 6: Nested object with address in different location
  if (fieldValue && typeof fieldValue === "object") {
    // Try to find any string that looks like an address
    const findAddress = (obj) => {
      for (const [key, value] of Object.entries(obj)) {
        if (typeof value === "string" && value.startsWith("0x") && value.length === 18) {
          return value;
        }
        if (typeof value === "object" && value !== null) {
          const found = findAddress(value);
          if (found) return found;
        }
      }
      return null;
    };
    
    const found = findAddress(fieldValue);
    if (found) return found;
  }
  
  // Debug logging for unknown formats
  if (fieldValue !== null && fieldValue !== undefined) {
    log('debug', 'Unknown address field format', { 
      fieldValue: JSON.stringify(fieldValue),
      type: typeof fieldValue 
    });
  }
  
  return null;
}

function parseBuyerSellerFromNonFungibleToken(events, nftId) {
    let seller = "UnknownSeller";
    let buyer = "UnknownBuyer";

    for (const evt of events) {
        if (
            evt.type === "A.1d7e57aa55817448.NonFungibleToken.Withdrawn" ||
            evt.type === "A.1d7e57aa55817448.NonFungibleToken.Deposited"
        ) {
            const decoded = evt.payload ? decodeEventPayloadBase64(evt.payload) : null;
            if (!decoded) {
                log('debug', 'Failed to decode event payload', { eventType: evt.type });
                continue;
            }

            const fields = decoded.value?.fields || [];
            let eventIdString = "";
            let fromAddr = null;
            let toAddr = null;

            for (const f of fields) {
                if (f.name === "id") {
                    // Handle different ID formats
                    if (f.value && typeof f.value.value !== "undefined") {
                        eventIdString = String(f.value.value);
                    } else if (f.value && typeof f.value === "string") {
                        eventIdString = f.value;
                    } else {
                        eventIdString = String(f.value || "");
                    }
                }
                if (f.name === "from") fromAddr = unwrapAddressField(f.value);
                if (f.name === "to") toAddr = unwrapAddressField(f.value);
            }
            
            if (String(eventIdString) === String(nftId)) {
                if (evt.type.endsWith(".Withdrawn")) {
                    if (fromAddr) {
                        seller = fromAddr;
                        log('debug', 'Found seller address', { seller, eventType: evt.type });
                    } else {
                        log('debug', 'Failed to extract seller address', { 
                            eventType: evt.type, 
                            fromField: JSON.stringify(fields.find(f => f.name === "from")?.value)
                        });
                    }
                }
                if (evt.type.endsWith(".Deposited")) {
                    if (toAddr) {
                        buyer = toAddr;
                        log('debug', 'Found buyer address', { buyer, eventType: evt.type });
                    } else {
                        log('debug', 'Failed to extract buyer address', { 
                            eventType: evt.type, 
                            toField: JSON.stringify(fields.find(f => f.name === "to")?.value)
                        });
                    }
                }
            }
        }
    }
    
    if (seller === "UnknownSeller" || buyer === "UnknownBuyer") {
        log('warn', 'Could not determine valid owner addresses', {
            nftId,
            seller,
            buyer,
            eventCount: events.length
        });
    }
    
    return { seller, buyer };
}

async function getUsernameFromAddress(address) {
  try {
    const url = `https://open.meetdapper.com/profile?address=${address}`;
    const response = await fetch(url);
    if (!response.ok) {
      log('warn', `Failed to fetch username for address ${address}`, { status: response.status });
      return null;
    }
    const data = await response.json();
    return data.displayName || null;
  } catch (error) {
    log('warn', `Error fetching username for address ${address}`, { error: error.message });
    return null;
  }
}

function formatPrice(price) {
  return Math.round(price).toLocaleString();
}

function composeTweet({ usd, ed, chars, serial, seller, buyer, img }) {
  return `$${formatPrice(usd)} USD SALE on @DisneyPinnacle
${ed.name}
${serial ? `Serial #: ${serial}\n` : ""}${ed.max ? `Max Mint: ${ed.max}\n` : ""}Character(s): ${chars}
Edition ID: ${ed.id}
Seller: ${seller}
Buyer: ${buyer}
https://disneypinnacle.com/pin/${ed.id}`;
}

/* ── Flow Functions ─────────────────────────────────────── */
async function getTxResults(txId) {
  try {
    const txUrl = `${config.FLOW_REST_ENDPOINT}/v1/transactions/${txId}`;
    const txData = await get(txUrl);
    if (txData && txData.events) {
      return txData;
    }
  } catch (e) {
    log('warn', `Could not fetch from /transactions endpoint, falling back. Error: ${e.message}`);
  }
  
  log("info", "Falling back to /transaction_results endpoint.", { txId });
  const resultsUrl = `${config.FLOW_REST_ENDPOINT}/v1/transaction_results/${txId}`;
  return get(resultsUrl);
}

async function executePinnacleScript(address, nftId) {
  return retry(() =>
    fcl.send([
      fcl.script(pinnacleScript),
      fcl.args([
        fcl.arg(address, t.Address),
        fcl.arg(String(nftId), t.UInt64),
      ]),
    ]).then(fcl.decode)
  );
}

async function executeGetEditionScript(editionId) {
  return retry(() =>
    fcl.send([
      fcl.script(editionScript),
      fcl.args([fcl.arg(String(editionId), t.Int)]),
    ]).then(fcl.decode)
  );
}

/* ── Event Processing ───────────────────────────────────── */
async function handleListing(evt) {
  const decodedEvent = decodeEvent(evt);
  if (!decodedEvent || !decodedEvent.data) {
    log("warn", "Could not decode event or event data missing", { transactionId: evt.transaction_id });
    return;
  }
  const { data, transactionId } = decodedEvent;

  // Filter for Pinnacle NFT purchases only (using the same logic as old working code)
  const nftType = data.nftType?.typeID || data.nftType;
  if (nftType !== config.PINNACLE_NFT_TYPE || !data.purchased) {
    return;
  }

  const usd = Number(data.salePrice);

  // [MODIFIED] Added a log for below-threshold sales
  if (usd < config.PINNACLE_PRICE_THRESHOLD) {
    log('info', `Price ${usd} below threshold ${config.PINNACLE_PRICE_THRESHOLD}, skipping`);
    return; // Stop processing this event
  }
  
  log('info', `Processing sale: ${data.nftID} for $${usd}`, { transactionId });

  // Retry transaction results with exponential backoff for timing issues
  let txRes = null;
  let retryCount = 0;
  const maxRetries = 3;
  
  while (retryCount < maxRetries) {
    txRes = await getTxResults(transactionId);
    
    if (txRes && txRes.events && txRes.events.length > 0) {
      break; // Success - we got events
    }
    
    retryCount++;
    if (retryCount < maxRetries) {
      const delay = Math.pow(2, retryCount) * 1000; // 2s, 4s, 8s
      log('warn', `Transaction events not ready, retrying in ${delay}ms (attempt ${retryCount}/${maxRetries})`, { 
        transactionId, 
        eventCount: txRes?.events?.length || 0 
      });
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  if (!txRes || !txRes.events || txRes.events.length === 0) {
    log('error', 'Could not retrieve transaction events after retries.', { 
      transactionId, 
      attempts: retryCount,
      eventCount: txRes?.events?.length || 0 
    });
    return;
  }

  const { seller, buyer } = parseBuyerSellerFromNonFungibleToken(txRes.events, data.nftID);
  const queryAddr = buyer !== "UnknownBuyer" ? buyer : (seller !== "UnknownSeller" ? seller : null);

  if (!queryAddr) {
    log("warn", "Could not determine a valid owner address to query.", { transactionId, buyer, seller });
    return;
  }

  const pin = await executePinnacleScript(queryAddr, data.nftID);
  if (!pin) {
    log("warn", "Pinnacle script returned null, possibly due to NFT data issue.", { nftId: data.nftID, ownerAddress: queryAddr });
    return;
  }
  
  log('debug', 'Pinnacle script executed successfully', { 
    nftId: data.nftID, 
    editionId: pin.editionID,
    serialNumber: pin.serialNumber,
    traitsCount: pin.traits?.length || 0
  });

  const ed = await executeGetEditionScript(pin.editionID);
  if (!ed) {
    log("warn", "Edition script returned null", { editionId: pin.editionID });
    return;
  }
  
  log('debug', 'Edition script executed successfully', { 
    editionId: pin.editionID,
    renderID: ed.renderID,
    maxMintSize: ed.maxMintSize
  });

  const traitsMap = new Map();
  if (pin.traits && Array.isArray(pin.traits)) {
    for (const trait of pin.traits) {
      if (trait && trait.name) {
        traitsMap.set(trait.name, trait.value);
      }
    }
  }

  const characterValues = traitsMap.get("Characters");
  const chars = Array.isArray(characterValues) ? characterValues.join(", ") : "N/A";
  const setName = traitsMap.get("SetName") || "Unknown Set";
  const imgUrl = `https://assets.disneypinnacle.com/render/${ed.renderID}/front.png`;

  // Fetch usernames for seller and buyer
  let sellerDisplay = seller;
  let buyerDisplay = buyer;
  
  if (seller !== "UnknownSeller") {
    const sellerUsername = await getUsernameFromAddress(seller);
    sellerDisplay = sellerUsername || `0x${seller.replace(/^0x/, "")}`;
  }
  
  if (buyer !== "UnknownBuyer") {
    const buyerUsername = await getUsernameFromAddress(buyer);
    buyerDisplay = buyerUsername || `0x${buyer.replace(/^0x/, "")}`;
  }

  const tweetData = {
    usd,
    ed: { id: pin.editionID, name: setName, max: ed.maxMintSize },
    chars,
    serial: pin.serialNumber,
    seller: sellerDisplay,
    buyer: buyerDisplay,
    img: imgUrl,
  };

  const text = composeTweet(tweetData);
  
  log('debug', 'Tweet composed successfully', { 
    nftId: data.nftID,
    editionId: pin.editionID,
    tweetLength: text.length,
    hasImage: !!imgUrl
  });

  if (config.ENABLE_TWEETS) {
    try {
      let mediaId;
      try {
        const renderID = ed.renderID;
        log("info", "Downloading image for tweet", { renderID });
        await new Promise((r) => setTimeout(r, 300 + Math.random() * 300));
        const imageResponse = await fetch(imgUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; PinnacleBot/1.0)",
            Referer: "https://disneypinnacle.com/",
          },
        });
        const contentType = imageResponse.headers.get("content-type");
        if (!contentType?.startsWith("image/")) {
          throw new Error("Invalid content type");
        }
        const imageBuffer = await imageResponse.buffer();
        mediaId = await twitterClient.v1.uploadMedia(imageBuffer, { mimeType: "image/png" });
        log("info", "Image uploaded successfully", { renderID, mediaId });
      } catch (imageError) {
        // Fallback image logic can be added here if needed
        log('warn', 'Failed to process image for tweet.', { imageError: imageError.message });
      }
      
      log('info', 'Attempting to tweet sale...', { nftId: data.nftID });
      await twitterClient.v2.tweet({
        text: text,
        ...(mediaId && { media: { media_ids: [mediaId] } }),
      });
      log('info', `Tweeted Edition ${pin.editionID} for $${usd}`);

    } catch (error) {
      log("error", "Failed to tweet", { error: error.message, tweetData });
    }
  } else {
    // Check if image would be included
    const renderID = ed.renderID;
    const imageUrl = `https://assets.disneypinnacle.com/render/${ed.renderID}/front.png`;
    
    log("info", `DRY RUN: Tweet not sent. Use --live-tweets flag to enable. Image: WOULD DOWNLOAD (${imageUrl})`);
    console.log(text);
    writeToLogFile(text);
  }
}

/* ── App Modes ──────────────────────────────────────────── */

async function runBackfill() {
    const fromBlockArg = process.argv.find(arg => arg.startsWith('--from-block='));
    const toBlockArg = process.argv.find(arg => arg.startsWith('--to-block='));

    if (!fromBlockArg || !toBlockArg) {
        log('error', 'Backfill mode requires --from-block=<number> and --to-block=<number> arguments.');
        process.exit(1);
    }

    const fromBlock = parseInt(fromBlockArg.split('=')[1], 10);
    const toBlock = parseInt(toBlockArg.split('=')[1], 10);

    if (isNaN(fromBlock) || isNaN(toBlock) || fromBlock > toBlock) {
        log('error', 'Invalid block height range provided.');
        process.exit(1);
    }

    log('info', `--- BACKFILL MODE ---`);
    log('info', `Scanning for events from block ${fromBlock} to ${toBlock}.`);

    try {
        let foundEvents = [];
        // Include all event types (like the live subscription)
        const allEventTypes = [
            ...config.EVENT_TYPES.LISTING_COMPLETED,
            config.EVENT_TYPES.OFFER_COMPLETED,
        ];
        
        for (const eventType of allEventTypes) {
            log('info', `Querying for event type: ${eventType}`);
            try {
                // Use REST API directly for more reliable event fetching
                const url = `${config.FLOW_REST_ENDPOINT}/v1/events?type=${encodeURIComponent(eventType)}&start_height=${fromBlock}&end_height=${toBlock}`;
                const response = await fetch(url);
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                const data = await response.json();
                
                // Extract individual events from blocks
                if (data && data.length > 0) {
                    for (const block of data) {
                        if (block.events && Array.isArray(block.events)) {
                            for (const event of block.events) {
                                // Add block info to the event
                                const enrichedEvent = {
                                    ...event,
                                    blockHeight: parseInt(block.block_height),
                                    blockId: block.block_id,
                                    blockTimestamp: block.block_timestamp
                                };
                                foundEvents.push(enrichedEvent);
                            }
                        }
                    }
                }
            } catch (error) {
                log('error', `Failed to fetch events for ${eventType}`, { error: error.message });
            }
        }
        
        log('info', `Found ${foundEvents.length} total sales events in range.`);
        if (foundEvents.length === 0) return;

        foundEvents.sort((a, b) => a.blockHeight - b.blockHeight);

        for (const event of foundEvents) {
            try {
                await handleListing(event);
            } catch (error) {
                log("error", "Error processing backfill event", { error: error.message, event });
            }
        }

    } catch (error) {
        log('error', 'An error occurred during backfill.', { message: error.message });
    }
}

async function runLiveSubscription() {
  try {
    if (config.ENABLE_TWEETS) {
      await twitterClient.v2.me();
      log("info", "Twitter client initialized successfully for live tweeting.");
    }
    
    log("info", "Starting live event subscription...");

    // Subscribe to all relevant events (like the old working code)
    const events = [
      ...config.EVENT_TYPES.LISTING_COMPLETED,
      config.EVENT_TYPES.OFFER_COMPLETED,
    ];

    const subscription = subscribeToEvents({
      fcl,
      events,
      onEvent: async (event) => {
        try {
          // Single check for Pinnacle NFT purchases (like the old working code)
          const nftType = event.data?.nftType?.typeID || event.data?.nftType;
          if (nftType === config.PINNACLE_NFT_TYPE && event.data?.purchased) {
            await handleListing(event);
          }
        } catch (error) {
          log("error", "Error processing event", {
            error: error.message,
            stack: error.stack,
            event: {
              type: event.type,
              transactionId: event.transactionId,
              data: {
                ...event.data,
                nftType: event.data?.nftType?.typeID || event.data?.nftType,
              },
            },
          });
        }
      },
      onError: (error) => log("error", "Subscription error", { error: error.message }),
      // Override the default 60-second sleep time to make it real-time
      sleepTime: 1000, // 1 second instead of 60 seconds
      startBlock: "latest"
    });

    log("info", "Event subscription started successfully. Watching for sales...");

    process.on("SIGINT", () => {
      log("info", "Shutting down...");
      if (subscription && typeof subscription.close === "function") {
        subscription.close();
      }
      process.exit(0);
    });
  } catch (error) {
    log("error", "Fatal error in live subscription setup", { message: error.message });
    process.exit(1);
  }
}

/* ── Main Entry Point ───────────────────────────────────── */
async function main() {
  const mode = config.IS_BACKFILL 
    ? (config.ENABLE_TWEETS ? "--- BACKFILL LIVE TWEET MODE ---" : "--- BACKFILL DRY RUN MODE ---")
    : (config.ENABLE_TWEETS ? "--- LIVE TWEET MODE ---" : "--- LIVE DRY RUN MODE ---");
  log("warn", mode);

  if (config.IS_BACKFILL) {
    await runBackfill();
  } else {
    await runLiveSubscription();
  }
}

main().catch((e) => {
    log('fatal', 'Unhandled error in main execution.', e);
    process.exit(1);
});