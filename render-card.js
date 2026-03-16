"use strict";

const { createCanvas, loadImage, registerFont } = require("canvas");
const path = require("path");

try {
  registerFont(path.join(__dirname, "fonts", "SpaceGrotesk.ttf"), {
    family: "SpaceGrotesk",
  });
} catch {}

const SG = '"SpaceGrotesk", sans-serif';

const TIER = {
  Genesis:      { bg: "rgba(236,72,153,0.22)",  border: "rgba(236,72,153,0.5)",   text: "#F472B6" },
  Legendary:    { bg: "rgba(251,191,36,0.22)",  border: "rgba(251,191,36,0.5)",   text: "#FBBF24" },
  "Ltd Event":  { bg: "rgba(34,211,238,0.20)",  border: "rgba(34,211,238,0.45)",  text: "#22D3EE" },
  "Open Event": { bg: "rgba(20,184,166,0.20)",  border: "rgba(20,184,166,0.45)",  text: "#2DD4BF" },
  Limited:      { bg: "rgba(99,102,241,0.22)",  border: "rgba(99,102,241,0.5)",   text: "#818CF8" },
  Open:         { bg: "rgba(168,85,247,0.22)",  border: "rgba(168,85,247,0.5)",   text: "#C084FC" },
  Starter:      { bg: "rgba(96,165,250,0.22)",  border: "rgba(96,165,250,0.5)",   text: "#60A5FA" },
};

function roundRect(ctx, x, y, w, h, r, fill, stroke) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y,     x + w, y + r,     r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x,     y + h, x,       y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x,     y,     x + r,   y,         r);
  ctx.closePath();
  if (fill)   { ctx.fillStyle = fill;     ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1.5; ctx.stroke(); }
}

function truncate(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 0 && ctx.measureText(t + "…").width > maxWidth) t = t.slice(0, -1);
  return t + "…";
}

/** Word-wrap text to fit within maxWidth, return array of lines */
function wrapText(ctx, text, maxWidth, maxLines = 2) {
  const words = text.split(/\s+/);
  const lines = [];
  let current = "";

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const test = current ? current + " " + word : word;
    if (ctx.measureText(test).width <= maxWidth) {
      current = test;
    } else {
      if (current) lines.push(current);
      current = word;
      if (lines.length >= maxLines - 1) {
        const remaining = [current, ...words.slice(i + 1)].join(" ");
        lines.push(truncate(ctx, remaining, maxWidth));
        return lines;
      }
    }
  }
  if (current) lines.push(current);
  return lines;
}

let _logoImg = null;
async function getLogo() {
  if (_logoImg) return _logoImg;
  try {
    _logoImg = await loadImage(path.join(__dirname, "assets", "vaultopolis-full-logo.png"));
  } catch {}
  return _logoImg;
}

/*
 * PROPOSED v3 — all feedback incorporated:
 *
 * vs current (720×720, dim text, truncated set names):
 *  1. 2x resolution (1440×1440) — crisp on Twitter/mobile
 *  2. Panel split 38/62 (was 34/66) — more text room
 *  3. Background slightly more blue — reads as intentional on Twitter's white timeline
 *  4. Simplified opacity: 3 tiers only (100%, 80%, 60%) — no more muddy mid-values
 *  5. Full set name with word-wrap at 16px (was 14px, split on "•")
 *  6. Better vertical spacing — content distributed evenly, no dead zone
 */
