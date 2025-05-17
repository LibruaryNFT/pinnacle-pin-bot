const Buffer = require("buffer").Buffer;

function decodeBase64(base64String) {
  try {
    const buffer = Buffer.from(base64String, "base64");
    return buffer.toString("utf-8");
  } catch (error) {
    console.error("Error decoding base64:", error);
    return null;
  }
}

module.exports = {
  decodeBase64,
};
