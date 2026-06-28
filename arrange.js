/* =========================================================================
   DINGSTUDIO — 排序 (visual reorder)
   Shows films as a website-style thumbnail grid you drag to reorder, so you
   can see the whole set at once. Saves the new order back to films.json,
   keeping every other field (title, credits, thumb…) untouched.
   ========================================================================= */

const FILMO = ["MUSIC VIDEO", "COMMERCIAL"];
const isEvent = (c) => (c || "").toUpperCase() === "EVENT";

let groups = { filmo: [], event: [] }; // arrays of full film objects, in display order
let drag = null; // { group, index }

const $ = (s, el = document) => el.querySelector(s);
const board = $("#board");
const toastEl = $("#toast");
const toast = (m) => { toastEl.textContent = m; toastEl.classList.add("show"); setTimeout(() => toastEl.classList.remove("show"), 2200); };

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function thumbSrc(f) {
  if (f.thumb && String(f.thumb).trim()) return f.thumb;
  return f.youtube ? `https://img.youtube.com/vi/${encodeURIComponent(f.youtube)}/hqdefault.jpg` : "";
}

function render() {
  board.innerHTML = `
    ${section("FILMOGRAPHY", "filmo")}
    ${section("EVENT", "event")}`;
  wire("filmo");
  wire("event");
}

function section(label, key) {
  const arr = groups[key];
  const tiles = arr
    .map(
      (f, i) => `
    <div class="tile" draggable="true" data-group="${key}" data-i="${i}">
      <div class="frame">
        <span class="pos">${i + 1}</span>
        <button class="del" draggable="false" title="刪除呢條">✕</button>
        <img src="${esc(thumbSrc(f))}" alt="" loading="lazy">
      </div>
      <div class="info">
        <div class="name">${esc(f.title || "(冇標題)")}</div>
        <div class="rc">${esc([f.role, f.category].filter(Boolean).join(" · "))}</div>
      </div>
    </div>`
    )
    .join("");
  return `
    <h2 class="sec">${label}</h2>
    <div class="sub">${String(arr.length).padStart(2, "0")} 條 · 拖嚟排序</div>
    <div class="grid" data-group="${key}">${tiles || `<div class="empty">冇作品</div>`}</div>`;
}

function wire(key) {
  board.querySelectorAll(`.tile[data-group="${key}"]`).forEach((tile) => {
    tile.addEventListener("dragstart", (e) => {
      drag = { group: key, index: +tile.dataset.i };
      tile.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
    });
    tile.addEventListener("dragend", () => { tile.classList.remove("dragging"); drag = null; });
    tile.addEventListener("dragover", (e) => {
      if (drag && drag.group === key) { e.preventDefault(); tile.classList.add("over"); }
    });
    tile.addEventListener("dragleave", () => tile.classList.remove("over"));
    tile.addEventListener("drop", (e) => {
      e.preventDefault();
      tile.classList.remove("over");
      if (!drag || drag.group !== key) return;
      const to = +tile.dataset.i;
      move(key, drag.index, to);
    });
    const del = tile.querySelector(".del");
    if (del) del.onclick = (e) => {
      e.stopPropagation();
      const i = +tile.dataset.i;
      const f = groups[key][i];
      if (confirm("刪除「" + (f.title || "呢條") + "」？\n（淨係喺呢度移走，YouTube 條片唔受影響）")) {
        groups[key].splice(i, 1);
        render();
        toast("已刪除");
      }
    };
  });
}

function move(key, from, to) {
  if (from === to) return;
  const arr = groups[key];
  const [m] = arr.splice(from, 1);
  const insertAt = from < to ? to - 1 : to; // insert before the drop target
  arr.splice(insertAt, 0, m);
  render();
}

/* ---------------- load / save ---------------- */
function ingest(data) {
  if (!Array.isArray(data)) throw new Error("films.json must be a list");
  groups = { filmo: [], event: [] };
  data.forEach((f) => (isEvent(f.category) ? groups.event : groups.filmo).push(f));
  render();
}

async function autoLoad() {
  try {
    const res = await fetch("films.json", { cache: "no-store" });
    if (!res.ok) throw new Error();
    ingest(await res.json());
    toast(`已載入 ${groups.filmo.length + groups.event.length} 條`);
  } catch {
    board.innerHTML = `<div class="empty">撳右上角「載入 films.json」揀你個檔。</div>`;
  }
}

function loadFromFile(file) {
  const r = new FileReader();
  r.onload = () => { try { ingest(JSON.parse(r.result)); toast("已載入"); } catch (e) { alert("唔似 films.json：" + e.message); } };
  r.readAsText(file);
}

function download() {
  const out = [...groups.filmo, ...groups.event];
  if (!out.length) { alert("仲未載入作品。"); return; }
  const blob = new Blob([JSON.stringify(out, null, 2) + "\n"], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "films.json";
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
  toast("已下載 films.json — 放返入網站資料夾蓋過舊嗰個");
}

$("#saveBtn").onclick = download;
$("#loadBtn").onclick = () => $("#fileIn").click();
$("#fileIn").onchange = (e) => { if (e.target.files[0]) loadFromFile(e.target.files[0]); };

autoLoad();
