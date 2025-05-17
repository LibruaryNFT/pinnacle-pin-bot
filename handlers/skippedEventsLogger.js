const fs = require("fs");
const path = require("path");

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, "../logs");
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}

function logSkippedEvent(event, txResults, reason) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    reason,
    event: {
      transactionId: event.transactionId,
      type: event.type,
      data: event.data,
    },
    txResults: txResults
      ? {
          status: txResults.status,
          error: txResults.error,
          events: txResults.events?.map((e) => ({
            type: e.type,
            data: e.data,
          })),
        }
      : null,
  };

  const logFile = path.join(logsDir, "skipped_events.log");
  const logLine = JSON.stringify(logEntry) + "\n";

  fs.appendFileSync(logFile, logLine);
}

module.exports = { logSkippedEvent };
