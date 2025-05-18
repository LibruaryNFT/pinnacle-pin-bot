// config.js – Pinnacle Bot Configuration (merged)
// ----------------------------------------------------------------------------
require("dotenv").config();

/* ── mandatory ENV sanity-check ──────────────────────────────────────────── */
const REQUIRED = [
  "TWITTER_API_KEY",
  "TWITTER_API_SECRET",
  "PINNACLEPINBOT_ACCESS_TOKEN",
  "PINNACLEPINBOT_ACCESS_SECRET",
];
const missing = REQUIRED.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(
    "Missing required environment variables: " + missing.join(", ")
  );
  process.exit(1);
}

/* ── user-tunable polling knobs (NOT from .env) ─────────────────────────── */
const POLL_INTERVAL_MS = 2000; // 2 s between block queries
const VERBOSE_IDLE = false; // true → print heartbeat when idle

/* ── price / debug settings ─────────────────────────────────────────────── */
const PINNACLE_PRICE_THRESHOLD = 50; // USD minimum
const DEBUG_LOG_ALL_EVENTS = process.env.DEBUG_LOG_ALL_EVENTS === "true";

/* ── NEW constants expected by refactor ─────────────────────────────────── */
const PINNACLE_NFT_TYPE = "A.edf9df96c92f4595.Pinnacle.NFT"; // single source of truth
const LOG_LEVEL = process.env.LOG_LEVEL || "info";
const TWITTER_DRY_RUN = process.env.TWITTER_DRY_RUN === "true";

/* ── exports ────────────────────────────────────────────────────────────── */
module.exports = {
  /* Flow endpoints */
  FLOW_ACCESS_NODE:
    process.env.FLOW_ACCESS_NODE || "https://mainnet.onflow.org",
  FLOW_REST_ENDPOINT:
    process.env.FLOW_REST_ENDPOINT || "https://rest-mainnet.onflow.org",

  /* Event monitoring */
  DEBUG_LOG_ALL_EVENTS,
  POLL_INTERVAL_MS,
  VERBOSE_IDLE,

  /* Pinnacle NFT contracts & types */
  PINNACLE_CONTRACT: "0x4eb8a10cb9f87357",
  NFT_STOREFRONT_CONTRACT: "0x4eb8a10cb9f87357",
  PINNACLE_NFT_TYPE, // <── used by eventProcessor.js
  PINNACLE_PRICE_THRESHOLD, // <── same as before

  /* Event types */
  EVENT_TYPES: {
    LISTING_COMPLETED: "NFTStorefrontV2.ListingCompleted",
  },

  /* Twitter creds */
  TWITTER_API_KEY: process.env.TWITTER_API_KEY,
  TWITTER_API_SECRET: process.env.TWITTER_API_SECRET,
  PINNACLEPINBOT_ACCESS_TOKEN: process.env.PINNACLEPINBOT_ACCESS_TOKEN,
  PINNACLEPINBOT_ACCESS_SECRET: process.env.PINNACLEPINBOT_ACCESS_SECRET,

  /* Flow network */
  FLOW_NETWORK: process.env.FLOW_NETWORK || "mainnet",

  /* NEW behaviour toggles */
  LOG_LEVEL, // <── consumed by lib/logger.js
  TWITTER_DRY_RUN, // <── lets you run prod in “no-tweet” mode
};
