"use strict";

const { createCanvas, loadImage, registerFont } = require("canvas");
const path = require("path");

/* ── Fonts ───────────────────────────────────────────────── */
try {
  registerFont(path.join(__dirname, "fonts", "SpaceGrotesk.ttf"), {
    family: "SpaceGrotesk",
  });
} catch {
  // Falls back to system sans-serif
}

const SG = '"SpaceGrotesk", sans-serif';

/* ── Tier colours ────────────────────────────────────────── */
const TIER = {
  Genesis:      { bg: "rgba(236,72,153,0.22)",  border: "rgba(236,72,153,0.5)",   text: "#F472B6" },
  Legendary:    { bg: "rgba(251,191,36,0.22)",  border: "rgba(251,191,36,0.5)",   text: "#FBBF24" },
  "Ltd Event":  { bg: "rgba(34,211,238,0.20)",  border: "rgba(34,211,238,0.45)",  text: "#22D3EE" },
  "Open Event": { bg: "rgba(20,184,166,0.20)",  border: "rgba(20,184,166,0.45)",  text: "#2DD4BF" },
  Limited:      { bg: "rgba(99,102,241,0.22)",  border: "rgba(99,102,241,0.5)",   text: "#818CF8" },
  Open:         { bg: "rgba(168,85,247,0.22)",  border: "rgba(168,85,247,0.5)",   text: "#C084FC" },
  Starter:      { bg: "rgba(96,165,250,0.22)",  border: "rgba(96,165,250,0.5)",   text: "#60A5FA" },
};

/* ── Helpers ─────────────────────────────────────────────── */
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

/** Truncate text to fit within maxWidth, adding "…" if needed */
function truncate(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 0 && ctx.measureText(t + "…").width > maxWidth) t = t.slice(0, -1);
  return t + "…";
}

/* ── Logo loader (cached) ────────────────────────────────── */
let _logoImg = null;
async function getLogo() {
  if (_logoImg) return _logoImg;
  try {
    _logoImg = await loadImage(path.join(__dirname, "assets", "vaultopolis-full-logo.png"));
  } catch { /* no logo available */ }
  return _logoImg;
}

/* ── Main renderer ───────────────────────────────────────── */
/**
 * @param {object} opts
 * @param {number}  opts.usd           Sale price in USD
 * @param {string}  opts.character     Character name
 * @param {string}  opts.setName       Full set name
 * @param {number|null} opts.serial    Serial number
 * @param {number|null} opts.maxMint   Max mint size
 * @param {string|null} opts.editionType  e.g. "Limited", "Legendary"
 * @param {string}  opts.seller        Seller display name
 * @param {string}  opts.buyer         Buyer display name
 * @param {Buffer}  opts.nftBuffer     Raw PNG buffer of the NFT
 * @param {boolean} opts.isChaser      Whether this is a chaser pin
 * @param {string|null} opts.variant   Variant name (e.g. "Digital Display")
 * @returns {Promise<Buffer>} PNG buffer of the 720×720 card
 */
