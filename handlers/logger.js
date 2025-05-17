// eventHandlers/logger.js - UPDATED (Minor robustness)

const Buffer = require("buffer").Buffer;
const fs = require("fs");
const path = require("path");

/**
 * Attempt to decode a base64-encoded event payload into JSON.
 * Returns null if decoding or JSON.parse fails.
 */
function decodeEventPayloadBase64(payloadBase64) {
  try {
    const buff = Buffer.from(payloadBase64, "base64");
    return JSON.parse(buff.toString("utf-8"));
  } catch {
    return null;
  }
}

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, "..", "logs");
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}

// Get current date in YYYY-MM-DD format for log file naming
function getCurrentDate() {
  return new Date().toISOString().split("T")[0];
}

// Format timestamp for log entries
function getTimestamp() {
  return new Date().toISOString();
}

/**
 * logAllEvents: for debugging, print out each event's type + fully decoded fields if possible.
 * Now called conditionally only when a tweet is being sent.
 */
function logAllEvents(events) {
  // Add check for null/undefined events array
  if (!events || events.length === 0) {
    console.log("=== No events provided to logAllEvents ===");
    return;
  }
  console.log("=== ALL EVENTS in TX (Sale met tweet criteria) ==="); // Updated header
  for (const evt of events) {
    const decoded = evt.payload ? decodeEventPayloadBase64(evt.payload) : null;
    console.log(
      `Event type=${evt.type}, decoded=`,
      // Limit stringify depth slightly for very large payloads if needed (optional)
      JSON.stringify(decoded, null, 2 /*, optional depth limit e.g., 5 */)
    );
  }
  console.log("=== END ALL EVENTS ===");
}

// Log tweet attempt with all relevant information
function logTweetAttempt(tweetInfo) {
  const {
    botType, // 'pinnacle' or 'flowSales'
    success,
    error,
    tweetText,
    imageUrl,
    event,
    txId,
    price,
    collectionName,
    nftType,
    nftId,
    marketplaceSource,
    handlerName,
    txResults, // Add transaction results
  } = tweetInfo;

  const logEntry = {
    timestamp: getTimestamp(),
    botType,
    success,
    error: error ? error.message : null,
    tweetText,
    imageUrl,
    rawEvent: {
      type: event.type,
      transactionId: txId,
      data: event.data,
      // Include all raw event fields
      blockId: event.blockId,
      blockHeight: event.blockHeight,
      blockTimestamp: event.blockTimestamp,
      eventIndex: event.eventIndex,
      payload: event.payload,
    },
    transactionResults: txResults
      ? {
          events: txResults.events?.map((ev) => ({
            type: ev.type,
            transactionId: ev.transactionId,
            transactionIndex: ev.transactionIndex,
            eventIndex: ev.eventIndex,
            data: ev.data,
            payload: ev.payload,
          })),
        }
      : null,
    metadata: {
      price,
      collectionName,
      nftType,
      nftId,
      marketplaceSource,
      handlerName,
    },
  };

  const logFile = path.join(logsDir, `tweets-${getCurrentDate()}.json`);

  // Read existing logs or create new array
  let logs = [];
  try {
    if (fs.existsSync(logFile)) {
      const content = fs.readFileSync(logFile, "utf8");
      logs = JSON.parse(content);
    }
  } catch (e) {
    console.error("Error reading log file:", e);
  }

  // Add new log entry
  logs.push(logEntry);

  // Write back to file
  try {
    fs.writeFileSync(logFile, JSON.stringify(logs, null, 2));
  } catch (e) {
    console.error("Error writing to log file:", e);
  }

  // Also log to console for immediate visibility
  console.log(`\n[Tweet ${success ? "Success" : "Failure"}] ${botType} Bot`);
  console.log(`Transaction: ${txId}`);
  console.log(`Collection: ${collectionName}`);
  console.log(`Price: ${price}`);
  if (error) {
    console.error("Error:", error.message);
  }
}

module.exports = {
  decodeEventPayloadBase64,
  logAllEvents,
  logTweetAttempt,
};
