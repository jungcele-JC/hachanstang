// js/share.js — C 담당. 뱃지 1개를 1080x1080 공유 카드 PNG로.
// export 이름과 시그니처는 js/contract.js 규격을 따른다.
import { renderBadgeSVG } from "./badge-engine.js";
import { RARITY_LABEL } from "./contract.js";

const SIZE = 1080;
const MEDAL = 720;
const FONT = '"Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", system-ui, sans-serif';
const EMOJI = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';

export async function badgeToPNG(badge) {
  const canvas = document.createElement("canvas");
  canvas.width = SIZE; canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  const { bg, fg, accent } = badge.palette;

  // 배경: palette.bg 위에 은은한 원 두 개
  ctx.fillStyle = bg; ctx.fillRect(0, 0, SIZE, SIZE);
  ctx.globalAlpha = 0.08; ctx.fillStyle = accent;
  ctx.beginPath(); ctx.arc(SIZE * 0.85, SIZE * 0.12, 260, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(SIZE * 0.12, SIZE * 0.92, 200, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;

  // 메달: SVG → Image → drawImage. 실패하면 캔버스로 직접 그림.
  const medalX = (SIZE - MEDAL) / 2, medalY = 70;
  try {
    const img = await svgToImage(renderBadgeSVG(badge, MEDAL));
    ctx.drawImage(img, medalX, medalY, MEDAL, MEDAL);
  } catch (err) {
    console.warn("[하찮상 share] SVG 변환 실패, 기본 메달로 대체합니다.", err);
    drawFallbackMedal(ctx, badge, medalX, medalY, MEDAL);
  }

  // 글: 제목 / 수여 문구 / 희귀도·날짜
  ctx.textAlign = "center"; ctx.textBaseline = "alphabetic"; ctx.fillStyle = fg;
  ctx.font = `700 64px ${FONT}`;
  fitText(ctx, badge.title, SIZE - 160, 64, 40);
  ctx.fillText(badge.title, SIZE / 2, 870);

  ctx.font = `400 34px ${FONT}`;
  const lines = wrapText(ctx, badge.description, SIZE - 200).slice(0, 2);
  lines.forEach((line, i) => ctx.fillText(line, SIZE / 2, 930 + i * 46));

  ctx.globalAlpha = 0.75; ctx.font = `500 26px ${FONT}`;
  ctx.fillText(`${RARITY_LABEL[badge.rarity] ?? badge.rarity} · ${badge.date}`, SIZE / 2, 1030);

  // 워터마크
  ctx.globalAlpha = 0.6; ctx.textAlign = "right"; ctx.font = `700 24px ${FONT}`;
  ctx.fillText("하찮상", SIZE - 40, SIZE - 32);
  ctx.globalAlpha = 1;

  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("toBlob 실패"))), "image/png"));
}

// ---------------------------------------------------------------- 내부

function svgToImage(svg) {
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  return new Promise((resolve, reject) => {
    const img = new Image();
    const done = (fn) => (e) => { URL.revokeObjectURL(url); fn(e); };
    img.onload = done(() => resolve(img));
    img.onerror = done(() => reject(new Error("SVG 이미지 로드 실패")));
    img.src = url;
  });
}

function drawFallbackMedal(ctx, badge, x, y, size) {
  const cx = x + size / 2, cy = y + size / 2, r = size * 0.42;
  ctx.save();
  ctx.fillStyle = badge.palette.accent;
  ctx.beginPath(); ctx.arc(cx, cy, r + 14, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.font = `${Math.round(size * 0.36)}px ${EMOJI}`;
  ctx.fillText(badge.icon, cx, cy + size * 0.02);
  ctx.restore();
}

/** 글자가 maxWidth를 넘으면 폰트 크기를 min까지 줄인다. ctx.font를 바꿔 둔다. */
function fitText(ctx, text, maxWidth, startPx, minPx) {
  let px = startPx;
  const weight = ctx.font.split(" ")[0];
  while (px > minPx && ctx.measureText(text).width > maxWidth) {
    px -= 2; ctx.font = `${weight} ${px}px ${FONT}`;
  }
}

/** 공백 기준 줄바꿈. 공백이 없는 긴 글은 글자 단위로 자른다. */
function wrapText(ctx, text, maxWidth) {
  const lines = []; let line = "";
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth) { line = next; continue; }
    if (line) lines.push(line);
    line = word;
    while (ctx.measureText(line).width > maxWidth && line.length > 1) {
      let cut = line.length;
      while (cut > 1 && ctx.measureText(line.slice(0, cut)).width > maxWidth) cut--;
      lines.push(line.slice(0, cut)); line = line.slice(cut);
    }
  }
  if (line) lines.push(line);
  return lines;
}