async function renderSaleCard({
  usd, character, setName, serial, maxMint, editionType,
  seller, buyer, nftBuffer, isChaser, variant,
}) {
  const W = 720, H = 720;
  const LEFT_W = Math.floor(W * 0.34); // 245px — narrow left panel, max room for artwork
  const PAD = 24;
  const TEXT_MAX = LEFT_W - PAD * 2;

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  /* ── Background ── */
  // Left panel: dark gradient
  const leftGrad = ctx.createLinearGradient(0, 0, 0, H);
  leftGrad.addColorStop(0, "#0C0618");
  leftGrad.addColorStop(1, "#060D1A");
  ctx.fillStyle = leftGrad;
  ctx.fillRect(0, 0, LEFT_W, H);

  // Right panel: slightly lighter
  const rightGrad = ctx.createLinearGradient(LEFT_W, 0, W, H);
  rightGrad.addColorStop(0, "#0D0D18");
  rightGrad.addColorStop(1, "#08080F");
  ctx.fillStyle = rightGrad;
  ctx.fillRect(LEFT_W, 0, W - LEFT_W, H);

  /* ── Separator line ── */
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(LEFT_W, H * 0.06);
  ctx.lineTo(LEFT_W, H * 0.94);
  ctx.stroke();

  /* ── Right panel: subtle glow behind image ── */
  const tierKey = editionType || "Open";
  const tierStyle = TIER[tierKey] || TIER.Open;
  const gCX = LEFT_W + (W - LEFT_W) / 2;
  const gCY = H / 2;
  const radGlow = ctx.createRadialGradient(gCX, gCY, 0, gCX, gCY, 280);
  radGlow.addColorStop(0, tierStyle.bg.replace(/[\d.]+\)$/, "0.12)"));
  radGlow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = radGlow;
  ctx.fillRect(LEFT_W, 0, W - LEFT_W, H);

  /* ── NFT image (larger, centered in right panel) ── */
  if (nftBuffer) {
    try {
      const nftImg = await loadImage(nftBuffer);
      const rightW = W - LEFT_W;
      const imgSize = Math.min(440, rightW - 30);
      const imgX = LEFT_W + Math.floor((rightW - imgSize) / 2);
      const imgY = Math.floor((H - imgSize) / 2);
      ctx.drawImage(nftImg, imgX, imgY, imgSize, imgSize);
    } catch { /* image draw failed — card still renders */ }
  }

  /* ══════════════════════════════════════════════════════════
     LEFT PANEL TEXT
     ══════════════════════════════════════════════════════════ */

  let y = 44;

  /* ── "DISNEY PINNACLE" header ── */
  ctx.font = `800 20px ${SG}`;
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.fillText("DISNEY PINNACLE", PAD, y);
  y += 28;

  /* ── Price (hierarchical typography — big digits, smaller $/, ) ── */
  const rounded = Math.round(usd);
  const digits = rounded.toLocaleString();   // e.g. "12,500"

  // Pre-measure at full size to see if it fits
  let dfs = 72;  // digit font size
  let sfs = 40;  // symbol font size ($ and ,)
  function measurePrice(df, sf) {
    ctx.font = `800 ${sf}px ${SG}`;
    let w = ctx.measureText("$").width + 2;
    for (const ch of digits) {
      if (ch === ",") { ctx.font = `700 ${sf}px ${SG}`; }
      else            { ctx.font = `900 ${df}px ${SG}`; }
      w += ctx.measureText(ch).width;
    }
    return w;
  }
  // Scale down if needed (keeps ratio between digit/symbol sizes)
  while (dfs > 40 && measurePrice(dfs, sfs) > TEXT_MAX) {
    dfs -= 4;
    sfs = Math.round(dfs * 0.55);
  }

  const baseY = y + dfs * 0.85;
  const symYOffset = (dfs - sfs) * 0.35;

  // Draw "$" smaller, aligned to middle of digits
  ctx.font = `800 ${sfs}px ${SG}`;
  ctx.fillStyle = "rgba(245,200,66,0.7)";
  const dollarW = ctx.measureText("$").width;
  ctx.fillText("$", PAD, baseY - symYOffset);

  // Draw digits: numbers big & bold gold, commas small & faded
  let px = PAD + dollarW + 2;
  for (const ch of digits) {
    if (ch === ",") {
      ctx.font = `700 ${sfs}px ${SG}`;
      ctx.fillStyle = "rgba(245,200,66,0.5)";
      ctx.fillText(ch, px, baseY - symYOffset);
      px += ctx.measureText(ch).width;
    } else {
      ctx.font = `900 ${dfs}px ${SG}`;
      ctx.fillStyle = "#F5C842";
      ctx.fillText(ch, px, baseY);
      px += ctx.measureText(ch).width;
    }
  }
  y += dfs + 10;

  // "SALE PRICE · USD"
  ctx.font = `600 13px ${SG}`;
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.fillText("SALE PRICE · USD", PAD, y);
  y += 20;

  /* ── Divider ── */
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD, y);
  ctx.lineTo(LEFT_W - PAD, y);
  ctx.stroke();
  y += 20;

  /* ── Character name ── */
  ctx.font = `900 32px ${SG}`;
  ctx.fillStyle = "#ffffff";
  const charText = truncate(ctx, character, TEXT_MAX);
  ctx.fillText(charText, PAD, y + 26);
  y += 38;

  /* ── Set name ── */
  const shortSet = setName.includes("•") ? setName.split("•")[1].trim() : setName;
  ctx.font = `500 14px ${SG}`;
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.fillText(truncate(ctx, shortSet, TEXT_MAX), PAD, y + 12);
  y += 22;

  /* ── Edition type badge ── */
  ctx.font = `800 11px ${SG}`;
  const tierText = tierKey.toUpperCase();
  const tierTW = ctx.measureText(tierText).width;
  const badgeW = tierTW + 24;
  const badgeH = 26;
  roundRect(ctx, PAD, y, badgeW, badgeH, 13, tierStyle.bg, tierStyle.border);
  ctx.fillStyle = tierStyle.text;
  ctx.fillText(tierText, PAD + 12, y + 17);

  let badgeX = PAD + badgeW + 8;

  /* ── Chaser crown icon ── */
  if (isChaser) {
    const crownX = badgeX;
    const crownY = y + 4;
    const crownW = 18;
    const crownH = 14;
    ctx.fillStyle = "#FFD700";
    ctx.beginPath();
    // Crown base
    ctx.moveTo(crownX, crownY + crownH);
    ctx.lineTo(crownX + crownW, crownY + crownH);
    ctx.lineTo(crownX + crownW, crownY + crownH - 4);
    ctx.lineTo(crownX, crownY + crownH - 4);
    ctx.closePath();
    ctx.fill();
    // Crown points
    ctx.beginPath();
    ctx.moveTo(crownX, crownY + crownH - 4);
    ctx.lineTo(crownX + 2, crownY);
    ctx.lineTo(crownX + crownW * 0.3, crownY + 5);
    ctx.lineTo(crownX + crownW / 2, crownY - 1);
    ctx.lineTo(crownX + crownW * 0.7, crownY + 5);
    ctx.lineTo(crownX + crownW - 2, crownY);
    ctx.lineTo(crownX + crownW, crownY + crownH - 4);
    ctx.closePath();
    ctx.fill();
    // "CHASER" text next to crown
    ctx.font = `800 11px ${SG}`;
    ctx.fillStyle = "#FFD700";
    ctx.fillText("CHASER", crownX + crownW + 5, y + 17);
    const chaserTW = ctx.measureText("CHASER").width;
    badgeX += crownW + 5 + chaserTW + 12;
  }

  /* ── Variant badge (e.g. "Digital Display") ── */
  if (variant) {
    ctx.font = `700 10px ${SG}`;
    const varText = variant.toUpperCase();
    const varTW = ctx.measureText(varText).width;
    const varW = varTW + 20;
    if (badgeX + varW < LEFT_W - PAD) {
      roundRect(ctx, badgeX, y, varW, badgeH, 13, "rgba(255,255,255,0.06)", "rgba(255,255,255,0.15)");
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.fillText(varText, badgeX + 10, y + 17);
    }
  }

  y += badgeH + 16;

  /* ── Serial ── */
  if (serial != null) {
    ctx.font = `600 14px ${SG}`;
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    const serialLabel = "Serial  ";
    ctx.fillText(serialLabel, PAD, y + 12);
    const prefW = ctx.measureText(serialLabel).width;

    ctx.font = `800 14px ${SG}`;
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    const serialNum = `#${serial}`;
    ctx.fillText(serialNum, PAD + prefW, y + 12);
    const numW = ctx.measureText(serialNum).width;

    if (maxMint) {
      ctx.font = `600 14px ${SG}`;
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.fillText(`  of ${maxMint}`, PAD + prefW + numW, y + 12);
    }
    y += 24;
  }

  y += 10;

  /* ── Divider ── */
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD, y);
  ctx.lineTo(LEFT_W - PAD, y);
  ctx.stroke();
  y += 18;

  /* ── Seller / Buyer — clear labels ── */
  ctx.font = `600 11px ${SG}`;
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.fillText("SELLER", PAD, y + 8);
  ctx.font = `700 13px ${SG}`;
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fillText(truncate(ctx, seller, TEXT_MAX), PAD, y + 24);
  y += 36;

  ctx.font = `600 11px ${SG}`;
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.fillText("BUYER", PAD, y + 8);
  ctx.font = `700 13px ${SG}`;
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fillText(truncate(ctx, buyer, TEXT_MAX), PAD, y + 24);

  /* ── Bottom: Vaultopolis full logo ── */
  const logo = await getLogo();
  if (logo) {
    const logoH = 24;
    const logoW = logoH * (logo.width / logo.height);
    ctx.globalAlpha = 0.45;
    ctx.drawImage(logo, PAD, H - logoH - 14, logoW, logoH);
    ctx.globalAlpha = 1.0;
  }

  return canvas.toBuffer("image/png");
}

module.exports = { renderSaleCard };
