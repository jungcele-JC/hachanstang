// MOCK — B가 진짜 구현으로 교체합니다. export 이름과 시그니처는 contract.js와 동일하게 유지.
import { todayStr } from "./contract.js";

const SAMPLES = [
  { title: "과일 구조대",   description: "비타민 한 명을 무사히 구출했습니다.",      category: "food",    icon: "🍎", rarity: "common" },
  { title: "디지털 청소부", description: "저장공간 3MB가 자유를 되찾았습니다.",       category: "digital", icon: "🧹", rarity: "rare" },
  { title: "이불 조련사",   description: "아침의 야수를 네 귀퉁이로 제압했습니다.",   category: "clean",   icon: "🛏️", rarity: "common" },
  { title: "동네 순찰대",   description: "반경 300m의 평화를 직접 확인했습니다.",    category: "move",    icon: "🚶", rarity: "epic" },
];
const PALETTE = {
  food:    { bg: "#FFF1E6", fg: "#5A2E0C", accent: "#F28C28" },
  digital: { bg: "#E8F0FE", fg: "#102A5C", accent: "#3B6FE0" },
  clean:   { bg: "#EAF7EE", fg: "#0F4A2A", accent: "#3DAA6A" },
  move:    { bg: "#FDE8EC", fg: "#5A0F1F", accent: "#E0485E" },
};

export function generateBadge(deed, date = todayStr(), category) {
  const h = [...(deed + date)].reduce((a, c) => a + c.codePointAt(0), 0);
  const pool = SAMPLES.filter((x) => x.category === category);
  const s = pool.length ? pool[h % pool.length] : SAMPLES[h % SAMPLES.length];
  return { id: crypto.randomUUID(), date, deed, ...s, palette: PALETTE[s.category], createdAt: new Date().toISOString() };
}

export function renderBadgeSVG(b, size = 240) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" width="${size}" height="${size}">
  <circle cx="120" cy="120" r="104" fill="${b.palette.bg}" stroke="${b.palette.accent}" stroke-width="10"/>
  <text x="120" y="118" text-anchor="middle" font-size="64">${b.icon}</text>
  <text x="120" y="176" text-anchor="middle" font-size="22" font-weight="700" fill="${b.palette.fg}" font-family="system-ui, sans-serif">${b.title}</text>
</svg>`;
}
