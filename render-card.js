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
  Genesis:      { bg: "rgba(236,72,153,0.18)",  border: "rgba(236,72,153,0.35)",  text: "#F472B6" },
  Legendary:    { bg: "rgba(251,191,36,0.18)",  border: "rgba(251,191,36,0.35)",  text: "#FBBF24" },
  "Ltd Event":  { bg: "rgba(34,211,238,0.15)",  border: "rgba(34,211,238,0.3)",   text: "#22D3EE" },
  "Open Event": { bg: "rgba(20,184,166,0.15)",  border: "rgba(20,184,166,0.3)",   text: "#2DD4BF" },
  Limited:      { bg: "rgba(99,102,241,0.18)",  border: "rgba(99,102,241,0.35)",  text: "#818CF8" },
  Open:         { bg: "rgba(168,85,247,0.18)",  border: "rgba(168,85,247,0.35)", text: "#C084FC" },
  Starter:      { bg: "rgba(96,165,250,0.18)",  border: "rgba(96,165,250,0.35)",  text: "#60A5FA" },
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
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
}

/* ── Main renderer ───────────────────────────────────────── */
/**
 * @param {object} opts
 * @param {number}  opts.usd           Sale price in USD
 * @param {string}  opts.character     Character name e.g. "Joy"
 * @param {string}  opts.setName       Full set name e.g. "Pixar Animation Studios • Pixar Mosaics Vol.1"
 * @param {number|null} opts.serial    Serial number
 * @param {number|null} opts.maxMint   Max mint size
 * @param {string|null} opts.editionType  e.g. "Limited", "Legendary", "Open"
 * @param {string}  opts.seller        Seller display name
 * @param {string}  opts.buyer         Buyer display name
 * @param {Buffer}  opts.nftBuffer     Raw PNG buffer of the NFT (transparent bg)
 * @returns {Promise<Buffer>} PNG buffer of the 720×720 card
 */
async function renderSaleCard({ usd, character, setName, serial, maxMint, editionType, seller, buyer, nftBuffer }) {
  const W = 720, H = 720;
  const LEFT_W = Math.floor(W * 0.48); // 346px
  const PAD = 40;

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  /* ── Backgrounds ── */
  // Left panel: dark blue-purple gradient
  const leftGrad = ctx.createLinearGradient(0, 0, LEFT_W, H);
  leftGrad.addColorStop(0, "#0E0720");
  leftGrad.addColorStop(1, "#08101E");
  ctx.fillStyle = leftGrad;
  ctx.fillRect(0, 0, LEFT_W, H);

  // Right panel: near-black
  ctx.fillStyle = "#09090F";
  ctx.fillRect(LEFT_W, 0, W - LEFT_W, H);

  /* ── Separator ── */
  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(LEFT_W, H * 0.1);
  ctx.lineTo(LEFT_W, H * 0.9);
  ctx.stroke();

  /* ── Right panel: gold radial glow ── */
  const gCX = LEFT_W + (W - LEFT_W) / 2;
  const gCY = H / 2;
  const radGlow = ctx.createRadialGradient(gCX, gCY, 0, gCX, gCY, 260);
  radGlow.addColorStop(0, "rgba(245,200,66,0.10)");
  radGlow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = radGlow;
  ctx.fillRect(LEFT_W, 0, W - LEFT_W, H);

  /* ── NFT image ── */
  if (nftBuffer) {
    try {
      const nftImg = await loadImage(nftBuffer);
      const imgSize = 390;
      const imgX = LEFT_W + Math.floor((W - LEFT_W - imgSize) / 2);
      const imgY = Math.floor((H - imgSize) / 2);
      ctx.drawImage(nftImg, imgX, imgY, imgSize, imgSize);
    } catch { /* image draw failed — card still renders */ }
  }

  /* ── LEFT PANEL TEXT ── */

  // Platform label
  ctx.font = `bold 12px ${SG}`;
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  ctx.fillText("DISNEY PINNACLE", PAD, 58);

  // Price — huge gold
  ctx.font = `900 88px ${SG}`;
  ctx.fillStyle = "#F5C842";
  ctx.fillText(`$${Math.round(usd).toLocaleString()}`, PAD, 186);

  // "SALE PRICE · USD"
  ctx.font = `600 15px ${SG}`;
  ctx.fillStyle = "rgba(255,255,255,0.3)";
  ctx.fillText("SALE PRICE · USD", PAD, 214);

  // Edition type badge
  const tierKey = editionType || "Open";
  const tierStyle = TIER[tierKey] || TIER.Open;
  ctx.font = `800 11px ${SG}`;
  const tierText = tierKey.toUpperCase();
  const tierTW = ctx.measureText(tierText).width;
  const badgeW = tierTW + 28;
  const badgeH = 28;
  const badgeY = 450;
  roundRect(ctx, PAD, badgeY, badgeW, badgeH, 14, tierStyle.bg, tierStyle.border);
  ctx.fillStyle = tierStyle.text;
  ctx.fillText(tierText, PAD + 14, badgeY + 18);

  // Character name
  ctx.font = `900 38px ${SG}`;
  ctx.fillStyle = "#ffffff";
  ctx.fillText(character, PAD, 542);

  // Set name (strip studio prefix if present)
  const shortSet = setName.includes("•") ? setName.split("•")[1].trim() : setName;
  ctx.font = `500 16px ${SG}`;
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.fillText(shortSet, PAD, 570);

  // Serial
  if (serial != null) {
    const serialPrefix = "Serial  ";
    const serialNum = `#${serial}`;
    const serialSuffix = maxMint ? `  of ${maxMint}` : "";

    ctx.font = `600 16px ${SG}`;
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.fillText(serialPrefix, PAD, 598);
    const prefW = ctx.measureText(serialPrefix).width;

    ctx.font = `800 16px ${SG}`;
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fillText(serialNum, PAD + prefW, 598);
    const numW = ctx.measureText(serialNum).width;

    ctx.font = `600 16px ${SG}`;
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.fillText(serialSuffix, PAD + prefW + numW, 598);
  }

  // Seller → Buyer
  const arrow = "  →  ";
  ctx.font = `700 15px ${SG}`;
  ctx.fillStyle = "rgba(255,255,255,0.65)";
  ctx.fillText(seller, PAD, 628);
  const selW = ctx.measureText(seller).width;

  ctx.fillStyle = "rgba(255,255,255,0.2)";
  ctx.fillText(arrow, PAD + selW, 628);
  const arrW = ctx.measureText(arrow).width;

  ctx.fillStyle = "rgba(255,255,255,0.65)";
  ctx.fillText(buyer, PAD + selW + arrW, 628);

  // Vaultopolis wordmark (text fallback — replace with loadImage if SVG supported)
  ctx.font = `600 13px ${SG}`;
  ctx.fillStyle = "rgba(255,255,255,0.2)";
  ctx.fillText("vaultopolis.com", PAD, 672);

  return canvas.toBuffer("image/png");
}

module.exports = { renderSaleCard };
