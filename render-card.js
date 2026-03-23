"use strict";

/**
 * Layout 1 — "Price-Hero Refined"
 *
 * Changes from current:
 *  - Info bar: 480px → 380px (more image real estate)
 *  - Price: 96px → 80px (still dominant, less crushing)
 *  - Name: 44px → 40px (proportional)
 *  - Better vertical breathing room between sections
 *  - Set name: 15px tertiary (de-emphasized — it's context, not selling point)
 *  - Badges + serial on one clean line
 *  - Seller → buyer smaller, tertiary
 *  - No logo
 */

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
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
  if (fill)   { ctx.fillStyle = fill;   ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1.5; ctx.stroke(); }
}

function truncate(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 0 && ctx.measureText(t + "…").width > maxWidth) t = t.slice(0, -1);
  return t + "…";
}

let _logoImg = null;
async function getLogo() {
  if (_logoImg) return _logoImg;
  try {
    _logoImg = await loadImage(path.join(__dirname, "assets", "vaultopolis-full-logo.png"));
  } catch {}
  return _logoImg;
}

async function renderSaleCard({
  usd, character, setName, serial, maxMint, editionType,
  seller, buyer, nftBuffer, isChaser, variant,
}) {
  const SCALE = 2;
  const W = 720 * SCALE;                // 1440px wide
  const INFO_H = 190 * SCALE;           // 380px — tighter info bar (was 480px)
  const IMG_H = 530 * SCALE;            // 1060px — more image (was 960px)
  const FADE_H = 150 * SCALE;
  const H = IMG_H + INFO_H;             // 1440px total (square)
  const PAD = 28 * SCALE;

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");
  const fs = (size) => size * SCALE;

  const PRIMARY   = "#ffffff";
  const SECONDARY = "#C0C8D4";
  const TERTIARY  = "#8A94A0";

  const tierKey = editionType || "Open";
  const tierStyle = TIER[tierKey] || TIER.Open;

  const INFO_BG = "#0B0D1A";

  /* ── Full background ── */
  ctx.fillStyle = "#08080F";
  ctx.fillRect(0, 0, W, H);

  /* ── Image area background ── */
  const imgBg = ctx.createLinearGradient(0, 0, W, IMG_H);
  imgBg.addColorStop(0, "#0E0E1C");
  imgBg.addColorStop(1, "#0A0A14");
  ctx.fillStyle = imgBg;
  ctx.fillRect(0, 0, W, IMG_H);

  /* ── Subtle tier glow behind image ── */
  const gCX = W / 2, gCY = IMG_H / 2;
  const radGlow = ctx.createRadialGradient(gCX, gCY, 0, gCX, gCY, 350 * SCALE);
  radGlow.addColorStop(0, tierStyle.bg.replace(/[\d.]+\)$/, "0.15)"));
  radGlow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = radGlow;
  ctx.fillRect(0, 0, W, IMG_H);

  /* ── NFT image (aspect-fit) ── */
  if (nftBuffer) {
    try {
      const nftImg = await loadImage(nftBuffer);
      const pad = 16 * SCALE;
      const boxW = W - pad * 2;
      const boxH = IMG_H - pad * 2;
      const scale = Math.min(boxW / nftImg.width, boxH / nftImg.height);
      const drawW = Math.floor(nftImg.width * scale);
      const drawH = Math.floor(nftImg.height * scale);
      const imgX = Math.floor((W - drawW) / 2);
      const imgY = Math.floor((IMG_H - drawH) / 2);
      ctx.drawImage(nftImg, imgX, imgY, drawW, drawH);
    } catch {}
  }

  /* ── Gradient fade into info bar ── */
  const fadeGrad = ctx.createLinearGradient(0, IMG_H - FADE_H, 0, IMG_H);
  fadeGrad.addColorStop(0, "rgba(11,13,26,0)");
  fadeGrad.addColorStop(1, INFO_BG);
  ctx.fillStyle = fadeGrad;
  ctx.fillRect(0, IMG_H - FADE_H, W, FADE_H);

  /* ── Info bar background ── */
  ctx.fillStyle = INFO_BG;
  ctx.fillRect(0, IMG_H, W, INFO_H);

  /* ══════════════════════════════════════════════════
     INFO BAR — Price-Hero Refined
     ══════════════════════════════════════════════════ */

  let y = IMG_H + 6 * SCALE;

  /* ── Row 1: Price (80px — still the star, less crushing) ── */
  const rounded = Math.round(usd);
  const priceStr = `$${rounded.toLocaleString()}`;

  let priceFontSize = fs(80);
  ctx.font = `900 ${priceFontSize}px ${SG}`;
  while (priceFontSize > fs(44) && ctx.measureText(priceStr).width > W - PAD * 2) {
    priceFontSize -= 4 * SCALE;
    ctx.font = `900 ${priceFontSize}px ${SG}`;
  }

  ctx.fillStyle = "#F5C842";
  ctx.fillText(priceStr, PAD, y + priceFontSize * 0.8);

  y += priceFontSize * 0.85 + 16 * SCALE;   // ← more breathing room after price

  /* ── Row 2: Character name (40px) ── */
  let nameFontSize = fs(40);
  ctx.font = `900 ${nameFontSize}px ${SG}`;
  ctx.fillStyle = PRIMARY;
  const nameMaxW = W - PAD * 2;
  while (nameFontSize > fs(20) && ctx.measureText(character).width > nameMaxW) {
    nameFontSize -= 2 * SCALE;
    ctx.font = `900 ${nameFontSize}px ${SG}`;
  }
  ctx.fillText(character, PAD, y + nameFontSize * 0.8);

  y += nameFontSize + 8 * SCALE;

  /* ── Row 3: Set name (de-emphasized — tertiary, 14px) ── */
  ctx.font = `500 ${fs(14)}px ${SG}`;
  ctx.fillStyle = TERTIARY;
  ctx.fillText(truncate(ctx, setName, W - PAD * 2), PAD, y + 12 * SCALE);

  y += 28 * SCALE;

  /* ── Row 4: Badges + Serial (clean single line) ── */
  const GAP = 12 * SCALE;
  let x = PAD;

  // Edition badge
  ctx.font = `800 ${fs(12)}px ${SG}`;
  const tierText = tierKey.toUpperCase();
  const tierTW = ctx.measureText(tierText).width;
  const badgeW = tierTW + 16 * SCALE;
  const badgeH = 22 * SCALE;
  roundRect(ctx, x, y, badgeW, badgeH, 9 * SCALE, tierStyle.bg, tierStyle.border);
  ctx.fillStyle = tierStyle.text;
  ctx.fillText(tierText, x + 8 * SCALE, y + 13 * SCALE);
  x += badgeW + GAP;

  // Chaser
  if (isChaser) {
    ctx.font = `800 ${fs(12)}px ${SG}`;
    ctx.fillStyle = "#FFD700";
    ctx.fillText("★ CHASER", x, y + 13 * SCALE);
    x += ctx.measureText("★ CHASER").width + GAP;
  }

  // Variant badge
  if (variant) {
    ctx.font = `700 ${fs(11)}px ${SG}`;
    const varText = variant.toUpperCase();
    const varTW = ctx.measureText(varText).width;
    const varW = varTW + 14 * SCALE;
    roundRect(ctx, x, y, varW, badgeH, 9 * SCALE, "rgba(255,255,255,0.08)", "rgba(255,255,255,0.20)");
    ctx.fillStyle = SECONDARY;
    ctx.fillText(varText, x + 7 * SCALE, y + 13 * SCALE);
    x += varW + GAP;
  }

  // Serial
  if (serial != null) {
    ctx.fillStyle = TERTIARY;
    ctx.font = `500 ${fs(14)}px ${SG}`;
    ctx.fillText("·", x, y + 12 * SCALE);
    x += ctx.measureText("·").width + GAP;

    ctx.font = `700 ${fs(14)}px ${SG}`;
    ctx.fillStyle = PRIMARY;
    ctx.fillText(`#${serial}`, x, y + 12 * SCALE);
    x += ctx.measureText(`#${serial}`).width;
    if (maxMint) {
      ctx.font = `500 ${fs(14)}px ${SG}`;
      ctx.fillStyle = TERTIARY;
      ctx.fillText(` of ${maxMint}`, x, y + 12 * SCALE);
    }
  }

  y += 32 * SCALE;

  /* ── Row 5: Seller → Buyer (small, quiet) ── */
  ctx.font = `500 ${fs(13)}px ${SG}`;
  ctx.fillStyle = TERTIARY;
  const transferText = truncate(ctx, `${seller}  →  ${buyer}`, W - PAD * 2);
  ctx.fillText(transferText, PAD, y + 10 * SCALE);

  return canvas.toBuffer("image/png");
}

module.exports = { renderSaleCard };
