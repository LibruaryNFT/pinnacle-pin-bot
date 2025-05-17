// metadata.js
// ────────────────────────────────────────────────────────────────────
//  •  getFlowPrice()  — returns live FLOW→USD price
// ────────────────────────────────────────────────────────────────────

const fs = require("fs");
const { fcl } = require("./flow");

/* ──────────────────────────────────────────────────────────── */
/* getFlowPrice()  (USD per FLOW)                               */
/* ──────────────────────────────────────────────────────────── */
const ORACLE_ADDR = "0xe385412159992e11";
const flowPriceCadence = fs.readFileSync("./flow/flowprice.cdc", "utf-8");

let cachedPrice = null;
let cachedAtMs = 0;
const TTL_MS = 60_000;

/**
 * Returns Number | null   (USD per 1 FLOW)
 */
async function getFlowPrice() {
  const now = Date.now();
  if (cachedPrice !== null && now - cachedAtMs < TTL_MS) return cachedPrice;

  try {
    const [ufix] = await fcl.query({
      cadence: flowPriceCadence,
      args: (arg, t) => [arg(ORACLE_ADDR, t.Address)],
    });
    const price = parseFloat(ufix);
    if (!isNaN(price) && price > 0) {
      cachedPrice = price;
      cachedAtMs = now;
      return price;
    }
  } catch (err) {
    console.error("getFlowPrice() oracle query failed:", err);
  }
  return null;
}

module.exports = {
  getFlowPrice,
};
