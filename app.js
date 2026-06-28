/* =========================================================================
   DINGSTUDIO — renders the filmography grid and the project page from films.json
   No build step. Edit films.json to add work; everything else is automatic.
   ========================================================================= */

// Order categories appear on the home page. Unknown categories append at the end.
const CATEGORY_ORDER = ["MUSIC VIDEO", "COMMERCIAL", "EVENT"];

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );

const pad = (n) => String(n).padStart(2, "0");

// YouTube thumbnail with graceful fallback (maxres -> hq).
function thumb(id) {
  return `https://img.youtube.com/vi/${encodeURIComponent(id)}/maxresdefault.jpg`;
}
function thumbFallback(imgEl, id) {
  imgEl.onerror = null;
  imgEl.src = `https://img.youtube.com/vi/${encodeURIComponent(id)}/hqdefault.jpg`;
}

async function loadFilms() {
  const res = await fetch("films.json", { cache: "no-store" });
  if (!res.ok) throw new Error("films.json not found");
  return res.json();
}

/* ----------------------- Home: filmography grid ----------------------- */
async function renderHome(root) {
  let films;
  try {
    films = await loadFilms();
  } catch (e) {
    root.innerHTML = `<p class="note">Could not load films.json — ${esc(e.message)}</p>`;
    return;
  }

  // Group by category, preserving CATEGORY_ORDER then any extras.
  const groups = {};
  films.forEach((f) => {
    const k = (f.category || "OTHER").toUpperCase();
    (groups[k] = groups[k] || []).push(f);
  });
  const cats = [
    ...CATEGORY_ORDER.filter((c) => groups[c]),
    ...Object.keys(groups).filter((c) => !CATEGORY_ORDER.includes(c)).sort(),
  ];

  let html = "";
  let revealDelay = 0;
  cats.forEach((cat) => {
    const items = groups[cat];
    html += `<section class="cat"><div class="wrap">
      <div class="cat-head">
        <h2>${esc(cat)}</h2>
        <span class="mono count">${pad(items.length)} ${items.length === 1 ? "Film" : "Films"}</span>
      </div>
      <div class="grid">`;
    items.forEach((f, i) => {
      revealDelay += 50;
      html += `<a class="card reveal" style="animation-delay:${revealDelay}ms"
                  href="work.html?v=${encodeURIComponent(f.slug)}"
                  aria-label="${esc(f.title)}">
        <span class="thumb">
          <img src="${thumb(f.youtube)}" alt="${esc(f.title)}" loading="lazy"
               onerror="thumbFallback(this,'${esc(f.youtube)}')">
        </span>
        <span class="meta">
          <span class="idx">${pad(i + 1)}</span>
          <span class="title">${esc(f.title)}</span>
        </span>
      </a>`;
    });
    html += `</div></div></section>`;
  });

  root.innerHTML = html || `<p class="note wrap">No films yet — add some to films.json.</p>`;
  window.thumbFallback = thumbFallback;
}

/* ----------------------- Project page ----------------------- */
async function renderWork(root) {
  const slug = new URLSearchParams(location.search).get("v");
  let films;
  try {
    films = await loadFilms();
  } catch (e) {
    root.innerHTML = `<div class="wrap"><p class="note">Could not load films.json.</p></div>`;
    return;
  }

  const idx = films.findIndex((f) => f.slug === slug);
  const film = films[idx];
  if (!film) {
    root.innerHTML = `<div class="wrap work">
      <a class="back" href="index.html">&larr; Filmography</a>
      <h1>Not found</h1></div>`;
    return;
  }

  document.title = `${film.title} — DINGSTUDIO`;

  const credits = Array.isArray(film.credits) ? film.credits.filter((c) => c && c.name) : [];
  const creditsHtml = credits.length
    ? `<dl class="credits">${credits
        .map((c) => `<div class="row"><dt>${esc(c.role)}</dt><dd>${esc(c.name)}</dd></div>`)
        .join("")}</dl>`
    : "";

  const prev = films[idx - 1];
  const next = films[idx + 1];
  const link = (f, cls, lab) =>
    f
      ? `<a class="${cls}" href="work.html?v=${encodeURIComponent(f.slug)}">
           <span class="mono lab">${lab}</span><span class="t">${esc(f.title)}</span></a>`
      : `<span></span>`;

  const yt =
    `https://www.youtube-nocookie.com/embed/${encodeURIComponent(film.youtube)}` +
    `?rel=0&modestbranding=1&color=white`;

  root.innerHTML = `<div class="wrap work reveal">
    <a class="back" href="index.html">&larr; Filmography</a>
    <p class="mono tag">${esc(film.category || "")}</p>
    <h1>${esc(film.title)}</h1>
    <div class="player">
      <iframe src="${yt}" title="${esc(film.title)}"
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
  const home = document.getElementById("filmography");
  const work = document.getElementById("work");
  if (home) renderHome(home);
  if (work) renderWork(work);
});
