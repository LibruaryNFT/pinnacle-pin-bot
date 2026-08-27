# Pinnacle Pin Bot

## Eco (formerly Command Center)

This project is part of the LibruaryNFT agent network. Cross-repo coordination previously lived in a since-archived companion repo; that repo's docs and tooling now live in the `eco` repo under `eco/intel/`.

| Resource | Path |
|----------|------|
| Deployment log | `eco/intel/deployments/log.md` |
| Incident log | `eco/intel/incidents/log.md` |
| Cost tracker | `eco/intel/costs/tracker.md` |
| Agent registry | `eco/intel/agents/registry.md` |

**Session start:** Read this repo's CLAUDE.md (especially Current Status). Task tracking is via GitHub Issues on this repo.

**After completing work:**
1. Update this repo's **Current Status** section below (milestones, what's next)
2. Update eco: log deployments, log incidents
3. Follow commit format and conventions in `eco/intel/quality/CONVENTIONS.md`

## Current Status

| Milestone | Status | Notes |
|-----------|--------|-------|
| Bot live on GCP VM | Done | systemd service, auto-restart |
| Flow event scanning | Done | Pinnacle NFT sales on mainnet |
| Twitter posting (@PinnaclePinBot) | Done | Twitter API v2 |
| MongoDB state tracking | Done | |

**Last updated:** 2026-03-05

## What This Is

Twitter bot that monitors Disney Pinnacle NFT sales on the Flow blockchain and tweets about them via @PinnaclePinBot.

## Stack
- Node.js
- Flow Access Node (mainnet event scanning)
- MongoDB (state tracking)
- Twitter API v2 (posting)

## Infrastructure
- Runs on GCP VM (us-central1-b) as a systemd service
- Shares VM with flow-event-listener
- See `eco/intel/infrastructure/gcp/vm.md` for VM details

## Deployment
```bash
# SSH to GCP VM
gcloud compute ssh <VM_NAME> --zone us-central1-b

# Pull latest and restart
cd ~/pinnacle-pin-bot
git pull
sudo systemctl restart pinnacle-pin-bot
```
