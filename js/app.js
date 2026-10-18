// js/app.js - A 소유. 화면 상태(입력/수여/컬렉션)와 이벤트.
// 다른 모듈은 contract.js에 적힌 export 이름만 믿고 쓴다.
import { generateBadge, renderBadgeSVG } from "./badge-engine.js";
import { saveBadge, listBadges, deleteBadge, getStats, exportJSON, importJSON } from "./storage.js";
import { badgeToPNG } from "./share.js";
import { CATEGORIES, CATEGORY_LABEL, RARITY_LABEL, todayStr } from "./contract.js";

// 화면 전용 장식. 카테고리 이모지는 UI에서만 쓴다(뱃지 icon은 엔진이 정함).
const CATEGORY_ICON = {
  food: "🍽️", clean: "🧹", digital: "💾", move: "🚶",
  social: "💬", rest: "😴", work: "📚", etc: "✨",
};
const PLACEHOLDERS = ["사과 먹음", "사진 3장 지움", "이불 갬", "물 한 잔 마심", "답장 하나 보냄", "양치함", "쓰레기 버림"];

const $ = (sel, root = document) => root.querySelector(sel);
const state = { category: null, pending: null, saved: false, detail: null };

// ------------------------------------------------------------ 공용
let toastTimer;
function toast(msg) {
  const el = $("#toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2200);
}

function fmtDate(ymd) {
  const [y, m, d] = ymd.split("-").map(Number);
  const today = todayStr();
  const yesterday = todayStr(new Date(Date.now() - 864e5));
  const label = `${m}월 ${d}일`;
  if (ymd === today) return `${label} (오늘)`;
  if (ymd === yesterday) return `${label} (어제)`;
  return y === new Date().getFullYear() ? label : `${y}년 ${label}`;
}

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ------------------------------------------------------------ 라우팅 (#home / #award / #collection)
const SCREENS = ["home", "award", "collection"];
const renderers = { home: renderHome, award: renderAward, collection: renderCollection };

function route() {
  let id = location.hash.slice(1) || "home";
  if (!SCREENS.includes(id)) id = "home";
  if (id === "award" && !state.pending) { location.replace("#home"); return; }

  for (const s of SCREENS) $("#" + s).hidden = s !== id;
  document.querySelectorAll(".tabbar a").forEach((a) => {
    const current = a.dataset.tab === id || (id === "award" && a.dataset.tab === "home");
    if (current) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
  });
  renderers[id]();
  window.scrollTo(0, 0);
  $(`#${id} [tabindex="-1"]`)?.focus({ preventScroll: true });
}

// ------------------------------------------------------------ 1. 입력
function buildChips() {
  const box = $("#category-chips");
  box.innerHTML = "";
  for (const cat of CATEGORIES) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "chip";
    b.dataset.cat = cat;
    b.setAttribute("role", "radio");
    b.setAttribute("aria-checked", "false");
    b.innerHTML = `<span class="emoji" aria-hidden="true">${CATEGORY_ICON[cat]}</span><span>${CATEGORY_LABEL[cat]}</span>`;
    b.addEventListener("click", () => selectCategory(cat));
    box.appendChild(b);
  }
  // 방향키로 칩 사이 이동 (radiogroup 관례)
  box.addEventListener("keydown", (e) => {
    if (!["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp"].includes(e.key)) return;
    const chips = [...box.querySelectorAll(".chip")];
    const i = chips.indexOf(document.activeElement);
    if (i < 0) return;
    e.preventDefault();
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : -1;
    const next = chips[(i + step + chips.length) % chips.length];
    next.focus();
    selectCategory(next.dataset.cat, { keepFocus: true });
  });
}

function selectCategory(cat, { keepFocus = false } = {}) {
  state.category = cat;
  document.querySelectorAll(".chip").forEach((c) => c.setAttribute("aria-checked", String(c.dataset.cat === cat)));
  updateSubmit();
  if (!keepFocus && !$("#deed").value) $("#deed").focus({ preventScroll: true });
}

function updateSubmit() {
  const deed = $("#deed").value.trim();
  const ok = Boolean(state.category) && deed.length > 0;
  $("#submit-btn").disabled = !ok;
  const hint = $("#deed-hint");
  if (!state.category) hint.textContent = "카테고리를 먼저 골라 주세요.";
  else if (!deed) hint.textContent = `${CATEGORY_LABEL[state.category]} 쪽 일이군요. 뭘 하셨는지 적어 주세요.`;
  else hint.textContent = "준비됐어요. 업적 받기를 누르세요.";
}

let phTimer;
function rotatePlaceholder() {
  clearInterval(phTimer);
  let i = 0;
  phTimer = setInterval(() => {
    const input = $("#deed");
    if (input.value) return;
    i = (i + 1) % PLACEHOLDERS.length;
    input.placeholder = PLACEHOLDERS[i];
  }, 3000);
}

function renderHome() {
  updateSubmit();
  const mine = listBadges().filter((b) => b.date === todayStr());
  $("#today").hidden = mine.length === 0;
  $("#today-list").innerHTML = mine
    .map((b) => `<li>${renderBadgeSVG(b, 32)}<span>${b.title}</span></li>`)
    .join("");
}

function onSubmit(e) {
  e.preventDefault();
  const deed = $("#deed").value.trim();
  if (!state.category || !deed) { updateSubmit(); return; }
  // 세 번째 인자 category는 규격 v1에 없어서 지금 mock은 무시한다.
  // 규격에 들어오면 엔진이 고른 카테고리 안에서만 뱃지를 찾게 된다.
  state.pending = generateBadge(deed, undefined, state.category);
  state.saved = false;
  $("#deed-form").reset();
  state.category = null;
  document.querySelectorAll(".chip").forEach((c) => c.setAttribute("aria-checked", "false"));
  location.hash = "#award";
}

// ------------------------------------------------------------ 2. 수여
function fillBadgeView(prefix, b) {
  $(`#${prefix}-title`).textContent = b.title;
  $(`#${prefix}-desc`).textContent = b.description;
  const r = $(`#${prefix}-rarity`);
  r.textContent = RARITY_LABEL[b.rarity] ?? b.rarity;
  r.dataset.rarity = b.rarity;
  $(`#${prefix}-date`).textContent = fmtDate(b.date);
  $(`#${prefix}-deed`).textContent = b.deed;
}

function renderAward() {
  const b = state.pending;
  const medal = $("#medal");
  medal.innerHTML = renderBadgeSVG(b, 240);
  medal.classList.remove("enter");
  void medal.offsetWidth; // 애니메이션 재시작
  medal.classList.add("enter");
  fillBadgeView("award", b);
  const save = $("#save-btn");
  save.disabled = state.saved;
  save.textContent = state.saved ? "보관됨 ✓" : "컬렉션에 보관";
}

function onSave() {
  if (!state.pending || state.saved) return;
  saveBadge(state.pending);
  state.saved = true;
  $("#save-btn").disabled = true;
  $("#save-btn").textContent = "보관됨 ✓";
  toast("컬렉션에 보관했어요");
}

async function onImage() {
  const b = state.pending;
  if (!b) return;
  const btn = $("#image-btn");
  btn.disabled = true;
  try {
    const blob = await badgeToPNG(b);
    const file = new File([blob], `하찮상-${b.title}-${b.date}.png`, { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title: `하찮상 · ${b.title}` }); }
      catch (err) { if (err?.name !== "AbortError") download(blob, file.name); }
    } else {
      download(blob, file.name);
      toast("이미지를 저장했어요");
    }
  } catch (err) {
    console.error(err);
    toast("이미지를 만들지 못했어요");
  } finally {
    btn.disabled = false;
  }
}

