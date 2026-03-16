/**
 * Entrypoint for production (systemd).
 * Loads secrets from GCP Secret Manager, then starts monitor.js.
 */
const { loadSecrets } = require("./lib/secret-loader");

async function main() {
  await loadSecrets();
  require("./monitor");
}

main().catch((err) => {
  console.error("[start] Fatal:", err.message);
  process.exit(1);
});
