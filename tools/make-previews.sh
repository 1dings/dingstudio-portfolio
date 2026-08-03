#!/bin/bash
# Generate muted 4s hover-preview clips (assets/previews/<slug>.mp4) for every
# film in films.json that doesn't have one yet. Run after adding new videos:
#   ./tools/make-previews.sh
# Requires: jq, yt-dlp, ffmpeg. Clip = 4s taken ~35% into the video, 480p, no audio.
set -uo pipefail
cd "$(dirname "$0")/.."
mkdir -p assets/previews
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

jq -r '.[] | select(.youtube) | [.slug, .youtube] | @tsv' films.json |
while IFS=$'\t' read -r slug yt; do
  out="assets/previews/$slug.mp4"
  [ -s "$out" ] && continue
  dur=$(yt-dlp --no-update --print duration "https://youtu.be/$yt" 2>/dev/null | tail -1)
  case "$dur" in (''|*[!0-9]*) dur=30;; esac
  start=$(( dur * 35 / 100 ))
  end=$(( start + 6 ))                       # grab 6s, trim to 4 in encode
  if ! yt-dlp --no-update -q -f "bv*[height<=720]/bv*" \
        --download-sections "*${start}-${end}" --force-keyframes-at-cuts \
        -o "$TMP/$slug.%(ext)s" "https://youtu.be/$yt" 2>/dev/null; then
    echo "SKIP (download failed): $slug"; continue
  fi
  src=$(ls "$TMP/$slug".* 2>/dev/null | head -1)
  [ -z "$src" ] && { echo "SKIP (no file): $slug"; continue; }
  if ffmpeg -y -v error -i "$src" -t 4 -an \
        -vf "scale='if(gt(iw,ih),-2,480)':'if(gt(iw,ih),480,-2)'" \
        -c:v libx264 -preset veryfast -crf 28 -pix_fmt yuv420p -movflags +faststart \
        "$out"; then
    echo "OK: $slug ($(du -h "$out" | cut -f1 | tr -d ' '))"
  else
    rm -f "$out"; echo "SKIP (encode failed): $slug"
  fi
  rm -f "$TMP/$slug".*
done
echo "--- done: $(ls assets/previews | wc -l | tr -d ' ') previews"
