const fs = require("fs");
const path = require("path");

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, "../logs");
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}

/**
 * Get current timestamp in ISO format
 * @returns {string} ISO timestamp
 */
function getTimestamp() {
  return new Date().toISOString();
}

/**
 * Format log entry with timestamp and data
 * @param {string} type - Log type/level
 * @param {string} message - Log message
 * @param {Object} data - Additional data to log
 * @returns {string} Formatted log entry
 */
function formatLog(type, message, data = {}) {
  return JSON.stringify({
    timestamp: getTimestamp(),
    type,
    message,
    data,
  });
}

/**
 * Write log entry to file
 * @param {string} filename - Log file name
 * @param {string} entry - Log entry to write
 */
function logToFile(filename, entry) {
  const logPath = path.join(logsDir, filename);
  fs.appendFileSync(logPath, entry + "\n");
}

/**
 * Decode base64 event payload
 * @param {string} payload - Base64 encoded payload
 * @returns {Object|null} Decoded payload or null if invalid
 */
function decodeEventPayloadBase64(payload) {
  try {
    return JSON.parse(Buffer.from(payload, "base64").toString());
  } catch (err) {
    return null;
  }
}

/**
 * Format event data for logging
 * @param {Object} event - Event object
 * @returns {Object} Formatted event data
 */
function formatEventData(event) {
  const decoded = event.payload
    ? decodeEventPayloadBase64(event.payload)
    : null;

  return {
    type: event.type,
    transactionId: event.transactionId,
    eventIndex: event.eventIndex,
    blockHeight: event.blockHeight,
    blockTimestamp: event.blockTimestamp,
    decodedPayload: decoded,
    rawPayload: event.payload,
  };
}

/**
 * Main logging function
 * @param {string} type - Log type/level
 * @param {string} message - Log message
 * @param {Object} data - Additional data to log
 */
function logEvent(type, message, data = {}) {
  const logEntry = formatLog(type, message, data);
  console.log(`[${getTimestamp()}] ${type}: ${message}`);
  logToFile("events.log", logEntry);
}

/**
 * Error logging function
 * @param {string} type - Error type
 * @param {string} message - Error message
 * @param {Error} error - Error object
 */
function logError(type, message, error) {
  const errorData = {
    message: error.message,
    stack: error.stack,
    ...error,
  };
  const logEntry = formatLog(type, message, errorData);
  console.error(`[${getTimestamp()}] ${type}: ${message}`, error);
  logToFile("errors.log", logEntry);
}

/**
 * Log skipped events
 * @param {Object} event - Event object
 * @param {Object} txResults - Transaction results
 * @param {string} reason - Reason for skipping
 */
function logSkippedEvent(event, txResults, reason) {
  const logEntry = formatLog("SKIPPED_EVENT", reason, {
    event: formatEventData(event),
    txResults: txResults
      ? {
          status: txResults.status,
          error: txResults.error,
          events: txResults.events?.map((e) => formatEventData(e)),
        }
      : null,
  });
  logToFile("skipped_events.log", logEntry);
}

/**
 * Log edition query results
 * @param {string|number} editionId - Edition ID
 * @param {Object} result - Query result
 */
function logEditionQuery(editionId, result) {
  logEvent("EDITION_QUERY", `Querying edition ${editionId}`, {
    editionId,
    result,
    renderID: result?.renderID,
  });
}

/**
 * Log tweet attempts
 * @param {Object} params - Tweet attempt parameters
 */
function logTweetAttempt({
  success,
  error,
  tweetText,
  imageUrl,
  event,
  txId,
  price,
  nftType,
  nftId,
  marketplaceSource,
  txResults,
}) {
  const logEntry = formatLog(
    success ? "TWEET_SUCCESS" : "TWEET_FAILURE",
    `Pinnacle tweet ${success ? "succeeded" : "failed"}`,
    {
      success,
      error: error
        ? {
            message: error.message,
            stack: error.stack,
          }
        : null,
      tweetText,
      imageUrl,
      event: formatEventData(event),
      txId,
      price,
      nftType,
      nftId,
      marketplaceSource,
      txResults: txResults
        ? {
            status: txResults.status,
            error: txResults.error,
            events: txResults.events?.map((e) => formatEventData(e)),
          }
        : null,
    }
  );
  logToFile("tweets.log", logEntry);
}

/**
 * Log all events in a transaction (for debugging)
 * @param {Array} events - Array of events to log
 */
function logAllEvents(events) {
  if (!events || events.length === 0) {
    console.log("=== No events provided to logAllEvents ===");
    return;
  }

  console.log("=== ALL EVENTS in TX (Sale met tweet criteria) ===");
  console.log(`Total events: ${events.length}`);

  for (const evt of events) {
    const formattedEvent = formatEventData(evt);

    console.log("\n----------------------------------------");
    console.log(`Event Type: ${formattedEvent.type}`);
    console.log(`Transaction ID: ${formattedEvent.transactionId}`);
    console.log(`Event Index: ${formattedEvent.eventIndex}`);
    console.log(`Block Height: ${formattedEvent.blockHeight}`);
    console.log(`Block Timestamp: ${formattedEvent.blockTimestamp}`);

    if (formattedEvent.decodedPayload) {
      console.log("\nDecoded Payload:");
      console.log(JSON.stringify(formattedEvent.decodedPayload, null, 2));
    } else {
      console.log("\nRaw Payload (Base64):");
      console.log(formattedEvent.rawPayload);
    }
    console.log("----------------------------------------");
  }

  console.log("\n=== END ALL EVENTS ===");

  // Also log to file for persistence
  const logEntry = formatLog("DEBUG_EVENTS", "Transaction events", {
    events: events.map((e) => formatEventData(e)),
  });
  logToFile("debug_events.log", logEntry);
}

function logTweetAttempt(tweetData) {
  console.log("\nAttempting to tweet:");
  console.log("----------------------------------------");
  console.log(tweetData.tweetText);
  if (tweetData.imageUrl) {
    console.log("\nImage URL:", tweetData.imageUrl);
  }
  console.log("----------------------------------------\n");
}

function logTweetSuccess(tweetData) {
  console.log("\nSuccessfully tweeted:");
  console.log("----------------------------------------");
  console.log(tweetData.tweetText);
  if (tweetData.imageUrl) {
    console.log("\nImage URL:", tweetData.imageUrl);
  }
  console.log("----------------------------------------\n");
}

function logTweetError(tweetData, error) {
  console.error("\nFailed to tweet:");
  console.error("----------------------------------------");
  console.error("Tweet text:", tweetData.tweetText);
  if (tweetData.imageUrl) {
    console.error("Image URL:", tweetData.imageUrl);
  }
  console.error("Error:", error.message);
  if (error.stack) {
    console.error("Stack trace:", error.stack);
  }
  console.error("----------------------------------------\n");
}

module.exports = {
  logEvent,
  logError,
  logSkippedEvent,
  logEditionQuery,
  logTweetAttempt,
  logAllEvents,
  logTweetSuccess,
  logTweetError,
};
