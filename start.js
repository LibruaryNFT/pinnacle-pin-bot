/**
 * Entrypoint for production (systemd).
 * Sources /etc/gcp/env for GCP credentials, loads secrets from GCP SM,
 * then starts monitor.js.
 */
const fs = require("fs");
const { loadSecrets } = require("./lib/secret-loader");

// Source /etc/gcp/env if it exists (GCP_PROJECT_ID, GOOGLE_APPLICATION_CREDENTIALS)
const gcpEnvPath = "/etc/gcp/env";
if (fs.existsSync(gcpEnvPath)) {
  for (const line of fs.readFileSync(gcpEnvPath, "utf8").split("\n")) {
    const match = line.match(/^([A-Z_]+)=(.+)$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2];
    }
  }
}

async function main() {
  await loadSecrets();
  require("./monitor");
}

main().catch((err) => {
  console.error("[start] Fatal:", err.message);
  process.exit(1);
});
