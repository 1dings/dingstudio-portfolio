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
let dragFrom = null;

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

/* ---- credit auto-parsing ---- */
// Map common Chinese/English role words to a clean English label for the card badge.
// Abbreviation / alias -> clean title. Keys are matched case-insensitively.
const ROLE_MAP = {
  // Director family
  "導演": "Director", "导演": "Director", director: "Director", dir: "Director",
  "助理導演": "Assistant Director", "助導": "Assistant Director", "副導演": "Assistant Director",
  ad: "Assistant Director", "asst dir": "Assistant Director", "assistant dir": "Assistant Director",
  "1st ad": "1st AD", "2nd ad": "2nd AD",
  "art dir": "Art Director", artdir: "Art Director", "art director": "Art Director", "美術": "Art Director", "美術指導": "Art Director",
  // Camera
  "攝影": "DP", "攝影指導": "DP", "摄影": "DP", dp: "DP", dop: "DP", cinematographer: "DP",
  "cam asst": "Camera Assistant", "cam assist": "Camera Assistant", "camera assistant": "Camera Assistant", "攝助": "Camera Assistant",
  gaffer: "Gaffer", "燈光": "Gaffer",
  // Edit / post
  "剪接": "Editor", "剪輯": "Editor", "剪片": "Editor", "剪接師": "Editor", editor: "Editor", edit: "Editor",
  "offline editor": "Offline Editor", "online editor": "Online Editor",
  "調色": "Colourist", "調色師": "Colourist", colourist: "Colourist", colorist: "Colourist",
  // Producing
  "監製": "Producer", "制片": "Producer", "製片": "Producer", producer: "Producer", prod: "Producer",
  "exec prod": "Executive Producer", "executive producer": "Executive Producer",
  pa: "Production Assistant", "prod assistant": "Production Assistant", "production assistant": "Production Assistant",
  pm: "Production Manager", "production manager": "Production Manager",
  // Talent / styling
  "mua": "Make-up Artist", "make up": "Make-up Artist", "makeup": "Make-up Artist",
  stylist: "Stylist", styling: "Stylist", "造型": "Stylist",
};
const ROLE_KEYS = Object.keys(ROLE_MAP);
function cleanRole(r) {
  // normalise: trim, drop trailing dots, collapse spaces
  const k = String(r || "").trim().replace(/\.+$/, "").replace(/\s+/g, " ").trim();
  return ROLE_MAP[k.toLowerCase()] || ROLE_MAP[k] || k;
}

