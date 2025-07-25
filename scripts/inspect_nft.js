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
    console.error(`\n❌ Failed to load script from ${scriptPath}`);
    console.error("Please ensure that the file exists and you are running this script from the root of your project.");
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
    console.error("\n❌ Error during script execution:");
    console.error(e);
    return null;
  }
}

/**
 * Prints the help message and usage instructions.
 */
function showHelp() {
  console.log(`
  Pinnacle NFT Inspector Tool

  This tool executes Cadence scripts to fetch data directly from the Flow Mainnet.

  Usage:
    node inspect_nft.js <command> [arguments]

  Commands:
    pinnacle <address> <nftID>      Runs pinnacle.cdc to get details for a specific NFT.
    edition  <editionID>            Runs get_edition.cdc to get details for an edition.

  ---
  Example for the FAILED Transaction (gets NFT details):
    node inspect_nft.js pinnacle 0x3b562bcf2c6e9946 1351960035

  Example for the SUCCESSFUL Transaction (gets NFT details):
    node inspect_nft.js pinnacle 0x5acdbba51a3be759 186916977664774
  `);
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

  console.log("✅ Scripts loaded successfully.");

  switch (command) {
    case "pinnacle":
      if (args.length < 2) {
        console.error("\nError: The 'pinnacle' command requires <address> and <nftID>.");
        showHelp();
        return;
      }
      const [address, nftId] = args;
      console.log(`\n🔍 Running pinnacle.cdc for NFT ${nftId} owned by ${address}...`);
      const pinnacleResult = await executeScript(pinnacleScriptCode, [
        fcl.arg(address, t.Address),
        fcl.arg(nftId, t.UInt64),
      ]);
      console.log("\n--- Script Result ---");
      console.log(JSON.stringify(pinnacleResult, null, 2));
      break;

    case "edition":
      if (args.length < 1) {
        console.error("\nError: The 'edition' command requires an <editionID>.");
        showHelp();
        return;
      }
      const [editionId] = args;
      console.log(`\n🔍 Running get_edition.cdc for Edition ${editionId}...`);
      const editionResult = await executeScript(getEditionScriptCode, [
        fcl.arg(editionId, t.Int),
      ]);
      console.log("\n--- Script Result ---");
      console.log(JSON.stringify(editionResult, null, 2));
      break;

    default:
      console.log("\nInvalid command.");
      showHelp();
      break;
  }
}

main().catch((e) => console.error(e));