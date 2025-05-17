// index.js (root) - Added Debug Log Status
// ... (require statements, client initialization - same as before) ...
const { subscribeToEvents } = require("fcl-subscribe");
const { handleEvent, processTestBlock } = require("./handlers");
const { fcl } = require("./flow");
const config = require("./config");
const { verifyCredentials } = require("./twitterClients");

let lastBlockHeight = 0;

// Add block monitoring function
async function monitorBlocks() {
  try {
    const latestBlock = await fcl.send([fcl.getBlock()]).then(fcl.decode);
    const currentHeight = latestBlock.height;

    if (lastBlockHeight === 0) {
      lastBlockHeight = currentHeight;
    }

    console.log(`Monitoring Blocks: ${lastBlockHeight} - ${currentHeight}`);
    lastBlockHeight = currentHeight;
  } catch (error) {
    console.error("Error getting latest block:", error);
  }
}

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

    // Verify Twitter credentials
    const twitterVerified = await verifyCredentials();
    if (!twitterVerified) {
      console.error(
        "Failed to verify Twitter credentials. Please check your configuration."
      );
      process.exit(1);
    }

    console.log("----------------------------------------");
    console.log("Monitoring Pinnacle NFT Events:");
    console.log("- NFTStorefrontV2.ListingCompleted");
    console.log("----------------------------------------\n");

    // Start block monitoring
    console.log("Starting block monitoring...");
    await monitorBlocks();

    // Set up interval for continuous monitoring
    const monitoringInterval = setInterval(async () => {
      await monitorBlocks();
    }, 2000);

    // Clean up interval on exit
    process.on("SIGINT", () => {
      clearInterval(monitoringInterval);
      process.exit();
    });

    subscribeToEvents({
      fcl,
      events: ["A.4eb8a10cb9f87357.NFTStorefrontV2.ListingCompleted"],
      onEvent: handleEvent,
      onError: (err) => console.error("Subscription error:", err),
    });

    console.log(
      "Event subscription started. Waiting for Pinnacle NFT events..."
    );
  }
}

// Run the main function
main().catch(console.error);
