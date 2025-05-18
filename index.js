// index.js  (root)
require("dotenv").config();
const fcl = require("@onflow/fcl");
const { log } = require("./lib/logger");
const cfg = require("./config");
const { handleListing } = require("./lib/eventProcessor");
const { getEvents } = require("./flow"); // you already have this helper

/* ─── CLI ────────────────────────────────────── */
const args = process.argv.slice(2);
const opts = { mode: "prod", blockHeight: null, dryRun: cfg.TWITTER_DRY_RUN };

args.forEach((a) => {
  if (a.startsWith("--mode=")) opts.mode = a.split("=")[1];
  if (a.startsWith("--blockheight="))
    opts.blockHeight = Number(a.split("=")[1]);
  if (a === "--dry-run") opts.dryRun = true;
});

/* ─── Common init ───────────────────────────── */
fcl.config().put("accessNode.api", cfg.ACCESS_API);

(async () => {
  if (opts.mode === "test") {
    if (!opts.blockHeight) {
      console.error("Test mode requires --blockheight");
      process.exit(1);
    }
    log("info", `=== Testing block ${opts.blockHeight} ===`);
    const events = await getEvents(opts.blockHeight, opts.blockHeight);
    for (const ev of events) await handleListing(ev, { isDryRun: true });
    log("info", "=== Test complete ===");
  } else {
    // ---- production stream (poll 1 block at a time) ----
    let last = (await fcl.block(true)).height;
    log("info", `Starting live monitor from block ${last + 1}`);
    // simple poll; replace with gRPC subscribe if you prefer
    setInterval(async () => {
      const current = (await fcl.block(true)).height;
      if (current > last) {
        const events = await getEvents(last + 1, current);
        for (const ev of events)
          await handleListing(ev, { isDryRun: opts.dryRun });
        last = current;
      }
    }, 3000);
  }
})();
