#!/usr/bin/env python3
"""Generate the crawlable layer of the site from films.json.

The site renders everything client side from films.json, so a crawler that
doesn't run JS sees an empty "Loading…" page. This writes the same content out
as real HTML so it can be indexed, and keeps it in sync on every commit:

  robots.txt          allow-all + sitemap pointer
  sitemap.xml         home, contact, and one URL per film
  index.html          film wall pre-rendered between SEO markers, + JSON-LD
  work/<slug>.html    a real page per film: own title, description, OG,
                      VideoObject JSON-LD, credits as HTML
  _redirects          301 the old work.html?v=<slug> links to work/<slug>.html

The pre-rendered markup mirrors what app.js builds, so the crawler and the
visitor get the same thing; app.js simply replaces it once it loads.

Run:  ./tools/build-seo.py        (the pre-commit hook runs it for you)
"""

import html
import json
import os
import re
import sys
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = "https://dingstudiohk.com"
STUDIO = "DINGSTUDIO"
TODAY = date.today().isoformat()

FILMO = {"MUSIC VIDEO", "COMMERCIAL"}
SECTIONS = [
    ("filmography", "Filmography", "Music videos & commercials", lambda c: c in FILMO),
    ("reels", "Social Reels", "Vertical films", lambda c: c == "SOCIAL REELS"),
    ("events", "Event", "Events & same-day edits", lambda c: c == "EVENT"),
]


def e(s):
    return html.escape(str(s or ""), quote=True)


def _thumb_path(f):
    """A real path for the film's thumbnail, or None.

    A few films carry their custom thumb inline as a base64 data: URI. Those
    are fine for app.js to drop into an <img>, but they are not a URL: they
    can't go in og:image or JSON-LD, and at 50-165KB they would bloat every
    generated page. Fall back to the YouTube still for those.
    """
    t = str(f.get("thumb") or "").strip()
    if t and not t.startswith("data:"):
        return "/" + t.lstrip("/")
    return None


def img_src(f):
    """Root-relative or external URL for an <img> in generated HTML."""
    p = _thumb_path(f)
    if p:
        return p
    if f.get("youtube"):
        return f"https://img.youtube.com/vi/{f['youtube']}/maxresdefault.jpg"
    return "/assets/og.png"


def thumb_url(f):
    """Absolute URL, for og:image and JSON-LD."""
    src = img_src(f)
    return src if src.startswith("http") else SITE + src


def credit_names(f):
    return [c.get("name", "") for c in (f.get("credits") or []) if c.get("name")]


def film_desc(f):
    """One sentence a search result can show."""
    bits = [f.get("title", "")]
    if f.get("role"):
        bits.append(f"{f['role']} — Christina Tsang, {STUDIO}")
    cat = (f.get("category") or "").title()
    if cat:
        bits.append(f"{cat}, Hong Kong")
    return " · ".join(b for b in bits if b)


# ---------------------------------------------------------------- robots.txt

def write_robots():
    body = "\n".join([
        "User-agent: *",
        "Allow: /",
        "",
        f"Sitemap: {SITE}/sitemap.xml",
        "",
    ])
    with open(os.path.join(ROOT, "robots.txt"), "w") as fh:
        fh.write(body)


# --------------------------------------------------------------- sitemap.xml

def write_sitemap(films):
    urls = [(f"{SITE}/", "1.0"), (f"{SITE}/contact.html", "0.5")]
    urls += [(f"{SITE}/work/{f['slug']}.html", "0.8") for f in films]
    rows = "\n".join(
        f"  <url><loc>{e(u)}</loc><lastmod>{TODAY}</lastmod><priority>{p}</priority></url>"
        for u, p in urls
    )
    with open(os.path.join(ROOT, "sitemap.xml"), "w") as fh:
        fh.write(
            '<?xml version="1.0" encoding="UTF-8"?>\n'
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
            f"{rows}\n</urlset>\n"
        )


# ----------------------------------------------------------------- _redirects

def write_redirects():
    """Old ?v= links keep working; one canonical URL per film."""
    with open(os.path.join(ROOT, "_redirects"), "w") as fh:
        fh.write(
            "# work.html?v=<slug> was the film URL before each film got its own\n"
            "# page. Netlify matches the query param and 301s to the new path.\n"
            "/work.html  v=:slug  /work/:slug.html  301!\n"
        )


