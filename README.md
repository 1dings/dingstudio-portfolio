# DINGSTUDIO Portfolio

A clean, static film portfolio: filmography (grouped by category) + contact.
No build step, no framework. You maintain it by editing **one file: `films.json`**.

## How to add / edit a film

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
