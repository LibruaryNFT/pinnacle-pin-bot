/**
 * Pure helper functions extracted from monitor.js for testability.
 * No side effects, no I/O, no external dependencies.
 */

/**
 * Recursively extracts the inner value from Flow Cadence typed objects.
 * Handles Type objects with staticType.typeID and regular {value:...} wrappers.
 */
function extract(v) {
  if (!v || typeof v !== "object") return v;

  // Handle Type objects specifically
  if (v.type === "Type" && v.value && v.value.staticType && v.value.staticType.typeID) {
    return v.value.staticType.typeID;
  }

  // Handle regular value objects
  if ("value" in v) {
    return extract(v.value);
  }

  return v;
}

/**
 * Decodes a base64-encoded Flow event payload into a parsed JSON object.
 * Returns null if decoding or parsing fails.
 */
function decodeEventPayloadBase64(payloadBase64) {
  try {
    const buff = Buffer.from(payloadBase64, "base64");
    return JSON.parse(buff.toString("utf-8"));
  } catch {
    return null;
  }
}

/**
 * Extracts a Flow address string from various nested field formats.
 * Handles plain strings, {value, type} objects, Optional wrappers,
 * objects with .address property, and deep nested objects.
 */
function unwrapAddressField(fieldValue) {
  // Case 1: plain string
  if (typeof fieldValue === "string") return fieldValue;

  // Case 2: { value:"0xabc", type:"Address" }
  if (fieldValue && typeof fieldValue.value === "string") return fieldValue.value;

  // Case 3: { value:{ value:"0xabc", type:"Address" }, type:"Optional" }
  if (
    fieldValue &&
    typeof fieldValue.value === "object" &&
    fieldValue.value.value &&
    typeof fieldValue.value.value === "string"
  ) {
    return fieldValue.value.value;
  }

  // Case 4: Direct object with address property
  if (fieldValue && typeof fieldValue === "object" && fieldValue.address) {
    return fieldValue.address;
  }

  // Case 5: Nested object — search for any string that looks like a Flow address
  if (fieldValue && typeof fieldValue === "object") {
    const findAddress = (obj) => {
      for (const [, value] of Object.entries(obj)) {
        if (typeof value === "string" && value.startsWith("0x") && value.length === 18) {
          return value;
        }
        if (typeof value === "object" && value !== null) {
          const found = findAddress(value);
          if (found) return found;
        }
      }
      return null;
    };

    const found = findAddress(fieldValue);
    if (found) return found;
  }

  return null;
}

/**
 * Formats a price number as a rounded, locale-formatted string.
 */
function formatPrice(price) {
  return Math.round(price).toLocaleString();
}

/**
 * Composes a tweet string from sale data.
 */
function composeTweet({ usd, chars, ed }) {
  return `$${formatPrice(usd)} — ${chars} just sold on @DisneyPinnacle\nhttps://disneypinnacle.com/pin/${ed.id}`;
}

module.exports = {
  extract,
  decodeEventPayloadBase64,
  unwrapAddressField,
  formatPrice,
  composeTweet,
};
