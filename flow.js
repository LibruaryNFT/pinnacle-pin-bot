const fcl = require("@onflow/fcl");
const fetch = require("node-fetch");
const { FLOW_ACCESS_NODE, FLOW_REST_ENDPOINT } = require("./config");
const t = require("@onflow/types");
const fs = require("fs");
const path = require("path");
const { logEditionQuery, logError, logEvent } = require("./utils/logger");

// Configure FCL with gRPC endpoint for real-time events and scripts
fcl
  .config()
  .put("accessNode.api", FLOW_ACCESS_NODE)
  .put("fcl.pollingInterval", 2000);

// Ensure REST endpoint is properly formatted
const REST_ENDPOINT = FLOW_REST_ENDPOINT || "https://rest-mainnet.onflow.org";

// Constants for retry mechanism
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

/**
 * Retry mechanism for async operations
 * @param {Function} operation - Async function to retry
 * @param {number} maxRetries - Maximum number of retries
 * @param {number} delay - Delay between retries in ms
 */
async function withRetry(
  operation,
  maxRetries = MAX_RETRIES,
  delay = RETRY_DELAY
) {
  let lastError;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (i < maxRetries - 1) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}

/**
 * getTransactionData - Uses REST endpoint for detailed transaction data
 * @param {string} txId - Transaction ID to fetch
 * @returns {Promise<Object|null>} Transaction data or null if failed
 */
async function getTransactionData(txId) {
  try {
    logEvent("TX_QUERY", `Getting transaction data from Flow REST for ${txId}`);
    const url = `${REST_ENDPOINT}/v1/transactions/${txId}`;

    const resp = await withRetry(async () => {
      const result = await fetch(url);
      if (!result.ok) {
        throw new Error(
          `API request failed: ${result.status} ${result.statusText}`
        );
      }
      return result;
    });

    const txData = await resp.json();
    logEvent("TX_DATA", `Transaction data retrieved for ${txId}`, {
      scriptLength: txData.script?.length,
      status: txData.status,
    });

    return txData;
  } catch (err) {
    logError(
      "TX_QUERY_ERROR",
      `Error fetching transaction data for ${txId}`,
      err
    );
    return null;
  }
}

/**
 * getTransactionResults - Uses REST endpoint for transaction results
 * @param {string} txId - Transaction ID to fetch results for
 * @returns {Promise<Object|null>} Transaction results or null if failed
 */
async function getTransactionResults(txId) {
  try {
    const url = `${REST_ENDPOINT}/v1/transaction_results/${txId}`;
    logEvent("TX_RESULTS_QUERY", `Getting transaction results for ${txId}`);

    const resp = await withRetry(async () => {
      const result = await fetch(url);
      if (!result.ok) {
        throw new Error(
          `Tx results request failed: ${result.status} ${result.statusText}`
        );
      }
      return result;
    });

    const results = await resp.json();
    logEvent("TX_RESULTS", `Transaction results retrieved for ${txId}`, {
      status: results.status,
    });

    return results;
  } catch (err) {
    logError(
      "TX_RESULTS_ERROR",
      `Error fetching transaction results for ${txId}`,
      err
    );
    return null;
  }
}

/**
 * executeGetEditionScript - Uses gRPC endpoint for script execution
 * @param {number} editionId - Edition ID to query
 * @returns {Promise<Object|null>} Edition data or null if failed
 */
async function executeGetEditionScript(editionId) {
  try {
    const scriptPath = path.join(__dirname, "flow", "get_edition.cdc");
    const script = fs.readFileSync(scriptPath, "utf8");

    const result = await withRetry(async () => {
      return await fcl
        .send([fcl.script(script), fcl.args([fcl.arg(editionId, t.Int)])])
        .then(fcl.decode);
    });

    logEditionQuery(editionId, result);
    return result;
  } catch (error) {
    logError(
      "EDITION_QUERY_ERROR",
      `Error executing get_edition script for edition ${editionId}`,
      error
    );
    return null;
  }
}

/**
 * subscribeToEvents - Uses gRPC endpoint for event subscription
 * @param {Object} options - Subscription options
 * @param {Object} options.fcl - FCL instance
 * @param {Array<string>} options.events - Array of event types to subscribe to
 * @param {Function} options.onEvent - Event handler function
 * @param {Function} options.onError - Error handler function
 */
async function subscribeToEvents({ fcl, events, onEvent, onError }) {
  try {
    logEvent("EVENT_SUB", "Setting up event subscriptions", { events });

    // Subscribe to each event type
    for (const eventType of events) {
      fcl.events(eventType).subscribe((event) => {
        try {
          logEvent("EVENT_RECEIVED", `Received event of type ${eventType}`, {
            txId: event.transactionId,
          });
          onEvent(event);
        } catch (err) {
          if (onError) onError(err);
          logError(
            "EVENT_HANDLER_ERROR",
            `Error handling event ${eventType}`,
            err
          );
        }
      });
    }

    logEvent("EVENT_SUB", "Event subscriptions setup completed");
  } catch (error) {
    logError("EVENT_SUB_ERROR", "Error setting up event subscriptions", error);
    if (onError) onError(error);
  }
}

/**
 * getEvents - Uses REST endpoint to fetch events for a block range
 * @param {string} eventType - Type of event to fetch
 * @param {number} startBlock - Start block height
 * @param {number} endBlock - End block height
 * @returns {Promise<Array>} Array of events or empty array if failed
 */
async function getEvents(eventType, startBlock, endBlock) {
  try {
    logEvent(
      "EVENT_QUERY",
      `Getting events of type ${eventType} from blocks ${startBlock} to ${endBlock}`
    );
    const url = `${REST_ENDPOINT}/v1/events?type=${encodeURIComponent(
      eventType
    )}&start_height=${startBlock}&end_height=${endBlock}`;

    const resp = await withRetry(async () => {
      const result = await fetch(url);
      if (!result.ok) {
        throw new Error(
          `Event request failed: ${result.status} ${result.statusText}`
        );
      }
      return result;
    });

    const data = await resp.json();
    logEvent(
      "EVENT_DATA",
      `Retrieved ${data.length} events of type ${eventType}`,
      {
        startBlock,
        endBlock,
        eventCount: data.length,
      }
    );

    return data;
  } catch (err) {
    logError(
      "EVENT_QUERY_ERROR",
      `Error fetching events of type ${eventType} from blocks ${startBlock} to ${endBlock}`,
      err
    );
    return [];
  }
}

module.exports = {
  fcl,
  getTransactionData,
  getTransactionResults,
  executeGetEditionScript,
  subscribeToEvents,
  withRetry,
  getEvents,
};
