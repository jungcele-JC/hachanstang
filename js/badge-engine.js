// 하찮상 뱃지 엔진 (B 담당)
// generateBadge: 입력 한 줄 → Badge (같은 deed+date면 항상 같은 제목·문구·희귀도)
// renderBadgeSVG: Badge → 메달 SVG 문자열
import { todayStr, RARITIES, RARITY_LABEL } from "./contract.js";
import { DICTIONARY, CATEGORY_CLUES, FALLBACKS, SPECIALS, PALETTES } from "./dictionary.js";

const RARITY_WEIGHTS = { common: 60, rare: 25, epic: 12, legendary: 3 };

// ------------------------------------------------------------
// 해시 (FNV-1a 32bit) — 결정적 선택용
// ------------------------------------------------------------
function hash(str) {
  let h = 0x811c9dc5;
  for (const ch of str) {
    h ^= ch.codePointAt(0);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
const pick = (arr, seed) => arr[hash(seed) % arr.length];

// ------------------------------------------------------------
// 정규화: 문장부호 제거 + 흔한 어미 제거 ("먹었어요/마셨음/지움/갬/잤다" → "먹/마시/지우/개/자")
// ------------------------------------------------------------
const ENDINGS = [
  "었습니다", "았습니다", "했습니다", "였습니다", "습니다",
  "었어요", "았어요", "였어요", "했어요", "어요", "아요", "해요",
  "었음", "았음", "였음", "었다", "았다", "였다", "었어", "았어", "였어",
  "하기", "하고", "하다", "했다", "했음", "했어",
  "었", "았", "였", "했", "함", "해", "한", "음", "다", "요", "기", "고",
].sort((a, b) => b.length - a.length);

// 받침 ㅆ으로 축약된 모음을 원래대로: 셨→시, 웠→우, 왔→오, 됐→되, 썼→쓰
const UNCONTRACT = { 6: 20, 14: 13, 9: 8, 10: 11, 4: 18 };

function stripEnding(tok) {
  for (const e of ENDINGS) {
    if (tok.length > e.length && tok.endsWith(e)) return tok.slice(0, -e.length);
  }
  return tok;
}

// 마지막 글자의 받침 ㅁ(명사형)·ㅆ(과거)을 떼어 어간으로
function relaxLast(tok) {
  const code = tok.charCodeAt(tok.length - 1) - 0xac00;
  if (code < 0 || code > 11171) return tok;
  const jong = code % 28;
  if (jong !== 16 && jong !== 20) return tok; // ㅁ, ㅆ
  const cho = Math.floor(code / 588);
  let jung = Math.floor(code / 28) % 21;
  if (jong === 20) jung = cho === 18 && jung === 1 ? 0 : (UNCONTRACT[jung] ?? jung); // 했→하
  return tok.slice(0, -1) + String.fromCharCode(0xac00 + cho * 588 + jung * 28);
}

function stem(tok) {
  let t = stripEnding(stripEnding(tok));
  t = relaxLast(t);
  return stripEnding(t);
}

function analyze(raw) {
  const cleaned = raw.normalize("NFC").toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").trim();
  const tokens = cleaned ? cleaned.split(/\s+/) : [];
  const stems = tokens.map(stem);
  return { tokens, stems, orig: tokens.join(""), stem: stems.join("") };
}

const has = (a, part) => a.orig.includes(part) || a.stem.includes(part);

// 사전 키워드를 미리 조각으로 나눠 둔다
const ENTRIES = DICTIONARY.map((entry) => ({
  entry,
  keywords: entry.keywords.map((kw) => {
    const parts = kw.toLowerCase().split(/\s+/).filter(Boolean);
    return { kw, parts, len: parts.join("").length };
  }),
}));

// 가장 긴 키워드로 맞은 항목을 찾는다. 같은 길이가 여럿이면 seed 해시로 하나를 고른다.
function findEntry(a, seed) {
  let bestLen = 0;
  let ties = [];
  for (const { entry, keywords } of ENTRIES) {
    let hit = null;
    for (const k of keywords) {
      if (k.len >= bestLen && (!hit || k.len > hit.len) && k.parts.every((p) => has(a, p))) hit = k;
    }
    if (!hit) continue;
    if (hit.len > bestLen) { bestLen = hit.len; ties = []; }
    if (hit.len === bestLen) ties.push({ entry, keyword: hit.kw });
  }
  return ties.length ? pick(ties, seed + "#entry") : null;
}

function guessCategory(a) {
  for (const [category, clues] of CATEGORY_CLUES) {
    for (const c of clues) {
      if (c.startsWith("=") ? a.stems.includes(c.slice(1)) : has(a, c)) return category;
    }
  }
  return "etc";
}

function firstEmoji(raw) {
  if (!/\p{Extended_Pictographic}/u.test(raw)) return null;
  if (typeof Intl !== "undefined" && Intl.Segmenter) {
    for (const { segment } of new Intl.Segmenter("ko", { granularity: "grapheme" }).segment(raw)) {
      if (/\p{Extended_Pictographic}/u.test(segment)) return segment;
    }
  }
  return raw.match(/\p{Extended_Pictographic}️?/u)[0];
}

/**
 * 입력이 어떻게 해석되는지 알려준다(테스트·사전 보강용).
 * @returns {{source:"dictionary"|"guess"|"empty"|"emoji"|"latin", keyword?:string, category:string, template:object}}
 */
export function matchDeed(deed, date = todayStr()) {
  const raw = typeof deed === "string" ? deed : String(deed ?? "");
  const a = analyze(raw);
  const found = findEntry(a, `${raw}|${date}`);
  if (found) return { source: "dictionary", keyword: found.keyword, category: found.entry.category, template: found.entry };

  if (!a.orig) {
    const emoji = firstEmoji(raw);
    if (emoji) return { source: "emoji", category: "etc", template: { ...SPECIALS.emoji, icon: emoji } };
    return { source: "empty", category: "etc", template: SPECIALS.empty };
  }
  const category = guessCategory(a);
  if (category === "etc" && /[a-z]/.test(a.orig) && !/[가-힣]/.test(a.orig)) {
    return { source: "latin", category: "etc", template: SPECIALS.latin };
  }
  return { source: "guess", category, template: FALLBACKS[category] };
}

function rollRarity(seed, minRarity) {
  let n = hash(seed + "#rarity") % 100;
  let rarity = "legendary";
  for (const r of RARITIES) {
    if (n < RARITY_WEIGHTS[r]) { rarity = r; break; }
    n -= RARITY_WEIGHTS[r];
  }
  if (minRarity && RARITIES.indexOf(minRarity) > RARITIES.indexOf(rarity)) rarity = minRarity;
  return rarity;
}

function uuid() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  const b = new Uint8Array(16);
  if (globalThis.crypto?.getRandomValues) crypto.getRandomValues(b);
  else for (let i = 0; i < 16; i++) b[i] = (Math.random() * 256) | 0;
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/**
 * @param {string} deed
 * @param {string} [date] "YYYY-MM-DD"
 * @returns {import("./contract.js").Badge}
 */
export function generateBadge(deed, date = todayStr()) {
  const raw = typeof deed === "string" ? deed : String(deed ?? "");
  const seed = `${raw}|${date}`;
  const { category, template: t } = matchDeed(raw, date);
  return {
    id: uuid(),
    date,
    deed: raw,
    title: t.title ?? pick(t.titles, seed + "#title"),
    description: pick(t.descriptions, seed + "#desc"),
    category,
    rarity: rollRarity(seed, t.minRarity),
    icon: t.icon ?? pick(t.icons, seed + "#icon"),
    palette: { ...PALETTES[category] },
    createdAt: new Date().toISOString(),
  };
}

// ------------------------------------------------------------
// SVG 메달
// ------------------------------------------------------------
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const FONT = `system-ui, -apple-system, "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif`;
const EMOJI_FONT = `"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
const CX = 120, CY = 100, R = 84;

// 리본 안 제목 글자 크기: 한글·이모지는 1칸, 영문·숫자는 0.6칸으로 셈
function titleFontSize(title) {
  let units = 0;
  for (const ch of title) units += /[\u0000-ɏ]/.test(ch) ? (ch === " " ? 0.35 : 0.6) : 1;
  return Math.max(9, Math.min(19, 168 / Math.max(units, 1)));
}

function starPoints(cx, cy, outer, inner, n, rot = -Math.PI / 2) {
  const pts = [];
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? inner : outer;
    const a = rot + (i * Math.PI) / n;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(" ");
}

function rim(rarity, p, gid) {
  switch (rarity) {
    case "rare":
      return `<circle cx="${CX}" cy="${CY}" r="${R}" fill="${p.bg}" stroke="${p.accent}" stroke-width="4"/>
  <circle cx="${CX}" cy="${CY}" r="${R - 9}" fill="none" stroke="${p.accent}" stroke-width="2"/>`;
    case "epic":
      return `<polygon points="${starPoints(CX, CY, R + 6, R - 2, 20)}" fill="${p.accent}" stroke="${p.fg}" stroke-width="1.5" stroke-linejoin="round"/>
  <circle cx="${CX}" cy="${CY}" r="${R - 9}" fill="${p.bg}" stroke="${p.fg}" stroke-opacity=".35" stroke-width="1.5"/>`;
    case "legendary": {
      const sparkles = [[30, 26, 10], [212, 34, 8], [218, 140, 7], [22, 128, 8], [196, 86, 5]]
        .map(([x, y, s]) => `<polygon points="${starPoints(x, y, s, s * 0.32, 4)}" fill="#FFF6CC" stroke="#B8860B" stroke-width="1"/>`)
        .join("");
      return `<circle cx="${CX}" cy="${CY}" r="${R + 2}" fill="url(#${gid})" stroke="#8A6400" stroke-width="1.5"/>
  <circle cx="${CX}" cy="${CY}" r="${R - 8}" fill="${p.bg}"/>
  <circle cx="${CX}" cy="${CY}" r="${R - 13}" fill="none" stroke="url(#${gid})" stroke-width="2"/>
  ${sparkles}`;
    }
    default: // common
      return `<circle cx="${CX}" cy="${CY}" r="${R}" fill="${p.bg}" stroke="${p.accent}" stroke-width="7"/>`;
  }
}

/**
 * @param {import("./contract.js").Badge} badge
 * @param {number} [size=240]
 * @returns {string} <svg> 문자열 (xmlns 포함, 외부 리소스 없음)
 */
export function renderBadgeSVG(badge, size = 240) {
  const p = badge.palette || PALETTES[badge.category] || PALETTES.etc;
  const rarity = RARITIES.includes(badge.rarity) ? badge.rarity : "common";
  const title = String(badge.title ?? "");
  const gid = "hcs-gold-" + hash(`${badge.id}|${title}|${badge.date}`).toString(36);
  const date = String(badge.date ?? "").replace(/-/g, ".");
  const fs = titleFontSize(title).toFixed(1);
  const marks = { common: "", rare: "★", epic: "★★", legendary: "★★★" }[rarity];

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" width="${size}" height="${size}" role="img" aria-label="${esc(`${title} (${RARITY_LABEL[rarity]})`)}">
  <defs><linearGradient id="${gid}" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#FCE38A"/><stop offset=".45" stop-color="#D4A017"/><stop offset=".7" stop-color="#FFF0B3"/><stop offset="1" stop-color="#B8860B"/>
  </linearGradient></defs>
  ${rim(rarity, p, gid)}
  <text x="${CX}" y="44" text-anchor="middle" font-size="11" font-weight="600" letter-spacing="1" fill="${p.fg}" font-family="${FONT}">${esc(date)}</text>
  <text x="${CX}" y="${CY + 4}" text-anchor="middle" dominant-baseline="central" font-size="60" font-family="${EMOJI_FONT}">${esc(badge.icon)}</text>
  ${marks ? `<text x="${CX}" y="152" text-anchor="middle" font-size="12" fill="${p.fg}" fill-opacity=".8" font-family="${FONT}">${marks}</text>` : ""}
  <path d="M10 184 H42 V222 H10 L22 203 Z" fill="${p.accent}" stroke="${p.fg}" stroke-width="1.5" stroke-linejoin="round"/>
  <path d="M230 184 H198 V222 H230 L218 203 Z" fill="${p.accent}" stroke="${p.fg}" stroke-width="1.5" stroke-linejoin="round"/>
  <rect x="28" y="176" width="184" height="38" rx="4" fill="${p.fg}" stroke="${p.accent}" stroke-width="2"/>
  <text x="${CX}" y="196" text-anchor="middle" dominant-baseline="central" font-size="${fs}" font-weight="700" fill="${p.bg}" font-family="${FONT}">${esc(title)}</text>
</svg>`;
}
