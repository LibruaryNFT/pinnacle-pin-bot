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
| Bot live on Hetzner VPS (46.225.59.82) | Done | systemd service, auto-restart |
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
- Runs on Hetzner VPS (46.225.59.82) as a systemd service
- Shares VPS with flow-event-listener
- See `c:\Code\command-center\infrastructure\hetzner\vps.md` for VPS details

## Deployment
```bash
# SSH to Hetzner VPS
ssh -i ~/.ssh/id_ed25519 root@46.225.59.82

# Pull latest and restart
cd ~/pinnacle-pin-bot
git pull
sudo systemctl restart pinnacle-pin-bot
```
