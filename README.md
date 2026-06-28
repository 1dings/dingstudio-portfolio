# DINGSTUDIO Portfolio

A clean, static film portfolio: filmography (grouped by category) + contact.
No build step, no framework. You maintain it by editing **one file: `films.json`**.

## Easiest way to edit: the visual editor (admin.html)

Open **`admin.html`** through the local server (`http://localhost:8000/admin.html`).
It loads your current films, gives you a form for every field — title, category,
YouTube ID, thumbnail, credits (add/remove rows), reorder, delete — then click
**Download films.json** and replace the file in this folder. No JSON editing by hand.

(If you opened it without the server and it didn't auto-load, click **Load films.json**
and pick the file.)

## Custom thumbnail (replace an ugly auto thumbnail)

Drop an image (jpg/png, ideally 1280×720 / 16:9) into **`assets/thumbs/`**, then set the
film's `thumb` to its path, e.g. `assets/thumbs/my-film.jpg` (the editor has a box for
this). Leave it blank to use the automatic YouTube thumbnail.

## How to add / edit a film (by hand)

Open `films.json` and add an object to the list:

```json
{
  "slug": "kebab-case-unique-id",
  "title": "Artist — Track (Official MV)",
  "category": "MUSIC VIDEO",
  "youtube": "VIDEO_ID",
  "credits": [
    { "role": "Director", "name": "Christina Tsang" },
    { "role": "DP", "name": "..." }
  ]
}
```

Rules:
- **`youtube`** = the 11-character video ID. From a URL like
  `https://www.youtube.com/watch?v=9bZkp7q19f0` the ID is `9bZkp7q19f0`.
  The thumbnail is pulled automatically — you do NOT need to upload images.
- **`category`** decides which TAB the film shows under:
  - `"MUSIC VIDEO"` or `"COMMERCIAL"` → the **FILMOGRAPHY** tab (`index.html`)
  - `"EVENT"` → the **EVENT** tab (`event.html`)
  - Each tab is one continuous wall of 16:9 thumbnails, in the order they appear
    in `films.json`. The tab mapping lives in `app.js` (`FILMO_CATEGORIES` / `TABS`).
- **`thumb`** = optional custom thumbnail path (e.g. `assets/thumbs/my-film.jpg`).
  Overrides the auto YouTube thumbnail. Omit to use the YouTube one.
- **`credits`** = optional. Leave it `[]` (or remove it) and the credits section
  just won't show. Add as many `{ role, name }` rows as you have.
- **`slug`** = a unique id used in the URL (`work.html?v=slug`). Keep it simple.

The entries currently in `films.json` are a **DEMO selection** pulled from your
YouTube playlists, with titles tidied up. Swap in your final picks.

## Edit contact details

Open `contact.html` and edit the block marked `<!-- EDIT THESE -->`
(email, Instagram, location).

## Preview locally

Because the site fetches `films.json`, open it through a tiny local server
(not by double-clicking the file):

```bash
cd dingstudio-portfolio
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Deploy to Netlify (free)

1. Go to https://app.netlify.com/drop
2. Drag this whole `dingstudio-portfolio` folder onto the page.
3. Done — you get a free `something.netlify.app` address with HTTPS.
4. To update: drag the folder again, or connect it to a Git repo.

Attach a custom domain later in Netlify → Domain settings.

## Restyle

All typography lives in CSS variables at the top of `styles.css`
(`--font-display`, `--font-body`, `--font-mono`) and the colours just below.
Change them in one place to restyle the whole site.
