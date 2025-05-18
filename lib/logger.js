// lib/logger.js
const levels = ["error", "warn", "info", "debug"];
const level = process.env.LOG_LEVEL || "info";

function log(lvl = "info", ...msg) {
  if (levels.indexOf(lvl) <= levels.indexOf(level)) {
    const fn = ["error", "warn", "info"].includes(lvl) ? lvl : "log";
    console[fn](`[${new Date().toISOString()}]`, ...msg);
  }
}
module.exports = { log };
