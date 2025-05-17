// eventHandlers/parseBuyerSeller.js
// Central helpers for decoding Flow event payloads and extracting buyer / seller.

const Buffer = require("buffer").Buffer;
const { decodeBase64 } = require("../utils");

/* ------------------------------------------------------------------ */
/*  Base‑64 JSON decode helper                                         */
/* ------------------------------------------------------------------ */
function decodeEventPayloadBase64(payloadBase64) {
  try {
    console.log("Attempting to decode payload:", payloadBase64);
    const buff = Buffer.from(payloadBase64, "base64");
    const decoded = JSON.parse(buff.toString("utf-8"));
    console.log(
      "Successfully decoded payload:",
      JSON.stringify(decoded, null, 2)
    );
    return decoded;
  } catch (err) {
    console.error("Failed to decode base64 payload:", err);
    console.error("Raw payload:", payloadBase64);
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Utility: unwrap Cadence Optional <Address?>                        */
/* ------------------------------------------------------------------ */
function unwrapAddressField(fieldValue) {
  console.log("Unwrapping address field:", JSON.stringify(fieldValue, null, 2));

  // Case 1: plain string  => "0xabc…"
  if (typeof fieldValue === "string") {
    console.log("Found direct string address:", fieldValue);
    return fieldValue;
  }

  // Case 2: { value:"0xabc", type:"Address" }
  if (fieldValue && typeof fieldValue.value === "string") {
    console.log("Found address in value field:", fieldValue.value);
    return fieldValue.value;
  }

  // Case 3: { value:{ value:"0xabc", type:"Address" }, type:"Optional" }
  if (
    fieldValue &&
    typeof fieldValue.value === "object" &&
    typeof fieldValue.value.value === "string"
  ) {
    console.log("Found address in nested value field:", fieldValue.value.value);
    return fieldValue.value.value;
  }

  console.log("Could not unwrap address field");
  return null;
}

/* ------------------------------------------------------------------ */
/*  PackNFT buyer / seller (works for any Pack contract)               */
/* ------------------------------------------------------------------ */
function parseBuyerSellerFromPackNFT(events, nftId) {
  let seller = "UnknownSeller";
  let buyer = "UnknownBuyer";

  for (const evt of events) {
    if (
      evt.type.endsWith(".PackNFT.Withdraw") ||
      evt.type.endsWith(".PackNFT.Deposit")
    ) {
      const decoded = evt.payload
        ? decodeEventPayloadBase64(evt.payload)
        : null;
      if (!decoded) continue;

      const fields = decoded.value?.fields || [];

      let eventNftId = null;
      let fromAddr = null;
      let toAddr = null;

      for (const f of fields) {
        if (f.name === "id") eventNftId = String(f.value?.value ?? "");
        if (f.name === "from") fromAddr = unwrapAddressField(f.value?.value);
        if (f.name === "to") toAddr = unwrapAddressField(f.value?.value);
      }

      if (eventNftId === String(nftId)) {
        if (evt.type.endsWith(".Withdraw")) seller = fromAddr || seller;
        if (evt.type.endsWith(".Deposit")) buyer = toAddr || buyer;
      }
    }
  }
  return { seller, buyer };
}

/* ------------------------------------------------------------------ */
/*  Generic NonFungibleToken buyer / seller                            */
/* ------------------------------------------------------------------ */
function parseBuyerSellerFromNonFungibleToken(events, nftType, nftId) {
  let seller = "UnknownSeller";
  let buyer = "UnknownBuyer";

  for (const evt of events) {
    if (
      evt.type === "A.1d7e57aa55817448.NonFungibleToken.Withdrawn" ||
      evt.type === "A.1d7e57aa55817448.NonFungibleToken.Deposited"
    ) {
      const decoded = evt.payload
        ? decodeEventPayloadBase64(evt.payload)
        : null;
      if (!decoded) continue;

      const fields = decoded.value?.fields || [];

      let eventIdString = "";
      let fromAddr = null;
      let toAddr = null;

      for (const f of fields) {
        if (f.name === "id") eventIdString = String(f.value?.value ?? "");
        if (f.name === "from") fromAddr = unwrapAddressField(f.value?.value);
        if (f.name === "to") toAddr = unwrapAddressField(f.value?.value);
      }

      if (eventIdString === String(nftId)) {
        if (evt.type.endsWith(".Withdrawn")) seller = fromAddr || seller;
        if (evt.type.endsWith(".Deposited")) buyer = toAddr || buyer;
      }
    }
  }

  return { seller, buyer };
}

/* ------------------------------------------------------------------ */
/*  Optional Top Shot deposit helper                                   */
/* ------------------------------------------------------------------ */
function parseBuyerSellerFromTopShotDeposit(events, momentID) {
  let buyerAddress = null;
  for (const evt of events) {
    if (evt.type === "A.0b2a3299cc857e29.TopShot.Deposit" && evt.payload) {
      const decoded = decodeEventPayloadBase64(evt.payload);
      if (decoded?.id == momentID) {
        buyerAddress = decoded.to;
        break;
      }
    }
  }
  return buyerAddress;
}

/* ------------------------------------------------------------------ */
module.exports = {
  decodeEventPayloadBase64,
  parseBuyerSellerFromPackNFT,
  parseBuyerSellerFromNonFungibleToken,
  parseBuyerSellerFromTopShotDeposit,
};
