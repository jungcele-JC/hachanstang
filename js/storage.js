// js/storage.js — C 담당. 뱃지 기록 저장소 (localStorage, 실패 시 메모리 폴백)
// export 이름과 시그니처는 js/contract.js 규격을 따른다.
import { CATEGORIES, RARITIES, STORAGE_KEY, todayStr } from "./contract.js";

const VERSION = 1;
const REQUIRED = ["id", "date", "deed", "title", "description", "category", "rarity", "icon", "palette", "createdAt"];

/** @type {import("./contract.js").Badge[]} */
let memory = [];          // localStorage를 못 쓸 때의 폴백
let storageOk = true;     // 한 번 실패하면 이후는 메모리로만
let warned = false;

function warn(msg, err) {
  if (!warned) { console.warn(`[하찮상 storage] ${msg}`, err ?? ""); warned = true; }
}

function migrate(data) {
  // 버전이 올라가면 여기서 이전 형식을 변환한다. v1이 첫 버전이라 지금은 통과.
  if (!data || typeof data !== "object") return [];
  if (data.version === VERSION && Array.isArray(data.badges)) return data.badges;
  if (Array.isArray(data)) return data;          // 아주 초기(배열만 저장) 호환
  return [];
}

function load() {
  if (!storageOk) return memory;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    memory = raw ? migrate(JSON.parse(raw)) : [];
  } catch (err) {
    storageOk = false;
    warn("저장소를 읽을 수 없어 이 세션 동안만 메모리에 보관합니다.", err);
  }
  return memory;
}

function persist(badges) {
  memory = badges;
  if (!storageOk) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: VERSION, badges }));
  } catch (err) {
    storageOk = false;
    warn("저장소에 쓸 수 없어 이 세션 동안만 메모리에 보관합니다.", err);
  }
}

function isBadge(b) {
  return b && typeof b === "object" && REQUIRED.every((k) => k in b) &&
    typeof b.id === "string" && typeof b.date === "string" && typeof b.title === "string";
}

const byNewest = (a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? "");

// ---------------------------------------------------------------- 규격 export

export function saveBadge(badge) {
  if (!isBadge(badge)) throw new Error("saveBadge: Badge 형식이 아닙니다.");
  const rest = load().filter((b) => b.id !== badge.id);
  persist([badge, ...rest]);
}

export function listBadges() {
  return [...load()].sort(byNewest);
}

export function deleteBadge(id) {
  persist(load().filter((b) => b.id !== id));
}

export function getStats() {
  const badges = load();
  const byCategory = Object.fromEntries(CATEGORIES.map((c) => [c, 0]));
  const byRarity = Object.fromEntries(RARITIES.map((r) => [r, 0]));
  for (const b of badges) {
    if (b.category in byCategory) byCategory[b.category]++; else byCategory.etc++;
    if (b.rarity in byRarity) byRarity[b.rarity]++;
  }
  return { total: badges.length, streak: calcStreak(badges), byCategory, byRarity };
}

export function exportJSON() {
  return JSON.stringify({ version: VERSION, exportedAt: new Date().toISOString(), badges: listBadges() }, null, 2);
}

export function importJSON(json) {
  let data;
  try { data = JSON.parse(json); } catch { throw new Error("importJSON: JSON을 읽을 수 없습니다."); }
  const incoming = Array.isArray(data) ? data : Array.isArray(data?.badges) ? data.badges : [];
  const current = load();
  const known = new Set(current.map((b) => b.id));
  const fresh = [];
  for (const b of incoming) {
    if (!isBadge(b) || known.has(b.id)) continue;
    known.add(b.id);
    fresh.push(b);
  }
  if (fresh.length) persist([...fresh, ...current]);
  return fresh.length;
}

// ---------------------------------------------------------------- 규격 외 (테스트·설정용)

/** 모든 기록 삭제. 설정 화면의 "전부 지우기"와 테스트에서 사용. */
export function clearAll() { persist([]); }

/** 오늘 또는 어제까지 연속으로 뱃지가 있는 날 수. */
export function calcStreak(badges, today = todayStr()) {
  const days = new Set(badges.map((b) => b.date));
  let cursor = days.has(today) ? today : shiftDay(today, -1);
  if (!days.has(cursor)) return 0;
  let n = 0;
  while (days.has(cursor)) { n++; cursor = shiftDay(cursor, -1); }
  return n;
}

/** "YYYY-MM-DD"에 n일을 더한 문자열 (로컬 날짜 기준) */
export function shiftDay(dateStr, n) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return todayStr(new Date(y, m - 1, d + n));
}
