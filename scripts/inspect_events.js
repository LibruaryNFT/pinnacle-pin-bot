// A simple script to fetch and inspect the events from a Flow transaction.
// This version handles cases where events must be fetched from a separate 'transaction_results' endpoint.

const fetch = require("node-fetch");

// Configuration
const FLOW_REST_ENDPOINT = "https://rest-mainnet.onflow.org";

/**
 * Decodes a Base64 event payload into a JavaScript object.
 */
function decodePayload(payloadBase64) {
  if (!payloadBase64) {
    return null;
  }
  try {
    const jsonString = Buffer.from(payloadBase64, "base64").toString("utf-8");
    return JSON.parse(jsonString);
  } catch (e) {
    console.error("Failed to decode or parse payload:", e);
    return { error: "Could not decode payload", original: payloadBase64 };
  }
}

/**
 * Main function to fetch and process transaction events.
 */
async function inspectTransaction(txId) {
  if (!txId) {
    console.error("Error: Please provide a transaction ID.");
    console.log("Usage: node inspect_events.js <YOUR_TRANSACTION_ID>");
    return;
  }

  console.log(`🔍 Fetching data for transaction: ${txId}\n`);

  const initialUrl = `${FLOW_REST_ENDPOINT}/v1/transactions/${txId}`;

  try {
    let events = [];

    // --- STEP 1: Fetch the core transaction data ---
    const initialResponse = await fetch(initialUrl);
    if (!initialResponse.ok) {
      throw new Error(`API request to ${initialUrl} failed with status ${initialResponse.status}: ${initialResponse.statusText}`);
    }
    const txData = await initialResponse.json();

    // --- STEP 2: Check if events are included. If not, fetch them from the results endpoint. ---
    if (txData.result?.events) {
      console.log("✅ Events found in initial transaction response.");
      events = txData.result.events;
    } else {
      console.log("... Events not in initial response. Fetching from transaction_results endpoint...");
      const resultsUrl = `${FLOW_REST_ENDPOINT}/v1/transaction_results/${txId}`;
      const resultsResponse = await fetch(resultsUrl);
      if (!resultsResponse.ok) {
        throw new Error(`API request to ${resultsUrl} failed with status ${resultsResponse.status}: ${resultsResponse.statusText}`);
      }
      const txResult = await resultsResponse.json();
      events = txResult.events;
    }

    if (!events || events.length === 0) {
      console.log("No events found after checking both endpoints.");
      return;
    }

    console.log(`✅ Found ${events.length} events. Decoding payloads:\n`);

    for (const event of events) {
      console.log("--------------------------------------------------");
      console.log(`Event Type: ${event.type}`);
      console.log("--------------------------------------------------");
      const decodedPayload = decodePayload(event.payload);
      console.log(JSON.stringify(decodedPayload, null, 2));
      console.log("\n");
    }
  } catch (error) {
    console.error(`An error occurred: ${error.message}`);
  }
}

// Get the transaction ID from the command line arguments
const transactionId = process.argv[2];

// Run the script
inspectTransaction(transactionId);