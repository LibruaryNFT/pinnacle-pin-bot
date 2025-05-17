// config.js – Pinnacle Bot Configuration
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

/* ── user-tunable polling knobs (NOT from .env) ──────────────────────────── */
const POLL_INTERVAL_MS = 2000; // 2 s between block queries
const VERBOSE_IDLE = false; // true → print heartbeat when no new blocks

/* ── price / debug settings ──────────────────────────────────────────────── */
const PINNACLE_PRICE_THRESHOLD = 50; // USD
const DEBUG_LOG_ALL_EVENTS = process.env.DEBUG_LOG_ALL_EVENTS === "true";

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

  /* Pinnacle NFT contracts */
  PINNACLE_CONTRACT: "0x4eb8a10cb9f87357",
  NFT_STOREFRONT_CONTRACT: "0x4eb8a10cb9f87357",

  /* Event types */
  EVENT_TYPES: {
    LISTING_COMPLETED: "NFTStorefrontV2.ListingCompleted",
  },

  /* Twitter creds */
  TWITTER_API_KEY: process.env.TWITTER_API_KEY,
  TWITTER_API_SECRET: process.env.TWITTER_API_SECRET,
  PINNACLEPINBOT_ACCESS_TOKEN: process.env.PINNACLEPINBOT_ACCESS_TOKEN,
  PINNACLEPINBOT_ACCESS_SECRET: process.env.PINNACLEPINBOT_ACCESS_SECRET,

  /* Price threshold */
  PINNACLE_PRICE_THRESHOLD,

  /* Flow network */
  FLOW_NETWORK: process.env.FLOW_NETWORK || "mainnet",
};
