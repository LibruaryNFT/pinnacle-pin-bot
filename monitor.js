require("dotenv").config();
const fcl = require("@onflow/fcl");
const fetch = require("node-fetch");
const t = require("@onflow/types");
const fs = require("fs");
const path = require("path");
const { TwitterApi } = require("twitter-api-v2");
const { subscribeToEvents } = require("fcl-subscribe");

/* ── Config ─────────────────────────────────────────────── */
const config = {
  /* Flow */
  FLOW_ACCESS_NODE:
    process.env.FLOW_ACCESS_NODE || "https://mainnet.onflow.org",
  FLOW_REST_ENDPOINT:
    process.env.FLOW_REST_ENDPOINT || "https://rest-mainnet.onflow.org",

  /* Pinnacle */
  PINNACLE_NFT_TYPE: "A.edf9df96c92f4595.Pinnacle.NFT",
  PINNACLE_PRICE_THRESHOLD: 50,
  EVENT_TYPES: {
    LISTING_COMPLETED: [
      "A.4eb8a10cb9f87357.NFTStorefrontV2.ListingCompleted",
      "A.3cdbb3d569211ff3.NFTStorefrontV2.ListingCompleted",
    ],
    OFFER_COMPLETED: "A.b8ea91944fd51c43.OffersV2.OfferCompleted",
  },

  /* Polling */
  POLL_INTERVAL_MS: 2000,
  VERBOSE_IDLE: false,

  /* Twitter */
  TWITTER_API_KEY: process.env.TWITTER_API_KEY,
  TWITTER_API_SECRET: process.env.TWITTER_API_SECRET,
  PINNACLEPINBOT_ACCESS_TOKEN: process.env.PINNACLEPINBOT_ACCESS_TOKEN,
  PINNACLEPINBOT_ACCESS_SECRET: process.env.PINNACLEPINBOT_ACCESS_SECRET,

  /* Toggles */
  ENABLE_TWEETS: true, // Set to true to enable actual tweeting
};

/* ── Image Cache ────────────────────────────────────────── */
const fetchedRenderIDs = new Set();

/* ── Logger ─────────────────────────────────────────────── */
function log(type, message, data = {}) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${type}: ${message}`);
  if (Object.keys(data).length) console.log(data);
}

/* ── Twitter Client ─────────────────────────────────────── */
const twitterClient = new TwitterApi({
  appKey: config.TWITTER_API_KEY,
  appSecret: config.TWITTER_API_SECRET,
  accessToken: config.PINNACLEPINBOT_ACCESS_TOKEN,
  accessSecret: config.PINNACLEPINBOT_ACCESS_SECRET,
});

/* ── Flow Setup ─────────────────────────────────────────── */
fcl
  .config()
  .put("accessNode.api", config.FLOW_ACCESS_NODE)
  .put("fcl.eventPollRate", 1000);

/* ── Cadence Scripts ────────────────────────────────────── */
const pinnacleScript = fs.readFileSync(
  path.join(__dirname, "flow", "pinnacle.cdc"),
  "utf8"
);
const editionScript = fs.readFileSync(
  path.join(__dirname, "flow", "get_edition.cdc"),
  "utf8"
);

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
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return res.json();
  });
}

function extract(v) {
  return v && typeof v === "object" && "value" in v ? extract(v.value) : v;
}

function decodeEvent(evt) {
  if (evt.data || !evt.payload) return evt;
  const j = JSON.parse(Buffer.from(evt.payload, "base64").toString());
  const obj = {};
  j.value.fields.forEach((f) => {
    obj[f.name] = extract(f.value);
  });
  return { ...evt, data: obj };
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
  // Case 1: plain string  => "0xabc…"
  if (typeof fieldValue === "string") return fieldValue;

  // Case 2: { value:"0xabc", type:"Address" }
  if (fieldValue && typeof fieldValue.value === "string")
    return fieldValue.value;

  // Case 3: { value:{ value:"0xabc", type:"Address" }, type:"Optional" }
  if (
    fieldValue &&
    typeof fieldValue.value === "object" &&
    typeof fieldValue.value.value === "string"
  ) {
    return fieldValue.value.value;
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
      const decoded = evt.payload
        ? decodeEventPayloadBase64(evt.payload)
        : null;
      if (!decoded) continue;

      const fields = decoded.value?.fields || [];

      let eventIdString = "";
      let fromAddr = null;
      let toAddr = null;

      for (const f of fields) {
        if (f.name === "id") eventIdString = String(f.value?.value ?? "");
        if (f.name === "from") fromAddr = unwrapAddressField(f.value?.value);
        if (f.name === "to") toAddr = unwrapAddressField(f.value?.value);
      }

      if (eventIdString === String(nftId)) {
        if (evt.type.endsWith(".Withdrawn")) seller = fromAddr || seller;
        if (evt.type.endsWith(".Deposited")) buyer = toAddr || buyer;
      }
    }
  }

  return { seller, buyer };
}

function parseBuyerSellerFromTopShotDeposit(events, momentID) {
  let buyerAddress = null;
  for (const evt of events) {
    if (evt.type === "A.0b2a3299cc857e29.TopShot.Deposit" && evt.payload) {
      const decoded = decodeEventPayloadBase64(evt.payload);
      if (decoded?.id == momentID) {
        buyerAddress = decoded.to;
        break;
      }
    }
  }
  return buyerAddress;
}

function composeTweet({ usd, ed, chars, serial, seller, buyer, img }) {
  return `$${usd.toFixed(2)} USD SALE on @DisneyPinnacle
