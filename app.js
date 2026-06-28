/* =========================================================================
   DINGSTUDIO — renders the film walls and project pages from films.json.
   No build step. Edit films.json to add work; everything else is automatic.

   Two tabs, decided by each film's `category`:
     FILMOGRAPHY  -> categories in FILMO_CATEGORIES (Music Video + Commercial)
     EVENT        -> category "EVENT"
   ========================================================================= */

const FILMO_CATEGORIES = ["MUSIC VIDEO", "COMMERCIAL"];

const TABS = {
  filmography: { label: "Filmography", page: "index.html", match: (c) => FILMO_CATEGORIES.includes(c) },
  events:      { label: "Events",      page: "event.html", match: (c) => c === "EVENT" },
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
    cards += `<a class="card reveal" style="animation-delay:${i * 45}ms"
                 href="work.html?v=${encodeURIComponent(f.slug)}"
                 aria-label="${esc(f.title)}">
      <span class="thumb">
        <img src="${thumb(f.youtube)}" alt="${esc(f.title)}" loading="lazy"
             onload="thumbCheck(this,'${esc(f.youtube)}')"
             onerror="thumbFallback(this,'${esc(f.youtube)}')">
      </span>
      <span class="meta">
        <span class="title">${esc(f.title)}</span>
        <span class="cat">${esc(f.category || "")}</span>
      </span>
    </a>`;
  });

  root.innerHTML = `<div class="wrap wall">
    <div class="grid">${cards || `<p class="note">Nothing here yet.</p>`}</div>
  </div>`;
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

  const yt =
    `https://www.youtube-nocookie.com/embed/${encodeURIComponent(film.youtube)}` +
    `?rel=0&modestbranding=1&color=white`;

  root.innerHTML = `<div class="wrap work reveal">
    <a class="back" href="${tab.page}">&larr; ${esc(tab.label)}</a>
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
  const filmo = document.getElementById("filmography");
  const events = document.getElementById("events");
  const work = document.getElementById("work");
  if (filmo) renderWall(filmo, "filmography");
  if (events) renderWall(events, "events");
  if (work) renderWork(work);
});
