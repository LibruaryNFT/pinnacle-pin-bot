# Pinnacle Pin Bot

A Node.js bot that monitors the Flow blockchain for Disney Pinnacle NFT sales and automatically posts them to a Twitter/X account.

This bot is designed to be robust and manageable, with features for live monitoring, historical backfilling, and safe testing.

## Features

- **Real-Time Monitoring:** Subscribes to live marketplace events on the Flow network.
- **Historical Backfilling:** Scans a specified range of past blocks to find and process missed sales.
- **Safe "Dry-Run" by Default:** Executes all logic without sending actual tweets unless explicitly enabled, making testing safe and predictable.
- **Resilient Data Handling:** Safely parses on-chain NFT metadata, even in cases of corrupted or malformed data.
- **Robust Address Extraction:** Handles various Flow event address formats including Optional wrappers and nested structures.
- **Enhanced Debugging:** Comprehensive logging and error handling for troubleshooting issues.
- **Flexible Execution:** Offers multiple command-line flags for debugging, utility, and fine-tuning runs.

## Prerequisites

- [Node.js](https://nodejs.org/) (v18 or later recommended)
- [npm](https://www.npmjs.com/) (usually included with Node.js)

## Installation & Setup

1.  **Clone the repository:**
    ```bash
    git clone [https://github.com/LibruaryNFT/pinnacle-pin-bot.git](https://github.com/LibruaryNFT/pinnacle-pin-bot.git)
    cd pinnacle-pin-bot
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Create a configuration file:**
    Create a file named `.env` in the root of the project. You can copy the example file to start:

    ```bash
    cp .env.example .env
    ```

## Configuration (`.env` file)

Fill in the `.env` file with your specific API keys and access tokens. You will need developer access for both Twitter/X and a Flow provider.

```ini
# .env file

# --- Twitter API v2 Credentials ---
# From your Twitter Developer Portal App
TWITTER_API_KEY="YOUR_APP_KEY"
TWITTER_API_SECRET="YOUR_APP_KEY_SECRET"

# --- Twitter Account Access Tokens ---
# Generated for the account you want to tweet from (@PinnaclePinBot)
PINNACLEPINBOT_ACCESS_TOKEN="YOUR_ACCOUNT_ACCESS_TOKEN"
PINNACLEPINBOT_ACCESS_SECRET="YOUR_ACCOUNT_ACCESS_SECRET"

# --- Flow Configuration (Optional) ---
# The defaults point to Flow Mainnet, but you can override them here
FLOW_ACCESS_NODE="[https://mainnet.onflow.org](https://mainnet.onflow.org)"
FLOW_REST_ENDPOINT="[https://rest-mainnet.onflow.org](https://rest-mainnet.onflow.org)"

## Usage (Command Modes)

The bot is designed to be **safe by default**. It will not send any tweets unless you explicitly enable it with the `--live-tweets` flag.

---

### Live Monitoring

* `node monitor.js`
    * **Safe Mode (Default):** Watches for new sales and prints the would-be tweet to the console. **Does NOT tweet.**

* `node monitor.js --live-tweets`
    * **Live Mode:** Watches for new sales and sends real tweets to your configured Twitter account.

### Processing Past Sales (Backfilling)

* `node monitor.js --backfill --from-block=<start> --to-block=<end>`
    * **Safe Backfill:** Scans a specific range of past blocks for sales and prints the would-be tweets to the console.

* `node monitor.js --backfill --from-block=<start> --to-block=<end> --live-tweets`
    * **Live Backfill:** Scans a block range and sends real tweets for any sales found.

**Example with known Pinnacle sales:**
```bash
# Test with blocks containing Pinnacle NFT sales (March 23, 2025)
node monitor.js --backfill --from-block=107484180 --to-block=107484190
```
This block range contains 2 Pinnacle NFT sales that can be used for testing the bot's functionality.

**Example with specific transaction:**
```bash
# Test address extraction with a known transaction
node scripts/inspect_events.js 592559158b887b620771108c39a67b282be48fe8673231f7741dcf9a2255c135
```
This transaction demonstrates the robust address extraction handling various Flow event formats.

## Debugging Tools

The project includes two debugging scripts in the `scripts/` folder to help troubleshoot issues with Flow blockchain data and NFT information.

### Inspect Transaction Events

Use this script to examine the raw events from a specific Flow transaction:

```bash
node scripts/inspect_events.js <TRANSACTION_ID>
```

**Example:**
```bash
node scripts/inspect_events.js 1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef
```

This will:
- Fetch the transaction data from Flow mainnet
- Decode all event payloads from base64
- Display the raw event data in JSON format
- Help you understand what data is available in marketplace events

### Inspect NFT Data

Use this script to test the Cadence scripts directly and fetch NFT/edition information:

```bash
# Get NFT details by address and NFT ID
node scripts/inspect_nft.js pinnacle <ADDRESS> <NFT_ID>

# Get edition details by edition ID  
node scripts/inspect_nft.js edition <EDITION_ID>
```

**Examples:**
```bash
# Get details for a specific NFT
node scripts/inspect_nft.js pinnacle 0x3b562bcf2c6e9946 1351960035

# Get details for a specific edition
node scripts/inspect_nft.js edition 12345
```

This will:
- Execute the same Cadence scripts used by the main bot
- Return the raw NFT/edition data from the blockchain
- Help verify that the Flow scripts are working correctly
- Show you the exact data structure returned by the contracts

### When to Use These Tools

- **Debugging failed sales** - Use `inspect_events.js` to see what events were emitted
- **Testing Flow scripts** - Use `inspect_nft.js` to verify your Cadence code works
- **Understanding data structure** - Both tools show the raw blockchain data format
- **Troubleshooting bot issues** - Compare what the bot sees vs. what's actually on-chain

### Troubleshooting Common Issues

**Event Decoding Problems:**
- If events aren't being processed, check that the Flow REST API is accessible
- The bot uses direct REST API calls for more reliable event fetching than FCL's event subscription
- Complex Flow event structures (like Type objects) are automatically handled by the bot's decoding logic

**Address Extraction Issues:**
- The bot now handles various Flow address formats including Optional wrappers and nested structures
- If you see "UnknownSeller" or "UnknownBuyer", the bot will log detailed debug information about the address format
- Address extraction failures are logged with the exact field structure for troubleshooting

**Price Threshold Filtering:**
- The bot only processes sales above the configured price threshold (default: $100)
- Sales below the threshold are logged but skipped to avoid spam
- You can temporarily lower the threshold in the config for testing

**Transaction Result Fetching:**
- The bot may encounter API errors when fetching transaction details for buyer/seller detection
- This is handled gracefully and won't prevent the bot from processing sales
- The bot will continue to function even if some transaction details can't be retrieved

**Tweet Format:**
- Sale prices are displayed as whole dollar amounts (no cents) for cleaner formatting
- The "Max Mint" line is only shown if the edition has a maximum mint value
- Serial numbers are only displayed if they exist for the NFT

## License

This project is licensed under the MIT License.