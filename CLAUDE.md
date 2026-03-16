# Pinnacle Pin Bot

## Command Center

This project is part of the LibruaryNFT agent network, coordinated by the command center at `c:\Code\command-center`.

| Resource | Path |
|----------|------|
| Task list | `c:\Code\command-center\TODO.md` |
| Deployment log | `c:\Code\command-center\deployments\log.md` |
| Incident log | `c:\Code\command-center\incidents\log.md` |
| Cost tracker | `c:\Code\command-center\costs\tracker.md` |
| Agent registry | `c:\Code\command-center\agents\registry.md` |
| Conventions | `c:\Code\command-center\CONVENTIONS.md` |

**Bug tracking:** Use `report_bug` MCP tool for cross-repo bugs. Creates SQLite record + event log + optional GitHub Issue.

**Session start:** Read this repo's CLAUDE.md (especially Current Status). Check TODO.md for active tasks.

**After completing work:**
1. Update this repo's **Current Status** section below (milestones, what's next)
2. Update command center files: mark TODOs done, log deployments, log incidents
3. Follow commit format and conventions in `c:\Code\command-center\CONVENTIONS.md`

## Current Status

| Milestone | Status | Notes |
|-----------|--------|-------|
| Bot live on Vaultopolis VPS (46.225.59.82) | Done | systemd service at `/opt/pinnacle-pin-bot`, auto-restart |
| Flow event scanning | Done | Pinnacle NFT sales on mainnet |
| Twitter posting (@PinnaclePinBot) | Done | Twitter API v2, Free tier (1,500 posts/month) |
| Card design v2 (1440×1440 2x) | Done | Solid color tiers, full set names, Space Grotesk font |
| GCP Secret Manager integration | Done | 4 secrets, no .env on server |

**Last updated:** 2026-03-16

## What This Is

Twitter bot that monitors Disney Pinnacle NFT sales on the Flow blockchain and tweets about them via @PinnaclePinBot. Generates custom sale card images (1440×1440) attached to each tweet.

## Stack
- Node.js
- Flow Access Node (mainnet event scanning)
- `node-canvas` (server-side image generation)
- Twitter API v2 (posting via `twitter-api-v2`)
- GCP Secret Manager (runtime secret loading via `secret-loader.js`)

## Twitter / X API

- **App:** PinnaclePinBotv2 (under @PinnaclePinBot developer account)
- **Tier:** Free — 1,500 posts/month at $0 (no payment needed)
- **Auth:** OAuth 1.0a (Consumer Key/Secret + Access Token/Secret)
- **Tweet threshold:** Sales above $150 USD trigger a tweet
- **Throttling:** 60s gap + 20s jitter between tweets

## Key Management

All secrets loaded at runtime from GCP Secret Manager via `lib/secret-loader.js`. **No .env files on the server.**

| Secret | GCP SM Name | Notes |
|--------|-------------|-------|
| Twitter Consumer Key | `PINNACLEPINBOT_API_KEY` | PinnaclePinBotv2 app |
| Twitter Consumer Secret | `PINNACLEPINBOT_API_SECRET` | PinnaclePinBotv2 app |
| Twitter Access Token | `PINNACLEPINBOT_ACCESS_TOKEN` | @PinnaclePinBot account |
| Twitter Access Secret | `PINNACLEPINBOT_ACCESS_SECRET` | @PinnaclePinBot account |

**Key rotation (2026-03-16):** All old versions destroyed. Only latest versions active.

The VPS loads GCP credentials from `/etc/gcp/env` which sets `GOOGLE_APPLICATION_CREDENTIALS` and `GCP_PROJECT_ID`. The `start.js` wrapper sources these before requiring `monitor.js`.

## Card Design System

The sale card (`render-card.js`) generates a 1440×1440 image (2x for crisp display on Twitter/mobile):

- **Layout:** 38% left panel (text) / 62% right panel (NFT image)
- **Font:** Space Grotesk (all weights)
- **Color system:** 3 solid tiers — Primary `#FFFFFF`, Secondary `#C0C8D4`, Tertiary `#8A94A0` (no opacity)
- **Background:** Left gradient `#0D0F20` → `#080C1E`, Right `#0E0E1C` → `#0A0A14`
- **Set names:** Full name displayed, word-wrapped up to 2 lines via `wrapText()` helper
- **Badges:** Edition type + Chaser/Variant badges with color-coded backgrounds

### Mockup & Preview Workflow

To iterate on card design without deploying:

```bash
# Generate current vs proposed comparison
node preview-comparison.js
# Opens preview/comparison.html with side-by-side cards + tweet preview

# Generate all 4 sample variants
node preview-cards.js
# Opens preview/index.html with grid of all card types
```

- `render-card.js` — production card renderer (deployed)
- `render-card-proposed.js` — working copy for design iteration
- `render-card-old.js` — backup of previous design
- `preview/sample-pin.png` — cached NFT image for local rendering (Disney CDN returns 403)

## Infrastructure
- Runs on Vaultopolis VPS (46.225.59.82) as a systemd service
- Deploy path: `/opt/pinnacle-pin-bot`
- Shares VPS with flow-event-listener and other services
- See `c:\Code\command-center\infrastructure\hetzner\vps-vaultopolis.md` for VPS details

## Deployment

```bash
# 1. Commit and push locally
git add -A && git commit -m "description" && git push

# 2. SSH to Vaultopolis VPS
ssh -i ~/.ssh/id_ed25519 root@46.225.59.82

# 3. Pull latest and restart
cd /opt/pinnacle-pin-bot
git pull
sudo systemctl restart pinnacle-pin-bot

# 4. Verify
journalctl -u pinnacle-pin-bot -f
```

## Running Locally

```bash
# Safe mode (no tweets)
node monitor.js

# Live tweeting
node monitor.js --live-tweets

# Backfill historical blocks
node monitor.js --backfill --from-block=<start> --to-block=<end>
```

## Critical Rules

- **NEVER commit secrets** — all keys are in GCP Secret Manager
- **NEVER copy .env to the server** — secrets are loaded at runtime via secret-loader.js
- **Test Twitter auth without tweeting:** Use `client.v2.me()` to verify credentials
