/* =========================================================================
   DINGSTUDIO — renders the film walls and project pages from films.json.
   No build step. Edit films.json to add work; everything else is automatic.

   Two tabs, decided by each film's `category`:
     FILMOGRAPHY  -> categories in FILMO_CATEGORIES (Music Video + Commercial)
     EVENT        -> category "EVENT"
   ========================================================================= */

const FILMO_CATEGORIES = ["MUSIC VIDEO", "COMMERCIAL"];

const TABS = {
  filmography: { label: "Filmography",  page: "index.html", match: (c) => FILMO_CATEGORIES.includes(c) },
  reels:       { label: "Social Reels", page: "reels.html", match: (c) => c === "SOCIAL REELS" },
  events:      { label: "Events",       page: "event.html", match: (c) => c === "EVENT" },
};

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );

const pad = (n) => String(n).padStart(2, "0");

function thumb(id) {
  return `https://img.youtube.com/vi/${encodeURIComponent(id)}/maxresdefault.jpg`;
}
// hqdefault always exists; use it when maxres is missing. YouTube serves a
// 120x90 grey placeholder (HTTP 200, not 404) when maxres is absent, so we
// also detect that small size on load and downgrade.
function hqUrl(id) {
  return `https://img.youtube.com/vi/${encodeURIComponent(id)}/hqdefault.jpg`;
}
function thumbFallback(imgEl, id) {
  imgEl.onerror = null;
  imgEl.src = hqUrl(id);
}
function thumbCheck(imgEl, id) {
  if (!imgEl.dataset.hq && imgEl.naturalWidth && imgEl.naturalWidth <= 121) {
    imgEl.dataset.hq = "1";
    imgEl.src = hqUrl(id);
  }
}
window.thumbFallback = thumbFallback;
window.thumbCheck = thumbCheck;

// Vimeo helpers. `vimeo` field holds the numeric id (optionally "id/hash" for
// unlisted videos). vumbnail.com provides a thumbnail when none is set.
function vimeoParts(v) {
  const [id, hash] = String(v || "").split("/");
  return { id: id.trim(), hash: (hash || "").trim() };
}
function vimeoThumb(v) {
  return `https://vumbnail.com/${encodeURIComponent(vimeoParts(v).id)}.jpg`;
}
function vimeoEmbed(v) {
  const { id, hash } = vimeoParts(v);
  const h = hash ? `&h=${encodeURIComponent(hash)}` : "";
  return `https://player.vimeo.com/video/${encodeURIComponent(id)}?title=0&byline=0&portrait=0${h}`;
}

async function loadFilms() {
  const res = await fetch("films.json", { cache: "no-store" });
  if (!res.ok) throw new Error("films.json not found");
  return res.json();
}

const tabKeyOf = (cat) =>
  Object.keys(TABS).find((k) => TABS[k].match((cat || "").toUpperCase())) || "filmography";

/* ----------------------- Film wall (one continuous grid) ----------------------- */
async function renderWall(root, tabKey) {
  let films;
  try {
    films = await loadFilms();
  } catch (e) {
    root.innerHTML = `<div class="wrap"><p class="note">Could not load films.json — ${esc(e.message)}</p></div>`;
    return;
  }

  const tab = TABS[tabKey];
  const items = films.filter((f) => tab.match((f.category || "").toUpperCase()));

  let cards = "";
  items.forEach((f, i) => {
    // Thumbnail priority: custom thumb -> Vimeo (vumbnail) -> YouTube auto.
    const custom = f.thumb && String(f.thumb).trim();
    let img;
    if (custom) {
      img = `<img src="${esc(f.thumb)}" alt="${esc(f.title)}" loading="lazy">`;
    } else if (f.vimeo) {
      img = `<img src="${esc(vimeoThumb(f.vimeo))}" alt="${esc(f.title)}" loading="lazy">`;
    } else {
      img = `<img src="${thumb(f.youtube)}" alt="${esc(f.title)}" loading="lazy"
             onload="thumbCheck(this,'${esc(f.youtube)}')"
             onerror="thumbFallback(this,'${esc(f.youtube)}')">`;
    }
    cards += `<a class="card reveal" style="animation-delay:${i * 45}ms"
                 href="work.html?v=${encodeURIComponent(f.slug)}"
                 aria-label="${esc(f.title)}">
      <span class="thumb">
        ${img}
      </span>
      <span class="meta">
        <span class="title">${esc(f.title)}</span>
        <span class="cat">${esc([f.role, f.category].filter(Boolean).join(" · "))}</span>
      </span>
    </a>`;
  });

  root.innerHTML = `<div class="wrap wall">
    <div class="grid">${cards || `<p class="note">Nothing here yet.</p>`}</div>
  </div>`;
}

/* ----------------------- Social Reels (9:16 wall + lightbox) ----------------------- */
function thumbImg(f) {
  const custom = f.thumb && String(f.thumb).trim();
  if (custom) return `<img src="${esc(f.thumb)}" alt="${esc(f.title)}" loading="lazy">`;
  if (f.vimeo) return `<img src="${esc(vimeoThumb(f.vimeo))}" alt="${esc(f.title)}" loading="lazy">`;
  return `<img src="${thumb(f.youtube)}" alt="${esc(f.title)}" loading="lazy"
            onload="thumbCheck(this,'${esc(f.youtube)}')"
            onerror="thumbFallback(this,'${esc(f.youtube)}')">`;
}