// ------------------------------------------------------------ 3. 컬렉션
function renderCollection() {
  const badges = listBadges();
  const stats = getStats();
  $("#stat-total").textContent = stats.total;
  $("#stat-streak").textContent = stats.streak;

  const max = Math.max(1, ...Object.values(stats.byCategory));
  $("#stat-categories").innerHTML = CATEGORIES
    .filter((c) => stats.byCategory[c] > 0)
    .map((c) => `<li data-cat="${c}"><span>${CATEGORY_ICON[c]} ${CATEGORY_LABEL[c]}</span>
      <span class="bar"><i style="width:${(stats.byCategory[c] / max) * 100}%"></i></span>
      <span class="n">${stats.byCategory[c]}</span></li>`)
    .join("");

  const groups = new Map();
  for (const b of badges) {
    if (!groups.has(b.date)) groups.set(b.date, []);
    groups.get(b.date).push(b);
  }
  const box = $("#badge-groups");
  box.innerHTML = "";
  $("#empty-collection").hidden = badges.length > 0;
  for (const [date, list] of groups) {
    const sec = document.createElement("section");
    sec.innerHTML = `<h2 class="group-title">${fmtDate(date)} · ${list.length}개</h2><ul class="grid"></ul>`;
    const ul = $("ul", sec);
    for (const b of list) {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.setAttribute("aria-label", `${b.title}, ${RARITY_LABEL[b.rarity] ?? b.rarity}`);
      btn.innerHTML = renderBadgeSVG(b, 110);
      const t = document.createElement("span");
      t.className = "title";
      t.textContent = b.title;
      btn.appendChild(t);
      btn.addEventListener("click", () => openDetail(b));
      li.appendChild(btn);
      ul.appendChild(li);
    }
    box.appendChild(sec);
  }
}

