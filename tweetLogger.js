const fs = require("fs");
const path = require("path");

const LOG_DIR = path.join(__dirname, "logs");
const SUCCESS_LOG_FILE = path.join(LOG_DIR, "successful_tweets.log");
const FAILED_LOG_FILE = path.join(LOG_DIR, "failed_tweets.log");

// Ensure logs directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR);
}

function formatLogEntry(data) {
  const timestamp = new Date().toISOString();
  return `[${timestamp}] ${JSON.stringify(data)}\n`;
}

function logTweetAttempt(data) {
  const logFile = data.success ? SUCCESS_LOG_FILE : FAILED_LOG_FILE;
  const logEntry = formatLogEntry(data);

  // Log to file
  fs.appendFile(logFile, logEntry, (err) => {
    if (err) {
      console.error(`Error writing to log file: ${err.message}`);
    }
  });

  // Log to console
  if (data.success) {
    console.log(
      `✅ Tweet successful: NFT #${data.nftId} at $${data.price.toFixed(2)}`
    );
  } else {
    console.log(
      `❌ Tweet failed: NFT #${data.nftId} at $${data.price.toFixed(2)} - ${
        data.reason || data.error || "Unknown reason"
      }`
    );
  }
}

module.exports = {
  logTweetAttempt,
};