// Known people: when a handle appears, show the real name alongside it.
const PEOPLE = {
  "@lsn_1012": "Chris Leung", "lsn_1012": "Chris Leung",
  "@laukit.find": "Lau Kit", "laukit.find": "Lau Kit",
};
function applyPeople(name) {
  let out = String(name || "");
  for (const [handle, real] of Object.entries(PEOPLE)) {
    if (out.toLowerCase().includes(handle.toLowerCase()) && !out.includes(real)) {
      out = real + " " + out;
    }
  }
  return out;
}
// Christina's own aliases — used to auto-detect which credit row is hers.
const MY_ALIASES = ["christina", "dings424", "dingsfafa", "dings"];
// Parse a pasted block of credits into [{role,name}].
function parseCredits(text) {
  const out = [];
  String(text || "")
    .split(/\r?\n/)
    .forEach((raw) => {
      const line = raw.trim().replace(/^[-•*·]\s+/, ""); // strip leading bullet
      if (!line) return;
      // delimiter: colon (en/zh), pipe (en/zh), tab, or " - "
      let parts = line.split(/\s*[:：|｜]\s*|\t+|\s+[-–—]\s+/);
      let role = "", name = "";
      if (parts.length >= 2 && parts[0].trim()) {
        role = parts[0].trim();
        name = parts.slice(1).join(" ").trim();
      } else {
        // no delimiter: see if it starts with a known role word
        const first = line.split(/\s+/)[0];
        if (ROLE_MAP[first.toLowerCase()] || ROLE_MAP[first]) {
          role = first;
          name = line.slice(first.length).trim();
        } else {
          name = line; // unknown line -> keep as a name-only row
        }
      }
      if (name || role) out.push({ role: cleanRole(role), name: applyPeople(name) });
    });
  return out;
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
      <span class="left">
        <span class="no">#${i + 1}</span>
        <span class="drag" draggable="true" title="拖我嚟排序">⠿ 拖</span>
      </span>
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
            <label>你嘅崗位 <span class="en">Your Role（張卡會顯示）</span></label>
            <input class="f-role" list="roleList" value="${esc(f.role || "")}" placeholder="例：Director / Editor / AD">
            <div class="help">留空就淨係顯示類型</div>
          </div>
        </div>
        <div>
          <label>YouTube 片 ID</label>
          <input class="f-yt" value="${esc(f.youtube)}" placeholder="9bZkp7q19f0">
          <div class="help">網址 watch?v= 後面嗰串字</div>
        </div>
        <div class="credits">
          <label>Credit 名單 <span class="en">（選填，例：Director / DP / Client）</span></label>
          <div class="creditList">${creditsHtml}</div>
          <button class="ghost tiny addCredit">＋ 加一個 credit</button>

          <div class="autofill">
            <label>✨ 貼上 credit 自動填</label>
            <input class="myname" placeholder="你個名（用嚟認出邊個崗位係你，例：Christina）" value="${esc(localStorage.getItem("ding_myname") || "")}">
            <textarea class="creditPaste" rows="5" placeholder="將整段 credit 貼上嚟，每行一個，例如：&#10;Director: 陳大文&#10;Editor: Christina Tsang&#10;DP: 李小明&#10;Client: HSBC"></textarea>
            <button class="ghost tiny doParse">自動填入 ↓</button>
          </div>
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
  const roleIn = $(".f-role", el);
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
  roleIn.oninput = () => { f.role = roleIn.value; };

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

  // drag-and-drop reorder (grab the ⠿ handle)
  const handle = $(".drag", el);
  handle.addEventListener("dragstart", (e) => {
    dragFrom = i;
    e.dataTransfer.effectAllowed = "move";
    el.classList.add("dragging");
  });
  handle.addEventListener("dragend", () => { el.classList.remove("dragging"); dragFrom = null; });
  el.addEventListener("dragover", (e) => { if (dragFrom !== null) { e.preventDefault(); e.dataTransfer.dropEffect = "move"; el.classList.add("dragover"); } });
  el.addEventListener("dragleave", () => el.classList.remove("dragover"));
  el.addEventListener("drop", (e) => {
    e.preventDefault();
    el.classList.remove("dragover");
    if (dragFrom === null || dragFrom === i) return;
    const [moved] = films.splice(dragFrom, 1);
    films.splice(i, 0, moved);
    dragFrom = null;
    render();
  });

  // credits
  f.credits = f.credits || [];
  $(".addCredit", el).onclick = () => { f.credits.push({ role: "", name: "" }); render(); };

  // auto-fill from pasted credit block
  const nameIn = $(".myname", el);
  nameIn.oninput = () => localStorage.setItem("ding_myname", nameIn.value.trim());
  $(".doParse", el).onclick = () => {
    const text = $(".creditPaste", el).value;
    const parsed = parseCredits(text);
    if (!parsed.length) { alert("貼唔到嘢，或者認唔到格式。試吓每行一個崗位，例：Dir | Laukit"); return; }
    // APPEND to whatever is already there (don't wipe rows you typed), skip duplicates
    const existing = (f.credits || []).filter((c) => (c.role || "").trim() || (c.name || "").trim());
    const seen = new Set(existing.map((c) => (c.role + "|" + c.name).toLowerCase()));
    const adds = parsed.filter((c) => !seen.has((c.role + "|" + c.name).toLowerCase()));
    f.credits = existing.concat(adds);
    // detect which credit is hers (by typed name OR her known handles) -> set the card role
    const typed = nameIn.value.trim().toLowerCase();
    const aliases = MY_ALIASES.concat(typed ? [typed] : []);
    const mine = f.credits.find((c) => aliases.some((a) => (c.name || "").toLowerCase().includes(a)));
    if (mine && mine.role) f.role = mine.role;
    $(".creditPaste", el).value = ""; // clear so a second paste won't double-add
    render();
    toast(`加咗 ${adds.length} 個 credit${mine ? "，崗位已認出" : ""}`);
  };
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
    role: f.role || "",
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
    if (f.role && f.role.trim()) o.role = f.role.trim();
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