# ------------------------------------------------------- pre-rendered markup

def card_html(f):
    tall = " tall" if f.get("vertical") else ""
    sub = " · ".join(x for x in [f.get("role"), f.get("category")] if x)
    return (
        f'<a class="card{tall}" href="work/{e(f["slug"])}.html">'
        f'<span class="thumb"><img src="{e(img_src(f))}" alt="{e(f["title"])}" loading="lazy"></span>'
        f'<span class="meta"><span class="title">{e(f["title"])}</span>'
        f'<span class="cat">{e(sub)}</span></span></a>'
    )


def home_block(films):
    out = []
    for i, (sid, label, sub, match) in enumerate(SECTIONS, start=1):
        items = [f for f in films if match((f.get("category") or "").upper())]
        if not items:
            continue
        cards = "".join(card_html(f) for f in items)
        out.append(
            f'<section id="{sid}" class="sec"><header class="sec-head">'
            f'<div class="sec-row"><h2 class="sec-title">{e(label)}</h2><span class="sec-line"></span></div>'
            f'<span class="sec-sub mono">{i:02d} · {e(sub)}</span></header>'
            f'<div class="wrap wall"><div class="grid">{cards}</div></div></section>'
        )
    return "\n".join(out)


def studio_jsonld(films):
    return json.dumps(
        {
            "@context": "https://schema.org",
            "@type": "ProfessionalService",
            "name": STUDIO,
            "url": SITE + "/",
            "image": f"{SITE}/assets/og.png",
            "description": (
                "DINGSTUDIO is a Hong Kong film and video production studio led by "
                "Christina Tsang, working as director, video editor and assistant "
                "director on commercials, brand films, music videos, event films "
                "and social reels."
            ),
            "founder": {"@type": "Person", "name": "Christina Tsang", "jobTitle": "Director / Video Editor"},
            "areaServed": {"@type": "Place", "name": "Hong Kong"},
            "address": {"@type": "PostalAddress", "addressLocality": "Hong Kong", "addressCountry": "HK"},
            "email": "info@dingstudiohk.com",
            "sameAs": ["https://instagram.com/dingsfafa"],
            "knowsAbout": ["Video editing", "Film direction", "Commercial production",
                           "Brand films", "Music videos", "Event films", "Social reels"],
            "numberOfItems": len(films),
        },
        ensure_ascii=False, separators=(",", ":"),
    )


def film_jsonld(f):
    d = {
        "@context": "https://schema.org",
        "@type": "VideoObject",
        "name": f.get("title", ""),
        "description": film_desc(f),
        "thumbnailUrl": thumb_url(f),
        "url": f"{SITE}/work/{f['slug']}.html",
        "creator": {"@type": "Organization", "name": STUDIO, "url": SITE + "/"},
    }
    if f.get("youtube"):
        d["embedUrl"] = f"https://www.youtube.com/embed/{f['youtube']}"
    names = credit_names(f)
    if names:
        d["contributor"] = [{"@type": "Person", "name": n} for n in names]
    return json.dumps(d, ensure_ascii=False, separators=(",", ":"))


# --------------------------------------------------------- html file surgery

def swap(text, marker, payload):
    """Replace everything between <!--marker:START--> and <!--marker:END-->."""
    start, end = f"<!-- {marker}:START -->", f"<!-- {marker}:END -->"
    block = f"{start}\n{payload}\n{end}"
    if start in text and end in text:
        return re.sub(re.escape(start) + r".*?" + re.escape(end), lambda _: block, text, flags=re.S)
    return None


