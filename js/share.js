// MOCK — C가 진짜 공유 카드(1080x1080, 제목/날짜/로고 포함)로 교체합니다.
import { renderBadgeSVG } from "./badge-engine.js";

export async function badgeToPNG(badge) {
  const svg = renderBadgeSVG(badge, 1080);
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  const img = new Image();
  await new Promise((ok, no) => { img.onload = ok; img.onerror = no; img.src = url; });
  const canvas = Object.assign(document.createElement("canvas"), { width: 1080, height: 1080 });
  canvas.getContext("2d").drawImage(img, 0, 0);
  URL.revokeObjectURL(url);
  return new Promise((ok) => canvas.toBlob(ok, "image/png"));
}
