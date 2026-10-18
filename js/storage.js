// MOCK — C가 진짜 구현(localStorage)으로 교체합니다. 지금은 새로고침하면 사라지는 메모리 저장.
import { CATEGORIES, RARITIES } from "./contract.js";

let items = [];

export function saveBadge(badge) { items = [badge, ...items.filter((b) => b.id !== badge.id)]; }
export function listBadges() { return [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt)); }
export function deleteBadge(id) { items = items.filter((b) => b.id !== id); }
export function getStats() {
  const byCategory = Object.fromEntries(CATEGORIES.map((c) => [c, 0]));
  const byRarity = Object.fromEntries(RARITIES.map((r) => [r, 0]));
  for (const b of items) { byCategory[b.category]++; byRarity[b.rarity]++; }
  return { total: items.length, streak: items.length ? 1 : 0, byCategory, byRarity };
}
export function exportJSON() { return JSON.stringify(items, null, 2); }
export function importJSON(json) {
  const incoming = JSON.parse(json);
  const known = new Set(items.map((b) => b.id));
  const fresh = incoming.filter((b) => !known.has(b.id));
  items = [...fresh, ...items];
  return fresh.length;
}
