// 임시 app.js — A가 완전히 다시 작성합니다. mock 연결 확인용.
import { generateBadge, renderBadgeSVG } from "./badge-engine.js";
import { saveBadge, listBadges } from "./storage.js";

const form = document.getElementById("deed-form");
const result = document.getElementById("result");
const collection = document.getElementById("collection");

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const badge = generateBadge(document.getElementById("deed").value.trim());
  saveBadge(badge);
  result.innerHTML = `${renderBadgeSVG(badge)}<p>${badge.description}</p>`;
  collection.innerHTML = listBadges().map((b) => renderBadgeSVG(b, 96)).join("");
  form.reset();
});