${ed.name}
${serial ? `Serial #: ${serial}\n` : ""}Max Mint: ${ed.max}
Character(s): ${chars}
Edition ID: ${ed.id}
Seller: 0x${seller.replace(/^0x/, "")}
Buyer: 0x${buyer.replace(/^0x/, "")}
https://disneypinnacle.com/pin/${ed.id}

Image URL: ${img}`;
}

/* ── Flow Functions ─────────────────────────────────────── */
async function getTxResults(txId) {
  const url = `${config.FLOW_REST_ENDPOINT}/v1/transaction_results/${txId}`;
  return get(url);
}

async function executePinnacleScript(address, nftId) {
  return retry(() =>
    fcl
      .send([
        fcl.script(pinnacleScript),
        fcl.args([
          fcl.arg(address, t.Address),
          fcl.arg(String(nftId), t.UInt64),
        ]),
      ])
      .then(fcl.decode)
  );
}

async function executeGetEditionScript(editionId) {
  return retry(() =>
    fcl
      .send([
        fcl.script(editionScript),
        fcl.args([fcl.arg(String(editionId), t.Int)]),
      ])
      .then(fcl.decode)
  );
}

/* ── Event Processing ───────────────────────────────────── */
async function handleListing(evt) {
  evt = decodeEvent(evt);
  if (!evt.data) {
    log("warn", "No event data found");
    return;
  }

  // Early filter for Pinnacle NFT purchases only
  const nftType = evt.data.nftType?.typeID || evt.data.nftType;
  if (nftType !== config.PINNACLE_NFT_TYPE || !evt.data.purchased) {
    return;
  }

  const usd = Number(evt.data.salePrice);
  if (usd < config.PINNACLE_PRICE_THRESHOLD) {
    log(
      "info",
      `Price ${usd} below threshold ${config.PINNACLE_PRICE_THRESHOLD}, skipping`
    );
    return;
  }

  const txRes = await getTxResults(evt.transactionId);

  const { seller, buyer } = parseBuyerSellerFromNonFungibleToken(
    txRes.events,
    evt.data.nftID
  );

  const queryAddr = buyer !== "UnknownBuyer" ? buyer : seller;
  if (!queryAddr || queryAddr === "UnknownSeller") {
    log("warn", "No collection address, skipping", {
      transactionId: evt.transactionId,
      buyer,
      seller,
      nftId: evt.data.nftID,
    });
    return;
  }

  const pin = await executePinnacleScript(queryAddr, evt.data.nftID);
  if (!pin) {
    log("warn", "Pinnacle script returned null");
    return;
  }

  const ed = await executeGetEditionScript(pin.editionID);
  if (!ed) {
    log("warn", "Edition script null", pin.editionID);
    return;
  }

  const chars =
    (pin.traits || [])
      .find((t) => t.name === "Characters")
      ?.value?.join(", ") || "N/A";

  const setName =
    (pin.traits || []).find((t) => t.name === "SetName")?.value ||
    "Unknown Set";

  const imgUrl = `https://assets.disneypinnacle.com/render/${ed.renderID}/front.png`;

  const text = composeTweet({
    usd,
    ed: {
      id: pin.editionID,
      name: setName,
      max: ed.maxMintSize,
    },
    chars,
    serial: pin.serialNumber,
    seller: seller || "Unknown",
    buyer: buyer || "Unknown",
    img: imgUrl,
  });

  if (config.ENABLE_TWEETS) {
    try {
      // Try original image first
      let mediaId;
      try {
        // Skip if we've already fetched this renderID in this session
        const renderID = ed.renderID;
        if (fetchedRenderIDs.has(renderID)) {
          log(
            "info",
            "Skipping image fetch - already fetched in this session",
            { renderID }
          );
          return;
        }
        fetchedRenderIDs.add(renderID);

        // Throttle the request
        await new Promise((r) => setTimeout(r, 300 + Math.random() * 300));

        log("info", "Attempting to download original image", { url: imgUrl });
        const imageResponse = await fetch(imgUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; PinnacleBot/1.0)",
            Referer: "https://disneypinnacle.com/",
          },
        });

        // Check MIME type before proceeding
        const contentType = imageResponse.headers.get("content-type");
        if (!contentType?.startsWith("image/")) {
          log("warn", "Invalid content type for image", { contentType });
          throw new Error("Invalid content type");
        }

        log("info", "Original image response", {
          status: imageResponse.status,
          contentType: contentType,
          contentLength: imageResponse.headers.get("content-length"),
        });
        const imageBuffer = await imageResponse.buffer();
        log("info", "Original image buffer", {
          size: imageBuffer.length,
          type: imageBuffer.type,
        });
        mediaId = await twitterClient.v1.uploadMedia(imageBuffer, {
          mimeType: "image/png",
        });
      } catch (imageError) {
        // If original fails, try cropped version
        try {
          const croppedUrl = imgUrl.replace("front.png", "front_cropped.png");

          // Throttle the request
          await new Promise((r) => setTimeout(r, 300 + Math.random() * 300));

          log("info", "Attempting to download cropped image", {
            url: croppedUrl,
          });
          const imageResponse = await fetch(croppedUrl, {
            headers: {
              "User-Agent": "Mozilla/5.0 (compatible; PinnacleBot/1.0)",
              Referer: "https://disneypinnacle.com/",
            },
          });

          // Check MIME type before proceeding
          const contentType = imageResponse.headers.get("content-type");
          if (!contentType?.startsWith("image/")) {
            log("warn", "Invalid content type for cropped image", {
              contentType,
            });
            throw new Error("Invalid content type");
          }

          log("info", "Cropped image response", {
            status: imageResponse.status,
            contentType: contentType,
            contentLength: imageResponse.headers.get("content-length"),
          });
          const imageBuffer = await imageResponse.buffer();
          log("info", "Cropped image buffer", {
            size: imageBuffer.length,
            type: imageBuffer.type,
          });
          mediaId = await twitterClient.v1.uploadMedia(imageBuffer, {
            mimeType: "image/png",
          });
        } catch (croppedError) {
          // If both fail, log and continue without image
          log(
            "warn",
            "Failed to upload both original and cropped images, tweeting without image",
            {
              originalUrl: imgUrl,
              originalError: imageError.message,
              croppedUrl: imgUrl.replace("front.png", "front_cropped.png"),
              croppedError: croppedError.message,
            }
          );
        }
      }

      // Tweet with or without media
      await twitterClient.v2.tweet({
        text: text.replace(`\n\nImage URL: ${imgUrl}`, ""),
        ...(mediaId && { media: { media_ids: [mediaId] } }),
      });

      log("info", `Tweeted Edition ${pin.editionID} for $${usd}`);
    } catch (error) {
      log("error", "Failed to tweet", error);
    }
  } else {
    log("info", `Would tweet (tweets disabled):\n${text}`);
  }
}

/* ── Main Loop ──────────────────────────────────────────── */
async function main() {
  try {
    // Verify Twitter credentials
    await twitterClient.v2.me();
    log("info", "Twitter client initialized successfully");

    // Subscribe to all relevant events
    const events = [
      ...config.EVENT_TYPES.LISTING_COMPLETED,
      config.EVENT_TYPES.OFFER_COMPLETED,
    ];

    log("info", "Starting event subscription...");

    const subscription = await subscribeToEvents({
      fcl,
      events,
      onEvent: async (event) => {
        try {
          // Single check for Pinnacle NFT purchases
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
      onError: (error) => {
        log("error", "Subscription error", {
          error: error.message,
          stack: error.stack,
        });
      },
    });

    log("info", "Event subscription started successfully");

    // Keep the process running
    process.on("SIGINT", () => {
      log("info", "Shutting down...");
      if (subscription && typeof subscription.close === "function") {
        subscription.close();
      }
      process.exit(0);
    });
  } catch (error) {
    log("error", "Fatal error", {
      error: error.message,
      stack: error.stack,
    });
    process.exit(1);
  }
}

main();