def set_head(text, title, desc, canonical):
    text = re.sub(r"<title>.*?</title>", f"<title>{e(title)}</title>", text, count=1, flags=re.S)
    text = re.sub(r'(<meta name="description" content=")[^"]*(">)',
                  lambda m: m.group(1) + e(desc) + m.group(2), text, count=1)
    text = re.sub(r'(<meta property="og:title" content=")[^"]*(">)',
                  lambda m: m.group(1) + e(title) + m.group(2), text, count=1)
    text = re.sub(r'(<meta property="og:description" content=")[^"]*(">)',
                  lambda m: m.group(1) + e(desc) + m.group(2), text, count=1)
    if 'rel="canonical"' not in text:
        text = text.replace("</head>", f'  <link rel="canonical" href="{e(canonical)}">\n</head>', 1)
    else:
        text = re.sub(r'(<link rel="canonical" href=")[^"]*(">)',
                      lambda m: m.group(1) + e(canonical) + m.group(2), text, count=1)
    return text


TITLE = "Video Editor & Director in Hong Kong — DINGSTUDIO"
DESC = ("DINGSTUDIO is a Hong Kong video editor and director led by Christina Tsang. "
        "Commercials, brand films, music videos, event films and social reels for "
        "HSBC, Cathay Pacific, McDonald's, Lee Kum Kee, Christie's and more.")


def build_index(films):
    path = os.path.join(ROOT, "index.html")
    text = open(path).read()
    text = set_head(text, TITLE, DESC, SITE + "/")

    jsonld = f'<script type="application/ld+json">{studio_jsonld(films)}</script>'
    out = swap(text, "SEO:JSONLD", jsonld)
    if out is None:
        text = text.replace("</head>",
                            f"  <!-- SEO:JSONLD:START -->\n{jsonld}\n  <!-- SEO:JSONLD:END -->\n</head>", 1)
    else:
        text = out

    body = home_block(films)
    out = swap(text, "SEO:HOME", body)
    if out is None:
        text = re.sub(r'(<main id="home">).*?(</main>)',
                      lambda m: f'{m.group(1)}\n<!-- SEO:HOME:START -->\n{body}\n<!-- SEO:HOME:END -->\n{m.group(2)}',
                      text, count=1, flags=re.S)
    else:
        text = out

    open(path, "w").write(text)


def build_contact():
    path = os.path.join(ROOT, "contact.html")
    text = open(path).read()
    text = set_head(
        text,
        "Contact — DINGSTUDIO, Hong Kong Video Editor & Director",
        "Get in touch with DINGSTUDIO for video editing, directing and post production in Hong Kong. "
        "Email info@dingstudiohk.com or find us on Instagram @dingsfafa.",
        SITE + "/contact.html",
    )
    open(path, "w").write(text)


FILM_PAGE = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title>{title} — DINGSTUDIO</title>
  <meta name="description" content="{desc}">
  <link rel="canonical" href="{url}">
  <meta property="og:title" content="{title} — DINGSTUDIO">
  <meta property="og:type" content="video.other">
  <meta property="og:url" content="{url}">
  <meta property="og:description" content="{desc}">
  <meta property="og:image" content="{thumb}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="theme-color" content="#f5f3ee" media="(prefers-color-scheme: light)">
  <meta name="theme-color" content="#0c0b0a" media="(prefers-color-scheme: dark)">
  <link rel="icon" href="/assets/icon/favicon.svg" type="image/svg+xml">
  <link rel="icon" href="/assets/icon/favicon-32.png" sizes="32x32" type="image/png">
  <link rel="icon" href="/assets/icon/favicon-192.png" sizes="192x192" type="image/png">
  <link rel="apple-touch-icon" href="/assets/icon/apple-touch-icon.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,700;12..96,800&family=Schibsted+Grotesk:ital,wght@0,400;0,500;1,400&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/styles.css?v=16">
  <script type="application/ld+json">{jsonld}</script>
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-PCXZXL6ZTE"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){{dataLayer.push(arguments);}}
    gtag('js', new Date());
    gtag('config', 'G-PCXZXL6ZTE');
  </script>
