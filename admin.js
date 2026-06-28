/* =========================================================================
   DINGSTUDIO — Films Editor
   A no-code editor for films.json. Loads the file, lets you edit every field
   in a form, then downloads a clean films.json to drop back into the site.
   Pure browser, no server, no build.
   ========================================================================= */

const CATEGORIES = ["MUSIC VIDEO", "COMMERCIAL", "EVENT"];
let films = [];

const $ = (sel, el = document) => el.querySelector(sel);
const list = $("#list");
const toastEl = $("#toast");

function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  setTimeout(() => toastEl.classList.remove("show"), 1800);
}

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );

function slugify(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/['’"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "untitled";
}

function ytThumb(id) {
  return id ? `https://img.youtube.com/vi/${encodeURIComponent(id)}/hqdefault.jpg` : "";
}

/* ---------------- render ---------------- */
function render() {
  list.innerHTML = "";
  films.forEach((f, i) => list.appendChild(filmCard(f, i)));
}

function filmCard(f, i) {
  const el = document.createElement("div");
  el.className = "film";

  const opts = CATEGORIES.map(
    (c) => `<option value="${c}" ${f.category === c ? "selected" : ""}>${c}</option>`
  ).join("");

  const creditsHtml = (f.credits || [])
    .map(
      (c, ci) => `
    <div class="credit" data-ci="${ci}">
      <input class="c-role" placeholder="Role e.g. Director" value="${esc(c.role)}">
      <input class="c-name" placeholder="Name" value="${esc(c.name)}">
      <button class="ghost tiny c-del" title="Remove credit">✕</button>
    </div>`
    )
    .join("");

  const previewSrc = (f.thumb && f.thumb.trim()) || ytThumb(f.youtube);

  el.innerHTML = `
    <div class="preview">
      <span class="idx">#${i + 1}</span>
      <div class="frame"><img class="thumbPrev" src="${esc(previewSrc)}" alt=""></div>
      <div style="display:flex;gap:6px">
        <button class="ghost tiny up" title="Move up">↑</button>
        <button class="ghost tiny down" title="Move down">↓</button>
      </div>
    </div>
    <div class="fields">
      <div>
        <label>Title</label>
        <input class="f-title" value="${esc(f.title)}" placeholder="Client — Project Name">
      </div>
      <div class="row2">
        <div>
          <label>Category (decides the tab)</label>
          <select class="f-cat">${opts}</select>
        </div>
        <div>
          <label>YouTube ID</label>
          <input class="f-yt" value="${esc(f.youtube)}" placeholder="9bZkp7q19f0">
        </div>
      </div>
      <div class="row2">
        <div>
          <label>Custom thumbnail (optional)</label>
          <input class="f-thumb" value="${esc(f.thumb || "")}" placeholder="assets/thumbs/my-film.jpg">
        </div>
        <div>
          <label>Slug (URL id)</label>
          <input class="f-slug" value="${esc(f.slug)}" placeholder="auto from title">
        </div>
      </div>
      <div class="credits">
        <label>Credits (optional)</label>
        <div class="creditList">${creditsHtml}</div>
        <button class="ghost tiny addCredit">+ Add credit</button>
      </div>
      <div class="film-actions">
        <button class="ghost tiny autoSlug">Auto slug from title</button>
        <button class="danger tiny delFilm">Delete film</button>
      </div>
    </div>`;

  /* ---- wire up ---- */
  const titleIn = $(".f-title", el);
  const ytIn = $(".f-yt", el);
  const thumbIn = $(".f-thumb", el);
  const slugIn = $(".f-slug", el);
  const catIn = $(".f-cat", el);
  const prev = $(".thumbPrev", el);

  const refreshPrev = () => {
    prev.src = (thumbIn.value.trim()) || ytThumb(ytIn.value.trim());
  };

  titleIn.oninput = () => { f.title = titleIn.value; if (!slugIn.value.trim()) { slugIn.value = slugify(titleIn.value); f.slug = slugIn.value; } };
  ytIn.oninput = () => { f.youtube = ytIn.value.trim(); refreshPrev(); };
  thumbIn.oninput = () => { f.thumb = thumbIn.value.trim(); refreshPrev(); };
  slugIn.oninput = () => { f.slug = slugIn.value.trim(); };
  catIn.onchange = () => { f.category = catIn.value; };

  $(".autoSlug", el).onclick = () => { slugIn.value = slugify(titleIn.value); f.slug = slugIn.value; };
  $(".delFilm", el).onclick = () => { if (confirm("Delete this film?")) { films.splice(i, 1); render(); } };
  $(".up", el).onclick = () => { if (i > 0) { [films[i - 1], films[i]] = [films[i], films[i - 1]]; render(); } };
  $(".down", el).onclick = () => { if (i < films.length - 1) { [films[i + 1], films[i]] = [films[i], films[i + 1]]; render(); } };

  // credits
  f.credits = f.credits || [];
  $(".addCredit", el).onclick = () => { f.credits.push({ role: "", name: "" }); render(); };
  el.querySelectorAll(".credit").forEach((row) => {
    const ci = +row.dataset.ci;
    $(".c-role", row).oninput = (e) => { f.credits[ci].role = e.target.value; };
    $(".c-name", row).oninput = (e) => { f.credits[ci].name = e.target.value; };
    $(".c-del", row).onclick = () => { f.credits.splice(ci, 1); render(); };
  });

  return el;
}

/* ---------------- load / save ---------------- */
function normalize(data) {
  if (!Array.isArray(data)) throw new Error("films.json must be a list");
  return data.map((f) => ({
    slug: f.slug || slugify(f.title),
    title: f.title || "",
    category: (f.category || "COMMERCIAL").toUpperCase(),
    youtube: f.youtube || "",
    thumb: f.thumb || "",
    credits: Array.isArray(f.credits) ? f.credits.map((c) => ({ role: c.role || "", name: c.name || "" })) : [],
  }));
}

async function autoLoad() {
  try {
    const res = await fetch("films.json", { cache: "no-store" });
    if (!res.ok) throw new Error();
    films = normalize(await res.json());
    render();
    toast(`Loaded ${films.length} films`);
  } catch {
    list.innerHTML = `<p class="hint" style="padding:20px 0">Couldn't auto-load films.json (you may have opened this file directly). Click <b>Load films.json</b> above to pick it.</p>`;
  }
}

function loadFromFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      films = normalize(JSON.parse(reader.result));
      render();
      toast(`Loaded ${films.length} films`);
    } catch (e) {
      alert("That doesn't look like a valid films.json: " + e.message);
    }
  };
  reader.readAsText(file);
}

