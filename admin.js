/* =========================================================================
   DINGSTUDIO — 作品編輯器 (Films Editor)
   No-code editor for films.json. Cover images are uploaded and embedded
   directly (resized data URLs), so there is no file-path or assets-folder
   juggling. Outputs a clean films.json to download.
   ========================================================================= */

const CATEGORIES = [
  { v: "MUSIC VIDEO", t: "Music Video（去 FILMOGRAPHY tab）" },
  { v: "COMMERCIAL", t: "Commercial（去 FILMOGRAPHY tab）" },
  { v: "EVENT", t: "Event（去 EVENT tab）" },
];
let films = [];

const $ = (sel, el = document) => el.querySelector(sel);
const list = $("#list");
const toastEl = $("#toast");

function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  setTimeout(() => toastEl.classList.remove("show"), 2400);
}

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );

function slugify(s) {
  return (
    String(s || "")
      .toLowerCase()
      .replace(/['’"]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "untitled"
  );
}

function ytThumb(id) {
  return id ? `https://img.youtube.com/vi/${encodeURIComponent(id)}/hqdefault.jpg` : "";
}

// Resize an uploaded image to <=1280px wide JPEG data URL, so the embedded
// cover stays small inside films.json.
function resizeImage(file, maxW = 1280) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxW / img.naturalWidth);
      const w = Math.max(1, Math.round(img.naturalWidth * scale));
      const h = Math.max(1, Math.round(img.naturalHeight * scale));
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      c.getContext("2d").drawImage(img, 0, 0, w, h);
      resolve(c.toDataURL("image/jpeg", 0.85));
      URL.revokeObjectURL(img.src);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

/* ---------------- render ---------------- */
function render() {
  if (!films.length) {
    list.innerHTML = `<div class="empty">
      <p>仲未載入你嘅作品。</p>
      <button class="big" id="emptyLoad">① 撳呢度載入 films.json</button>
    </div>`;
    $("#emptyLoad").onclick = () => $("#fileIn").click();
    return;
  }
  list.innerHTML = "";
  films.forEach((f, i) => list.appendChild(filmCard(f, i)));
}

function filmCard(f, i) {
  const el = document.createElement("div");
  el.className = "film";

  const opts = CATEGORIES.map(
    (c) => `<option value="${c.v}" ${f.category === c.v ? "selected" : ""}>${c.t}</option>`
  ).join("");

  const creditsHtml = (f.credits || [])
    .map(
      (c, ci) => `
    <div class="credit" data-ci="${ci}">
      <input class="c-role" placeholder="職位 e.g. Director" value="${esc(c.role)}">
      <input class="c-name" placeholder="名字" value="${esc(c.name)}">
      <button class="ghost tiny c-del" title="刪除呢行">✕</button>
    </div>`
    )
    .join("");

  const previewSrc = (f.thumb && f.thumb.trim()) || ytThumb(f.youtube);
  const usingCustom = !!(f.thumb && f.thumb.trim());

  el.innerHTML = `
    <div class="film-top">
      <span class="no">#${i + 1}</span>
      <span class="arrows">
        <button class="ghost tiny up" title="上移">↑ 上移</button>
        <button class="ghost tiny down" title="下移">↓ 下移</button>
      </span>
    </div>
    <div class="grid">
      <div class="cover">
        <div class="frame"><img class="thumbPrev" src="${esc(previewSrc)}" alt=""></div>
        <input type="file" class="coverFile" accept="image/*" style="display:none">
        <button class="ghost tiny pickCover">📷 上載封面相</button>
        ${usingCustom ? `<button class="ghost tiny clearCover" style="margin-left:6px">用返 YouTube 封面</button>` : ``}
        <div class="small">唔上載就用 YouTube 自動封面。<br>建議橫向 16:9 相片。</div>
      </div>
      <div class="fields">
        <div>
          <label>標題 <span class="en">Title（出街顯示嘅名）</span></label>
          <input class="f-title" value="${esc(f.title)}" placeholder="例：Jollibee — Brand Film">
        </div>
        <div class="row2">
          <div>
            <label>類型 <span class="en">Category</span></label>
            <select class="f-cat">${opts}</select>
          </div>
          <div>
            <label>YouTube 片 ID</label>
            <input class="f-yt" value="${esc(f.youtube)}" placeholder="9bZkp7q19f0">
            <div class="help">網址 watch?v= 後面嗰串字</div>
          </div>
        </div>
        <div class="credits">
          <label>Credit 名單 <span class="en">（選填，例：Director / DP / Client）</span></label>
          <div class="creditList">${creditsHtml}</div>
          <button class="ghost tiny addCredit">＋ 加一個 credit</button>
        </div>
        <div class="film-actions">
          <button class="danger tiny delFilm">刪除呢個作品</button>
        </div>
      </div>
    </div>`;

  /* ---- wire up ---- */
  const titleIn = $(".f-title", el);
  const ytIn = $(".f-yt", el);
  const catIn = $(".f-cat", el);
  const prev = $(".thumbPrev", el);
  const coverFile = $(".coverFile", el);

  titleIn.oninput = () => {
    f.title = titleIn.value;
    if (!f.slug) f.slug = slugify(titleIn.value);
  };
  ytIn.oninput = () => {
    f.youtube = ytIn.value.trim();
    if (!f.thumb) prev.src = ytThumb(f.youtube);
  };
  catIn.onchange = () => { f.category = catIn.value; };

  // cover upload (embed as resized data URL)
  $(".pickCover", el).onclick = () => coverFile.click();
  coverFile.onchange = async () => {
    const file = coverFile.files[0];
    if (!file) return;
    try {
      toast("處理緊張相…");
      f.thumb = await resizeImage(file);
      render();
      toast("封面相已更新 ✓");
    } catch {
      alert("呢個檔案讀唔到，試吓另一張相（jpg / png）。");
    }
  };
  const clearBtn = $(".clearCover", el);
  if (clearBtn) clearBtn.onclick = () => { f.thumb = ""; render(); };

  $(".delFilm", el).onclick = () => {
    if (confirm("確定刪除「" + (f.title || "呢個作品") + "」？")) { films.splice(i, 1); render(); }
  };
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
    toast(`已載入 ${films.length} 個作品`);
  } catch {
    render(); // shows the big "load" button
  }
}

function loadFromFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      films = normalize(JSON.parse(reader.result));
      render();
      toast(`已載入 ${films.length} 個作品`);
    } catch (e) {
      alert("呢個唔似 films.json：" + e.message);
    }
  };
  reader.readAsText(file);
}

function buildJson() {
  const out = films.map((f) => {
    const o = {
      slug: f.slug || slugify(f.title),
      title: f.title || "",
      category: (f.category || "COMMERCIAL").toUpperCase(),
      youtube: f.youtube || "",
    };
    if (f.thumb && f.thumb.trim()) o.thumb = f.thumb.trim();
    o.credits = (f.credits || []).filter((c) => (c.role || "").trim() || (c.name || "").trim());
    return o;
  });
  return JSON.stringify(out, null, 2) + "\n";
}

function download() {
  if (!films.length) { alert("仲未有作品。"); return; }
  const blob = new Blob([buildJson()], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "films.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  toast("已下載 films.json，放返入你個網站資料夾蓋過舊嗰個");
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
