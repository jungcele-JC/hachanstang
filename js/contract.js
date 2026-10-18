// ============================================================
// 하찮상 공통 규격 v2  (2026-10-18)
// 3명이 합의한 인터페이스입니다. 바꾸고 싶으면 3명 모두 동의한 뒤
// C가 수정하고 버전을 올립니다. 다른 사람은 이 파일을 건드리지 않습니다.
//
// 변경 이력
//   v2  generateBadge에 선택 인자 category 추가 (A 요청). 화면에서 카테고리를 먼저 고르는 흐름 지원.
//   v1  최초 합의
// ============================================================

/** @typedef {"food"|"clean"|"digital"|"move"|"social"|"rest"|"work"|"etc"} Category */
/** @typedef {"common"|"rare"|"epic"|"legendary"} Rarity */

/**
 * 뱃지 1개 = 하찮은 업적 1건
 * @typedef {Object} Badge
 * @property {string} id            crypto.randomUUID()
 * @property {string} date          "YYYY-MM-DD", 사용자 로컬 날짜
 * @property {string} deed          입력 원문. 예: "사과 한 개 먹음"
 * @property {string} title         업적 이름. 예: "과일 구조대" (2~8자 권장)
 * @property {string} description   수여 문구 한 줄. 예: "비타민 한 명을 무사히 구출했습니다."
 * @property {Category} category
 * @property {Rarity} rarity
 * @property {string} icon          이모지 1개. 예: "🍎"
 * @property {{bg:string, fg:string, accent:string}} palette  hex 색상 3개
 * @property {string} createdAt     ISO 8601
 */

export const CATEGORIES = ["food", "clean", "digital", "move", "social", "rest", "work", "etc"];
export const CATEGORY_LABEL = {
  food: "먹기", clean: "정리", digital: "디지털", move: "움직임",
  social: "사람", rest: "휴식", work: "일/공부", etc: "기타",
};
export const RARITIES = ["common", "rare", "epic", "legendary"];
export const RARITY_LABEL = { common: "흔함", rare: "희귀", epic: "영웅", legendary: "전설" };
export const STORAGE_KEY = "hachanstang.badges.v1";

/** 로컬 날짜를 "YYYY-MM-DD"로 */
export function todayStr(d = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// ------------------------------------------------------------
// 각 모듈이 반드시 export해야 하는 함수 (이름·시그니처 고정)
// ------------------------------------------------------------
// js/badge-engine.js  (B 담당)
//   generateBadge(deed: string, date?: string, category?: Category): Badge
//     - 동기. 같은 deed+date+category → 항상 같은 결과 (결정적). 어떤 입력에도 반드시 뱃지를 반환.
//     - category가 오면 그 카테고리 안에서만 뱃지를 찾고, 결과의 category도 그 값이어야 함.
//       category가 없거나(undefined) CATEGORIES에 없는 값이면 지금처럼 엔진이 문장에서 추측.
//   renderBadgeSVG(badge: Badge, size?: number): string
//     - <svg …> 문자열. 기본 size 240. 외부 리소스(폰트/이미지 URL) 사용 금지.
//
// js/storage.js  (C 담당)
//   saveBadge(badge: Badge): void
//   listBadges(): Badge[]                    최신순(createdAt 내림차순)
//   deleteBadge(id: string): void
//   getStats(): { total: number, streak: number,
//                 byCategory: Record<Category, number>, byRarity: Record<Rarity, number> }
//     - streak: 오늘 또는 어제까지 연속으로 뱃지가 있는 날 수
//   exportJSON(): string
//   importJSON(json: string): number          새로 추가된 개수 반환(중복 id는 무시)
//
// js/share.js  (C 담당)
//   badgeToPNG(badge: Badge): Promise<Blob>   1080x1080 공유 카드 이미지
//
// js/app.js  (A 담당)
//   위 함수들을 import해서 화면을 만든다. 화면 상태(입력/수여/컬렉션)는 A만 소유.