</head>
<body>
  <header class="site-head">
    <nav class="nav nav-left">
      <a href="/#filmography">Filmography</a>
      <a href="/#reels">Social Reels</a>
      <a href="/#events">Event</a>
      <a href="/contact.html">Contact</a>
    </nav>
    <a class="wordmark" href="/">DINGSTUDIO<span>.</span></a>
    <div class="head-right">
      <a class="ig" href="https://instagram.com/dingsfafa" target="_blank" rel="noopener" aria-label="Instagram @dingsfafa">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6">
          <rect x="3" y="3" width="18" height="18" rx="5"></rect>
          <circle cx="12" cy="12" r="4"></circle>
          <circle cx="17.2" cy="6.8" r="1.15" fill="currentColor" stroke="none"></circle>
        </svg>
      </a>
    </div>
  </header>

  <main id="work">
    <div class="wrap work">
      <a class="back" href="{back}">&larr; {backlabel}</a>
      <p class="mono tag">{tag}</p>
      <h1>{title}</h1>
      <div class="player{vertical}">
        <iframe src="{embed}" title="{title}" loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowfullscreen></iframe>
      </div>
      {credits}
      <nav class="pager">{prev}{next}</nav>
    </div>
  </main>

  <footer class="site-foot">
    <span class="mono">&copy; DINGSTUDIO</span>
    <span class="mono">Hong Kong</span>
  </footer>
</body>
</html>
"""

BACK = {
    "filmography": ("/#filmography", "Filmography"),
    "reels": ("/#reels", "Social Reels"),
    "events": ("/#events", "Event"),
}


def section_of(cat):
    cat = (cat or "").upper()
    for sid, _, _, match in SECTIONS:
        if match(cat):
            return sid
    return "filmography"


def build_film_pages(films):
    outdir = os.path.join(ROOT, "work")
    os.makedirs(outdir, exist_ok=True)

    wanted = set()
    for f in films:
        sid = section_of(f.get("category"))
        sibs = [x for x in films if section_of(x.get("category")) == sid]
        i = next(n for n, x in enumerate(sibs) if x["slug"] == f["slug"])

        def pager(g, cls, lab):
            if not g:
                return "<span></span>"
            return (f'<a class="{cls}" href="/work/{e(g["slug"])}.html">'
                    f'<span class="pg-thumb"><img src="{e(img_src(g))}" alt="{e(g["title"])}" loading="lazy"></span>'
                    f'<span class="pg-info"><span class="mono lab">{lab}</span>'
                    f'<span class="t">{e(g["title"])}</span></span></a>')

        rows = "".join(
            f'<div class="row"><dt>{e(c.get("role"))}</dt><dd>{e(c.get("name"))}</dd></div>'
            for c in (f.get("credits") or []) if c.get("name") and c.get("name") != "—"
        )
        back, backlabel = BACK[sid]
        vertical = " vertical" if (f.get("vertical") or (f.get("category") or "").upper() == "SOCIAL REELS") else ""
        embed = (f"https://www.youtube-nocookie.com/embed/{e(f['youtube'])}?rel=0&amp;modestbranding=1&amp;color=white"
                 if f.get("youtube") else "")

        page = FILM_PAGE.format(
            title=e(f.get("title", "")),
            desc=e(film_desc(f)),
            url=f"{SITE}/work/{e(f['slug'])}.html",
            thumb=e(thumb_url(f)),
            jsonld=film_jsonld(f),
            back=back, backlabel=backlabel,
            tag=e(" · ".join(x for x in [f.get("category"), f.get("role")] if x)),
            vertical=vertical, embed=embed,
            credits=f'<dl class="credits">{rows}</dl>' if rows else "",
            prev=pager(sibs[i - 1] if i > 0 else None, "prev", "Prev"),
            next=pager(sibs[i + 1] if i + 1 < len(sibs) else None, "next", "Next"),
        )
        name = f"{f['slug']}.html"
        wanted.add(name)
        open(os.path.join(outdir, name), "w").write(page)

    # drop pages for films that no longer exist
    for stale in set(os.listdir(outdir)) - wanted:
        if stale.endswith(".html"):
            os.remove(os.path.join(outdir, stale))

    return len(wanted)


def main():
    films = json.load(open(os.path.join(ROOT, "films.json")))
    films = [f for f in films if f.get("slug")]
    write_robots()
    write_sitemap(films)
    write_redirects()
    build_index(films)
    build_contact()
    n = build_film_pages(films)
    print(f"seo: {len(films)} films · {n} film pages · sitemap {len(films) + 2} urls")


if __name__ == "__main__":
    sys.exit(main())
