# DINGSTUDIO Portfolio Site — Design Spec

Date: 2026-06-28
Owner: Christina (DINGSTUDIO)
Reference: https://www.christianhaahs.com/ (filmography + contact only)

## Goal

A clean, minimal director/production-house portfolio website showing filmography
(grouped by category) and contact info. Inspired by christianhaahs.com but NOT a
100% clone — different typography and small tweaks to feel like DINGSTUDIO's own.

## Scope

In scope:
- FILMOGRAPHY home page: thumbnail grid grouped by category (MUSIC VIDEO, COMMERCIAL, EVENT, ...)
- Individual project pages: title + category + embedded video + optional credits
- CONTACT page
- Fully data-driven from one file (`films.json`) for easy self-maintenance

Out of scope (for now):
- PHOTOGRAPHY section (reference has it; user does not want it)
- Custom domain (decided later; launch on free Netlify subdomain first)
- CMS / admin backend (edit the JSON file directly)

## Tech & Architecture

Pure static site. Vanilla HTML/CSS/JS. No framework, no build step.

```
/
├─ index.html        FILMOGRAPHY home (category-grouped grid)
├─ work.html         Project page template (renders ?v=<slug>)
├─ contact.html      CONTACT
├─ films.json        The film list — the ONLY file the owner edits to add work
├─ app.js            Reads films.json, renders grid + project page
├─ styles.css        Styling
└─ assets/           Logo, og-image, etc.
```

### Data model (films.json)

Array of film objects:

```json
{
  "slug": "kiss-of-life-who-is-she",
  "title": "KISS OF LIFE 'Who is she' Official MV",
  "category": "MUSIC VIDEO",
  "youtube": "YOUTUBE_VIDEO_ID",
  "credits": [
    { "role": "Director", "name": "..." },
    { "role": "DP", "name": "..." }
  ]
}
```

- `youtube` is the 11-char video ID (from the YouTube URL). Thumbnails are pulled
  automatically from `https://img.youtube.com/vi/<id>/maxresdefault.jpg`.
- `credits` is OPTIONAL. If empty/missing, the project page omits the credits section.
- Category order on the home page follows a defined list; unknown categories append.

### Pages

1. **FILMOGRAPHY (index.html)**
   - Studio name/logo + nav (FILMOGRAPHY / CONTACT)
   - Films grouped under category headings, each a responsive thumbnail grid
   - Thumbnail = YouTube maxres image; hover = subtle zoom + title overlay
   - Click → `work.html?v=<slug>`

2. **Project page (work.html)**
   - Reads `?v=<slug>` from URL, finds film in films.json
   - Shows title, category tag, responsive 16:9 YouTube embed
   - Optional credits list below
   - Back link to filmography
   - Each film has its own shareable URL (good for sending to clients)

3. **CONTACT (contact.html)**
   - Email, Instagram, studio name, any other contact info

### Design direction

- Minimal black/white skeleton, large grid (keeps the premium portfolio feel)
- Typography is the main differentiator from the reference — pick a distinctive
  typeface (to be chosen with the owner during build, 2 options shown)
- Tuned spacing + hover motion so it doesn't read as a direct copy
- Mobile-responsive

### Video: YouTube (not Vimeo)

- Embedded via standard YouTube iframe with `rel=0` and `modestbranding` to reduce
  branding/related-video clutter. Swappable to Vimeo later (one embed change).

## Hosting & Deploy

- Free Netlify, drag-and-drop deploy → `dingstudio.netlify.app` (or chosen subdomain)
- HTTPS automatic, no ads, generous free bandwidth
- Custom domain attached later (note: `dingstudio.com` is already taken since 2011;
  candidates include `dingstudio.co`, `ding.studio`, etc.)
- Update workflow: edit `films.json` → re-deploy (drag folder to Netlify, or git push)

## Maintenance model

Owner adds a film by appending one object to `films.json`. No code changes needed.
Thumbnails auto-derive from the YouTube ID, so no image prep required.

## Open items (content the owner provides)

- Final category list and ordering
- Per-film: title, category, YouTube ID, credits (where available)
- Contact details (email / IG / etc.)
- Logo/wordmark (or use a styled text wordmark)
- Domain name decision (later)
```