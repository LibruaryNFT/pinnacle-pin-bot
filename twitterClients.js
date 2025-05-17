const { TwitterApi } = require("twitter-api-v2");
const config = require("./config");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const os = require("os");

// Initialize Twitter clients
const pinnacleBot = new TwitterApi({
  appKey: config.TWITTER_API_KEY,
  appSecret: config.TWITTER_API_SECRET,
  accessToken: config.PINNACLEPINBOT_ACCESS_TOKEN,
  accessSecret: config.PINNACLEPINBOT_ACCESS_SECRET,
});

// Verify credentials
async function verifyCredentials() {
  try {
    await pinnacleBot.v2.me();
    console.log("Twitter client initialized successfully.");
    return true;
  } catch (error) {
    console.error("Error initializing Twitter client:", error);
    return false;
  }
}

// Post a tweet
async function postTweet(text, imageUrl) {
  try {
    let mediaId;

    if (imageUrl) {
      // Create temp directory if it doesn't exist
      const tempDir = path.join(os.tmpdir(), "pinnacle-bot");
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir);
      }

      // Download image
      const response = await axios({
        method: "GET",
        url: imageUrl,
        responseType: "arraybuffer",
      });

      // Save to temp file
      const tempFile = path.join(tempDir, `pin-${Date.now()}.png`);
      fs.writeFileSync(tempFile, response.data);

      // Upload to Twitter
      mediaId = await pinnacleBot.v1.uploadMedia(tempFile);

      // Clean up temp file
      fs.unlinkSync(tempFile);
    }

    // Post tweet with media if available
    const tweet = await pinnacleBot.v2.tweet({
      text,
      ...(mediaId && { media: { media_ids: [mediaId] } }),
    });

    return tweet;
  } catch (error) {
    console.error("Error posting tweet:", error);
    throw error;
  }
}

module.exports = {
  pinnacleBot,
  verifyCredentials,
  postTweet,
};