function buildJson() {
  // emit clean objects; drop empty thumb / empty credits for tidiness
  const out = films.map((f) => {
    const o = {
      slug: f.slug || slugify(f.title),
      title: f.title || "",
      category: (f.category || "COMMERCIAL").toUpperCase(),
      youtube: f.youtube || "",
    };
    if (f.thumb && f.thumb.trim()) o.thumb = f.thumb.trim();
    const credits = (f.credits || []).filter((c) => (c.role || "").trim() || (c.name || "").trim());
    o.credits = credits;
    return o;
  });
  return JSON.stringify(out, null, 2) + "\n";
}

function download() {
  if (!films.length) { alert("Nothing to save yet — load or add films first."); return; }
  const blob = new Blob([buildJson()], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "films.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  toast("Downloaded films.json — replace the file in your site folder");
}

/* ---------------- buttons ---------------- */
$("#saveBtn").onclick = download;
$("#addBtn").onclick = () => {
  films.push({ slug: "", title: "", category: "COMMERCIAL", youtube: "", thumb: "", credits: [] });
  render();
  window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
};
$("#loadBtn").onclick = () => $("#fileIn").click();
$("#fileIn").onchange = (e) => { if (e.target.files[0]) loadFromFile(e.target.files[0]); };

autoLoad();