function openDetail(b) {
  state.detail = b;
  $("#detail-medal").innerHTML = renderBadgeSVG(b, 160);
  fillBadgeView("detail", b);
  resetDeleteButtons();
  $("#detail").showModal();
}

let deleteTimer;
function resetDeleteButtons() {
  clearTimeout(deleteTimer);
  $("#detail-delete").hidden = false;
  $("#detail-confirm").hidden = true;
  $("#detail-cancel").hidden = true;
}

function askDelete() {
  $("#detail-delete").hidden = true;
  $("#detail-confirm").hidden = false;
  $("#detail-cancel").hidden = false;
  $("#detail-cancel").focus();
  deleteTimer = setTimeout(resetDeleteButtons, 5000); // 5초 안에 안 누르면 되돌림
}

function confirmDelete() {
  if (!state.detail) return;
  deleteBadge(state.detail.id);
  $("#detail").close();
  toast("업적을 삭제했어요");
  renderCollection();
}

function onExport() {
  const blob = new Blob([exportJSON()], { type: "application/json" });
  download(blob, `hachanstang-${todayStr()}.json`);
  toast("JSON 파일로 내보냈어요");
}

async function onImport(e) {
  const file = e.target.files?.[0];
  e.target.value = "";
  if (!file) return;
  try {
    const n = importJSON(await file.text());
    toast(n > 0 ? `업적 ${n}개를 가져왔어요` : "새로 추가된 업적이 없어요");
    renderCollection();
  } catch (err) {
    console.error(err);
    toast("파일을 읽지 못했어요");
  }
}

// ------------------------------------------------------------ 시작
function init() {
  buildChips();
  rotatePlaceholder();
  $("#deed").addEventListener("input", updateSubmit);
  $("#deed-form").addEventListener("submit", onSubmit);
  $("#save-btn").addEventListener("click", onSave);
  $("#image-btn").addEventListener("click", onImage);
  $("#detail-delete").addEventListener("click", askDelete);
  $("#detail-confirm").addEventListener("click", confirmDelete);
  $("#detail-cancel").addEventListener("click", resetDeleteButtons);
  $("#detail-close").addEventListener("click", () => $("#detail").close());
  $("#detail").addEventListener("close", resetDeleteButtons);
  $("#export-btn").addEventListener("click", onExport);
  $("#import-input").addEventListener("change", onImport);
  window.addEventListener("hashchange", route);
  route();
}

init();