async function renderReels(root) {
  let films;
  try {
    films = await loadFilms();
  } catch (e) {
    root.innerHTML = `<div class="wrap"><p class="note">Could not load films.json — ${esc(e.message)}</p></div>`;
    return;
  }

  const items = films.filter((f) => (f.category || "").toUpperCase() === "SOCIAL REELS");

  let cards = "";
  items.forEach((f, i) => {
    cards += `<button class="reel reveal" style="animation-delay:${i * 45}ms"
                data-yt="${esc(f.youtube || "")}" data-vimeo="${esc(f.vimeo || "")}"
                data-slug="${esc(f.slug)}" data-title="${esc(f.title)}"
                aria-label="Play ${esc(f.title)}">
      <span class="thumb">
        ${thumbImg(f)}
        <span class="play"><svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></span>
      </span>
      <span class="meta">
        <span class="title">${esc(f.title)}</span>
        <span class="cat">${esc(f.role || "")}</span>
      </span>
    </button>`;
  });

  root.innerHTML = `<div class="wrap wall">
    <div class="reelgrid">${cards || `<p class="note">Nothing here yet.</p>`}</div>
  </div>`;

  root.querySelectorAll(".reel").forEach((btn) =>
    btn.addEventListener("click", () => openReel(btn.dataset))
  );
}

function ensureLightbox() {
  let lb = document.getElementById("lightbox");
  if (lb) return lb;
  lb = document.createElement("div");
  lb.id = "lightbox";
  lb.className = "lightbox";
  lb.innerHTML = `
    <div class="lb-backdrop" data-close></div>
    <div class="lb-inner">
      <button class="lb-close" data-close aria-label="Close">&times;</button>
      <div class="lb-frame"><div class="lb-player"></div></div>
      <div class="lb-cap">
        <span class="lb-title"></span>
        <a class="lb-credits mono" href="#">View credits &rarr;</a>
      </div>
    </div>`;
  document.body.appendChild(lb);
  lb.addEventListener("click", (e) => { if (e.target.hasAttribute("data-close")) closeReel(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeReel(); });
  return lb;
}

function openReel(d) {
  const lb = ensureLightbox();
  const src = d.vimeo
    ? vimeoEmbed(d.vimeo) + "&autoplay=1"
    : `https://www.youtube-nocookie.com/embed/${encodeURIComponent(d.yt)}?rel=0&modestbranding=1&autoplay=1&playsinline=1&color=white`;
  lb.querySelector(".lb-player").innerHTML =
    `<iframe src="${src}" title="${esc(d.title)}"
       allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
       allowfullscreen></iframe>`;
  lb.querySelector(".lb-title").textContent = d.title;
  lb.querySelector(".lb-credits").href = `work.html?v=${encodeURIComponent(d.slug)}`;
  lb.classList.add("open");
  document.body.style.overflow = "hidden";
}

function closeReel() {
  const lb = document.getElementById("lightbox");
  if (!lb) return;
  lb.classList.remove("open");
  lb.querySelector(".lb-player").innerHTML = "";   // unload iframe -> stops playback
  document.body.style.overflow = "";
}

/* ----------------------- Project page ----------------------- */
async function renderWork(root) {
  const slug = new URLSearchParams(location.search).get("v");
  let films;
  try {
    films = await loadFilms();
  } catch (e) {
    root.innerHTML = `<div class="wrap work"><p class="note">Could not load films.json.</p></div>`;
    return;
  }

  const film = films.find((f) => f.slug === slug);
  if (!film) {
    root.innerHTML = `<div class="wrap work">
      <a class="back" href="index.html">&larr; Back</a>
      <h1>Not found</h1></div>`;
    return;
  }

  document.title = `${film.title} — DINGSTUDIO`;

  // siblings within the same tab, for back-link + prev/next
  const tabKey = tabKeyOf(film.category);
  const tab = TABS[tabKey];
  const sibs = films.filter((f) => tab.match((f.category || "").toUpperCase()));
  const idx = sibs.findIndex((f) => f.slug === film.slug);
  const prev = sibs[idx - 1];
  const next = sibs[idx + 1];

  const credits = Array.isArray(film.credits) ? film.credits.filter((c) => c && c.name && c.name !== "—") : [];
  const creditsHtml = credits.length
    ? `<dl class="credits">${credits
        .map((c) => `<div class="row"><dt>${esc(c.role)}</dt><dd>${esc(c.name)}</dd></div>`)
        .join("")}</dl>`
    : "";

  const link = (f, cls, lab) =>
    f
      ? `<a class="${cls}" href="work.html?v=${encodeURIComponent(f.slug)}">
           <span class="mono lab">${lab}</span><span class="t">${esc(f.title)}</span></a>`
      : `<span></span>`;

  const embed = film.vimeo
    ? vimeoEmbed(film.vimeo)
    : `https://www.youtube-nocookie.com/embed/${encodeURIComponent(film.youtube)}?rel=0&modestbranding=1&color=white`;

  const vertical = (film.category || "").toUpperCase() === "SOCIAL REELS";

  root.innerHTML = `<div class="wrap work reveal">
    <a class="back" href="${tab.page}">&larr; ${esc(tab.label)}</a>
    <p class="mono tag">${esc([film.category, film.role].filter(Boolean).join(" · "))}</p>
    <h1>${esc(film.title)}</h1>
    <div class="player${vertical ? " vertical" : ""}">
      <iframe src="${embed}" title="${esc(film.title)}"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowfullscreen></iframe>
    </div>
    ${creditsHtml}
    <nav class="pager">
      ${link(prev, "prev", "Prev")}
      ${link(next, "next", "Next")}
    </nav>
  </div>`;
}

/* ----------------------- boot ----------------------- */
document.addEventListener("DOMContentLoaded", () => {
  const filmo = document.getElementById("filmography");
  const reels = document.getElementById("reels");
  const events = document.getElementById("events");
  const work = document.getElementById("work");
  if (filmo) renderWall(filmo, "filmography");
  if (reels) renderReels(reels);
  if (events) renderWall(events, "events");
  if (work) renderWork(work);
});
