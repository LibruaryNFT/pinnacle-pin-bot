"use strict";

/**
 * Layout 1 REFINED: Image on top, price-first info bar with gradient blend
 * - Price is the STAR (biggest text, gold, first thing you see)
 * - Character name gets its own full-width line (never truncates)
 * - Gradient fade from image into info bar (no hard line)
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
  const W = 720 * SCALE;           // 1440px wide
  const INFO_H = 240 * SCALE;      // 480px info bar — room for big price + name + metadata + breathing
  const IMG_H = 480 * SCALE;       // 960px for image area
  const FADE_H = 150 * SCALE;      // tall gradient blend (Opus recommendation)
  const H = IMG_H + INFO_H;        // 1400px total
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

  /* ── NFT image (aspect-fit + blurred background for narrow pins) ── */
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

      // Pin image
      ctx.drawImage(nftImg, imgX, imgY, drawW, drawH);
    } catch {}
  }

  /* ── Gradient fade: image blends into info bar (no hard line) ── */
  const fadeGrad = ctx.createLinearGradient(0, IMG_H - FADE_H, 0, IMG_H);
  fadeGrad.addColorStop(0, "rgba(11,13,26,0)");      // transparent
  fadeGrad.addColorStop(1, INFO_BG);                   // matches info bar
  ctx.fillStyle = fadeGrad;
  ctx.fillRect(0, IMG_H - FADE_H, W, FADE_H);

  /* ── Info bar background ── */
  ctx.fillStyle = INFO_BG;
  ctx.fillRect(0, IMG_H, W, INFO_H);

  /* ══════════════════════════════════════════════════
     INFO BAR — Price is the STAR
     ══════════════════════════════════════════════════ */

  let y = IMG_H + 4 * SCALE;

  /* ── Row 1: BIG PRICE (the star — 96px, no label) ── */
  const rounded = Math.round(usd);
  const priceStr = `$${rounded.toLocaleString()}`;

  let priceFontSize = fs(96);
  ctx.font = `900 ${priceFontSize}px ${SG}`;
  while (priceFontSize > fs(50) && ctx.measureText(priceStr).width > W - PAD * 2) {
    priceFontSize -= 4 * SCALE;
    ctx.font = `900 ${priceFontSize}px ${SG}`;
  }

  ctx.fillStyle = "#F5C842";
  ctx.fillText(priceStr, PAD, y + priceFontSize * 0.8);

  y += priceFontSize * 0.85 + 10 * SCALE;

  /* ── Row 2: Character name (full width, never truncates) ── */
  ctx.font = `900 ${fs(44)}px ${SG}`;
  ctx.fillStyle = PRIMARY;
  let nameFontSize = fs(44);
  const nameMaxW = W - PAD * 2;
  while (nameFontSize > fs(20) && ctx.measureText(character).width > nameMaxW) {
    nameFontSize -= 2 * SCALE;
    ctx.font = `900 ${nameFontSize}px ${SG}`;
  }
  ctx.fillText(character, PAD, y + nameFontSize * 0.8);

  y += nameFontSize + 14 * SCALE;

  /* ── Row 3: Set name + Edition badge + Serial ── */
  let x = PAD;

  ctx.font = `600 ${fs(17)}px ${SG}`;
  ctx.fillStyle = SECONDARY;
  ctx.fillText(setName, x, y + 14 * SCALE);
  x += ctx.measureText(setName).width + 14 * SCALE;

  ctx.fillStyle = TERTIARY;
  ctx.fillText("·", x, y + 14 * SCALE);
  x += ctx.measureText("·").width + 14 * SCALE;

  // Edition badge
  ctx.font = `800 ${fs(13)}px ${SG}`;
  const tierText = tierKey.toUpperCase();
  const tierTW = ctx.measureText(tierText).width;
  const badgeW = tierTW + 18 * SCALE;
  const badgeH = 24 * SCALE;
  roundRect(ctx, x, y + 1 * SCALE, badgeW, badgeH, 10 * SCALE, tierStyle.bg, tierStyle.border);
  ctx.fillStyle = tierStyle.text;
  ctx.fillText(tierText, x + 9 * SCALE, y + 15 * SCALE);
  x += badgeW + 14 * SCALE;

  // Chaser
  if (isChaser) {
    ctx.font = `800 ${fs(13)}px ${SG}`;
    ctx.fillStyle = "#FFD700";
    ctx.fillText("★ CHASER", x, y + 15 * SCALE);
    x += ctx.measureText("★ CHASER").width + 14 * SCALE;
  }

  // Variant
  if (variant) {
    ctx.font = `700 ${fs(12)}px ${SG}`;
    const varText = variant.toUpperCase();
    const varTW = ctx.measureText(varText).width;
    const varW = varTW + 16 * SCALE;
    roundRect(ctx, x, y + 1 * SCALE, varW, badgeH, 10 * SCALE, "rgba(255,255,255,0.10)", "rgba(255,255,255,0.25)");
    ctx.fillStyle = SECONDARY;
    ctx.fillText(varText, x + 8 * SCALE, y + 15 * SCALE);
    x += varW + 14 * SCALE;
  }

  // Serial
  if (serial != null) {
    ctx.fillStyle = TERTIARY;
    ctx.font = `600 ${fs(15)}px ${SG}`;
    ctx.fillText("·", x, y + 14 * SCALE);
    x += ctx.measureText("·").width + 14 * SCALE;

    ctx.font = `700 ${fs(15)}px ${SG}`;
    ctx.fillStyle = PRIMARY;
    ctx.fillText(`#${serial}`, x, y + 14 * SCALE);
    x += ctx.measureText(`#${serial}`).width;
    if (maxMint) {
      ctx.font = `600 ${fs(15)}px ${SG}`;
      ctx.fillStyle = SECONDARY;
      ctx.fillText(` of ${maxMint}`, x, y + 14 * SCALE);
    }
  }

  y += 38 * SCALE;

  /* ── Row 4: Seller → Buyer + Logo ── */
  ctx.font = `600 ${fs(14)}px ${SG}`;
  ctx.fillStyle = TERTIARY;
  ctx.fillText(`${seller}  →  ${buyer}`, PAD, y + 10 * SCALE);

  // Logo (bottom right)
  const logo = await getLogo();
  if (logo) {
    const logoH = 22 * SCALE;
    const logoW = logoH * (logo.width / logo.height);
    ctx.globalAlpha = 0.5;
    ctx.drawImage(logo, W - logoW - PAD, H - logoH - 16 * SCALE, logoW, logoH);
    ctx.globalAlpha = 1.0;
  }

  return canvas.toBuffer("image/png");
}

module.exports = { renderSaleCard };
