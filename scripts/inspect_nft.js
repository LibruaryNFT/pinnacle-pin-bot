/**
 * inspect_nft.js
 *
 * A command-line tool to execute Cadence scripts for inspecting Pinnacle NFTs and Editions on Flow Mainnet.
 * This helps debug issues related to on-chain data retrieval.
 */

const fcl = require("@onflow/fcl");
const t = require("@onflow/types");
const fs = require("fs");
const path = require("path");
const logger = require("../logger");

// --- Configuration ---
const FLOW_ACCESS_NODE = "https://rest-mainnet.onflow.org";

// --- FCL Setup ---
fcl.config().put("accessNode.api", FLOW_ACCESS_NODE);

/**
 * Reads a Cadence file from the specified path.
 * @param {string} scriptPath - The relative path to the .cdc file.
 * @returns {string} The content of the file.
 */
function loadCadenceScript(scriptPath) {
  try {
    const fullPath = path.join(__dirname, "..", scriptPath);
    return fs.readFileSync(fullPath, "utf8");
  } catch (error) {
    logger.error({ scriptPath }, "Failed to load Cadence script");
    logger.error("Please ensure that the file exists and you are running this script from the root of your project.");
    process.exit(1);
  }
}

/**
 * Executes a given Cadence script with arguments against the Flow blockchain.
 * @param {string} cadenceCode - The Cadence script code to execute.
 * @param {Array} args - An array of FCL arguments.
 * @returns {Promise<any>} The decoded result from the script.
 */
async function executeScript(cadenceCode, args = []) {
  try {
    const result = await fcl.send([
      fcl.script(cadenceCode),
      fcl.args(args),
    ]).then(fcl.decode);
    return result;
  } catch (e) {
    logger.error({ err: e }, "Error during script execution");
    return null;
  }
}

/**
 * Prints the help message and usage instructions.
 */
function showHelp() {
  const helpText = [
    "Pinnacle NFT Inspector Tool",
    "",
    "This tool executes Cadence scripts to fetch data directly from the Flow Mainnet.",
    "",
    "Usage:",
    "  node inspect_nft.js <command> [arguments]",
    "",
    "Commands:",
    "  pinnacle <address> <nftID>      Runs pinnacle.cdc to get details for a specific NFT.",
    "  edition  <editionID>            Runs get_edition.cdc to get details for an edition.",
    "",
    "---",
    "Example for the FAILED Transaction (gets NFT details):",
    "  node inspect_nft.js pinnacle 0x3b562bcf2c6e9946 1351960035",
    "",
    "Example for the SUCCESSFUL Transaction (gets NFT details):",
    "  node inspect_nft.js pinnacle 0x5acdbba51a3be759 186916977664774",
  ].join("\n");
  logger.info(helpText);
}

/**
 * Main application function to parse commands and execute.
 */
async function main() {
  const command = process.argv[2];
  const args = process.argv.slice(3);

  // Load Cadence scripts
  const pinnacleScriptCode = loadCadenceScript("flow/pinnacle.cdc");
  const getEditionScriptCode = loadCadenceScript("flow/get_edition.cdc");

  logger.info("Scripts loaded successfully");

  switch (command) {
    case "pinnacle": {
      if (args.length < 2) {
        logger.error("The 'pinnacle' command requires <address> and <nftID>");
        showHelp();
        return;
      }
      const [address, nftId] = args;
      logger.info({ address, nftId }, "Running pinnacle.cdc");
      const pinnacleResult = await executeScript(pinnacleScriptCode, [
        fcl.arg(address, t.Address),
        fcl.arg(nftId, t.UInt64),
      ]);
      logger.info({ result: pinnacleResult }, "Script result");
      break;
    }

    case "edition": {
      if (args.length < 1) {
        logger.error("The 'edition' command requires an <editionID>");
        showHelp();
        return;
      }
      const [editionId] = args;
      logger.info({ editionId }, "Running get_edition.cdc");
      const editionResult = await executeScript(getEditionScriptCode, [
        fcl.arg(editionId, t.Int),
      ]);
      logger.info({ result: editionResult }, "Script result");
      break;
    }

    default:
      logger.warn("Invalid command");
      showHelp();
      break;
  }
}

main().catch((e) => logger.error({ err: e }, "Unhandled error"));