async function renderSaleCard({
  usd, character, setName, serial, maxMint, editionType,
  seller, buyer, nftBuffer, isChaser, variant,
}) {
  const SCALE = 2;
  const W = 720 * SCALE, H = 720 * SCALE;
  const LEFT_W = Math.floor(W * 0.38);               // CHANGED: 34% → 38%
  const PAD = 24 * SCALE;
  const TEXT_MAX = LEFT_W - PAD * 2;

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  const fs = (size) => size * SCALE;

  /* ── Color tiers (solid colors, not opacity — crisper on all screens) ── */
  const PRIMARY   = "#ffffff";                        // names, prices, key data
  const SECONDARY = "#C0C8D4";                        // labels, set name, serial text
  const TERTIARY  = "#8A94A0";                        // small captions (SELLER/BUYER labels)

  /* ── Background — slightly more blue ── */
  const leftGrad = ctx.createLinearGradient(0, 0, 0, H);
  leftGrad.addColorStop(0, "#0D0F20");                // CHANGED: was #0C0618
  leftGrad.addColorStop(1, "#080C1E");                // CHANGED: was #060D1A
  ctx.fillStyle = leftGrad;
  ctx.fillRect(0, 0, LEFT_W, H);

  const rightGrad = ctx.createLinearGradient(LEFT_W, 0, W, H);
  rightGrad.addColorStop(0, "#0E0E1C");               // CHANGED: was #0D0D18
  rightGrad.addColorStop(1, "#0A0A14");               // CHANGED: was #08080F
  ctx.fillStyle = rightGrad;
  ctx.fillRect(LEFT_W, 0, W - LEFT_W, H);

  /* ── Separator line ── */
  ctx.strokeStyle = "rgba(255,255,255,0.10)";
  ctx.lineWidth = 1 * SCALE;
  ctx.beginPath();
  ctx.moveTo(LEFT_W, H * 0.06);
  ctx.lineTo(LEFT_W, H * 0.94);
  ctx.stroke();

  /* ── Right panel: subtle glow ── */
  const tierKey = editionType || "Open";
  const tierStyle = TIER[tierKey] || TIER.Open;
  const gCX = LEFT_W + (W - LEFT_W) / 2;
  const gCY = H / 2;
  const radGlow = ctx.createRadialGradient(gCX, gCY, 0, gCX, gCY, 280 * SCALE);
  radGlow.addColorStop(0, tierStyle.bg.replace(/[\d.]+\)$/, "0.12)"));
  radGlow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = radGlow;
  ctx.fillRect(LEFT_W, 0, W - LEFT_W, H);

  /* ── NFT image ── */
  if (nftBuffer) {
    try {
      const nftImg = await loadImage(nftBuffer);
      const rightW = W - LEFT_W;
      const imgSize = Math.min(440 * SCALE, rightW - 30 * SCALE);
      const imgX = LEFT_W + Math.floor((rightW - imgSize) / 2);
      const imgY = Math.floor((H - imgSize) / 2);
      ctx.drawImage(nftImg, imgX, imgY, imgSize, imgSize);
    } catch {}
  }

  /* ══════════════════════════════════════════════════════════
     LEFT PANEL — distributed vertical spacing
     ══════════════════════════════════════════════════════════ */

  let y = 52 * SCALE;

  /* ── "DISNEY PINNACLE" header ── */
  ctx.font = `800 ${fs(22)}px ${SG}`;
  ctx.fillStyle = SECONDARY;
  ctx.fillText("DISNEY PINNACLE", PAD, y);
  y += 36 * SCALE;

  /* ── Price ── */
  const rounded = Math.round(usd);
  const digits = rounded.toLocaleString();

  let dfs = fs(72);
  let sfs = fs(40);
  function measurePrice(df, sf) {
    ctx.font = `800 ${sf}px ${SG}`;
    let w = ctx.measureText("$").width + 2 * SCALE;
    for (const ch of digits) {
      if (ch === ",") { ctx.font = `700 ${sf}px ${SG}`; }
      else            { ctx.font = `900 ${df}px ${SG}`; }
      w += ctx.measureText(ch).width;
    }
    return w;
  }
  while (dfs > fs(40) && measurePrice(dfs, sfs) > TEXT_MAX) {
    dfs -= 4 * SCALE;
    sfs = Math.round(dfs * 0.55);
  }

  const baseY = y + dfs * 0.85;
  const symYOffset = (dfs - sfs) * 0.35;

  // $ symbol
  ctx.font = `800 ${sfs}px ${SG}`;
  ctx.fillStyle = "rgba(245,200,66,0.85)";
  const dollarW = ctx.measureText("$").width;
  ctx.fillText("$", PAD, baseY - symYOffset);

  // Digits
  let px = PAD + dollarW + 2 * SCALE;
  for (const ch of digits) {
    if (ch === ",") {
      ctx.font = `700 ${sfs}px ${SG}`;
      ctx.fillStyle = "rgba(245,200,66,0.65)";
      ctx.fillText(ch, px, baseY - symYOffset);
      px += ctx.measureText(ch).width;
    } else {
      ctx.font = `900 ${dfs}px ${SG}`;
      ctx.fillStyle = "#F5C842";
      ctx.fillText(ch, px, baseY);
      px += ctx.measureText(ch).width;
    }
  }
  y += dfs + 14 * SCALE;

  // "SALE PRICE · USD"
  ctx.font = `600 ${fs(15)}px ${SG}`;
  ctx.fillStyle = SECONDARY;
  ctx.fillText("SALE PRICE · USD", PAD, y);
  y += 34 * SCALE;

  /* ── Divider ── */
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.lineWidth = 1 * SCALE;
  ctx.beginPath();
  ctx.moveTo(PAD, y);
  ctx.lineTo(LEFT_W - PAD, y);
  ctx.stroke();
  y += 32 * SCALE;

  /* ── Character name ── */
  ctx.font = `900 ${fs(36)}px ${SG}`;
  ctx.fillStyle = PRIMARY;
  const charText = truncate(ctx, character, TEXT_MAX);
  ctx.fillText(charText, PAD, y + 26 * SCALE);
  y += 46 * SCALE;

  /* ── Set name — full name, wrap to 2 lines ── */
  ctx.font = `600 ${fs(18)}px ${SG}`;
  ctx.fillStyle = SECONDARY;
  const setLines = wrapText(ctx, setName, TEXT_MAX, 2);
  for (const line of setLines) {
    ctx.fillText(line, PAD, y + 14 * SCALE);
    y += 24 * SCALE;
  }
  if (setLines.length === 1) y += 8 * SCALE;
  y += 8 * SCALE;

  /* ── Edition type badge ── */
  ctx.font = `800 ${fs(15)}px ${SG}`;
  const tierText = tierKey.toUpperCase();
  const tierTW = ctx.measureText(tierText).width;
  const badgeW = tierTW + 24 * SCALE;
  const badgeH = 30 * SCALE;
  roundRect(ctx, PAD, y, badgeW, badgeH, 13 * SCALE, tierStyle.bg, tierStyle.border);
  ctx.fillStyle = tierStyle.text;
  ctx.fillText(tierText, PAD + 12 * SCALE, y + 17 * SCALE);

  let badgeX = PAD + badgeW + 8 * SCALE;

  /* ── Chaser crown ── */
  if (isChaser) {
    const crownX = badgeX;
    const crownY = y + 4 * SCALE;
    const crownW = 18 * SCALE;
    const crownH = 14 * SCALE;
    ctx.fillStyle = "#FFD700";
    ctx.beginPath();
    ctx.moveTo(crownX, crownY + crownH);
    ctx.lineTo(crownX + crownW, crownY + crownH);
    ctx.lineTo(crownX + crownW, crownY + crownH - 4 * SCALE);
    ctx.lineTo(crownX, crownY + crownH - 4 * SCALE);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(crownX, crownY + crownH - 4 * SCALE);
    ctx.lineTo(crownX + 2 * SCALE, crownY);
    ctx.lineTo(crownX + crownW * 0.3, crownY + 5 * SCALE);
    ctx.lineTo(crownX + crownW / 2, crownY - 1 * SCALE);
    ctx.lineTo(crownX + crownW * 0.7, crownY + 5 * SCALE);
    ctx.lineTo(crownX + crownW - 2 * SCALE, crownY);
    ctx.lineTo(crownX + crownW, crownY + crownH - 4 * SCALE);
    ctx.closePath();
    ctx.fill();
    ctx.font = `800 ${fs(15)}px ${SG}`;
    ctx.fillStyle = "#FFD700";
    ctx.fillText("CHASER", crownX + crownW + 5 * SCALE, y + 17 * SCALE);
    const chaserTW = ctx.measureText("CHASER").width;
    badgeX += crownW + 5 * SCALE + chaserTW + 12 * SCALE;
  }

  /* ── Variant badge ── */
  if (variant) {
    ctx.font = `700 ${fs(14)}px ${SG}`;
    const varText = variant.toUpperCase();
    const varTW = ctx.measureText(varText).width;
    const varW = varTW + 20 * SCALE;
    if (badgeX + varW < LEFT_W - PAD) {
      roundRect(ctx, badgeX, y, varW, badgeH, 13 * SCALE, "rgba(255,255,255,0.10)", "rgba(255,255,255,0.25)");
      ctx.fillStyle = SECONDARY;
      ctx.fillText(varText, badgeX + 10 * SCALE, y + 17 * SCALE);
    }
  }

  y += badgeH + 28 * SCALE;

  /* ── Serial ── */
  if (serial != null) {
    ctx.font = `600 ${fs(16)}px ${SG}`;
    ctx.fillStyle = SECONDARY;
    const serialLabel = "Serial  ";
    ctx.fillText(serialLabel, PAD, y + 12 * SCALE);
    const prefW = ctx.measureText(serialLabel).width;

    ctx.font = `800 ${fs(16)}px ${SG}`;
    ctx.fillStyle = PRIMARY;
    const serialNum = `#${serial}`;
    ctx.fillText(serialNum, PAD + prefW, y + 12 * SCALE);
    const numW = ctx.measureText(serialNum).width;

    if (maxMint) {
      ctx.font = `600 ${fs(16)}px ${SG}`;
      ctx.fillStyle = SECONDARY;
      ctx.fillText(`  of ${maxMint}`, PAD + prefW + numW, y + 12 * SCALE);
    }
    y += 36 * SCALE;
  }

  y += 18 * SCALE;

  /* ── Divider ── */
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.lineWidth = 1 * SCALE;
  ctx.beginPath();
  ctx.moveTo(PAD, y);
  ctx.lineTo(LEFT_W - PAD, y);
  ctx.stroke();
  y += 30 * SCALE;

  /* ── Seller / Buyer ── */
  ctx.font = `600 ${fs(15)}px ${SG}`;
  ctx.fillStyle = TERTIARY;
  ctx.fillText("SELLER", PAD, y + 8 * SCALE);
  ctx.font = `700 ${fs(16)}px ${SG}`;
  ctx.fillStyle = PRIMARY;
  ctx.fillText(truncate(ctx, seller, TEXT_MAX), PAD, y + 28 * SCALE);
  y += 48 * SCALE;

  ctx.font = `600 ${fs(15)}px ${SG}`;
  ctx.fillStyle = TERTIARY;
  ctx.fillText("BUYER", PAD, y + 8 * SCALE);
  ctx.font = `700 ${fs(16)}px ${SG}`;
  ctx.fillStyle = PRIMARY;
  ctx.fillText(truncate(ctx, buyer, TEXT_MAX), PAD, y + 28 * SCALE);

  /* ── Bottom: Vaultopolis logo ── */
  const logo = await getLogo();
  if (logo) {
    const logoH = 24 * SCALE;
    const logoW = logoH * (logo.width / logo.height);
    ctx.globalAlpha = 0.7;
    ctx.drawImage(logo, PAD, H - logoH - 24 * SCALE, logoW, logoH);
    ctx.globalAlpha = 1.0;
  }

  return canvas.toBuffer("image/png");
}

module.exports = { renderSaleCard };
