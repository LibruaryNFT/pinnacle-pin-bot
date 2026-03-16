/**
 * Secret Loader — Bootstrap secrets from GCP Secret Manager into process.env.
 *
 * Call `await loadSecrets()` at the very top of your app's entrypoint, before
 * any code reads process.env. Existing code continues to use process.env.X
 * unchanged — this just populates the env vars from GCP SM instead of dotenv.
 *
 * Configuration env vars (set these in systemd unit or shell):
 *   GCP_PROJECT_ID                  - GCP project containing secrets (required)
 *   GOOGLE_APPLICATION_CREDENTIALS  - Path to service account JSON key file (required on servers)
 *   SECRET_PROVIDER                 - 'gcp' (default on servers) or 'dotenv' (local dev)
 */

const SECRET_MAP = {
  PINNACLEPINBOT_API_KEY: "PINNACLEPINBOT_API_KEY",
  PINNACLEPINBOT_API_SECRET: "PINNACLEPINBOT_API_SECRET",
  PINNACLEPINBOT_ACCESS_TOKEN: "PINNACLEPINBOT_ACCESS_TOKEN",
  PINNACLEPINBOT_ACCESS_SECRET: "PINNACLEPINBOT_ACCESS_SECRET",
};

async function loadSecrets(opts = {}) {
  const provider = opts.provider || process.env.SECRET_PROVIDER || "gcp";

  if (provider === "dotenv") {
    loadDotenvFallback();
    return;
  }

  const projectId = opts.projectId || process.env.GCP_PROJECT_ID;
  if (!projectId) {
    console.warn("[secret-loader] GCP_PROJECT_ID not set. Falling back to dotenv.");
    loadDotenvFallback();
    return;
  }

  let SecretManagerServiceClient;
  try {
    ({ SecretManagerServiceClient } = require("@google-cloud/secret-manager"));
  } catch {
    console.error(
      "[secret-loader] @google-cloud/secret-manager not installed. " +
        "Install with: npm install @google-cloud/secret-manager"
    );
    throw new Error("@google-cloud/secret-manager not installed");
  }

  const client = new SecretManagerServiceClient();
  const secretMap = opts.only
    ? Object.fromEntries(Object.entries(SECRET_MAP).filter(([k]) => opts.only.includes(k)))
    : SECRET_MAP;

  let loaded = 0;
  let failed = 0;

  const entries = Object.entries(secretMap);
  const results = await Promise.allSettled(
    entries.map(async ([envVar, gcpName]) => {
      if (process.env[envVar]) return null;
      const name = `projects/${projectId}/secrets/${gcpName}/versions/latest`;
      const [response] = await client.accessSecretVersion({ name });
      return { envVar, value: response.payload.data.toString("utf8").trim() };
    })
  );

  for (const result of results) {
    if (result.status === "fulfilled" && result.value) {
      process.env[result.value.envVar] = result.value.value;
      loaded++;
    } else if (result.status === "rejected") {
      failed++;
      console.warn(`[secret-loader] Failed: ${result.reason.message}`);
    }
  }

  console.log(`[secret-loader] ${loaded} loaded, ${failed} failed`);
}

function loadDotenvFallback() {
  try {
    const dotenv = require("dotenv");
    const fs = require("fs");
    const paths = [".env", "../.env"];
    for (const p of paths) {
      if (fs.existsSync(p)) {
        dotenv.config({ path: p });
        console.log(`[secret-loader] Loaded from ${p} (dotenv fallback)`);
        return;
      }
    }
    console.warn("[secret-loader] No .env file found for dotenv fallback");
  } catch {
    console.warn("[secret-loader] dotenv not installed, no fallback available");
  }
}

module.exports = { loadSecrets, SECRET_MAP };
