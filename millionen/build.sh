#!/bin/sh
# Rebuild the film in one command: sh build.sh   (voices/ holds the vidIQ narration; data/land.json from: node data/make_land.mjs)
set -e
LIB=${LIB:-/root/lemo-opuscar}; export LIB
HERE=$(cd "$(dirname "$0")" && pwd); PY="$LIB/.venv/bin/python"
[ -f "$HERE/data/land.json" ] || (cd "$HERE" && npm install --silent && node data/make_land.mjs)
cd "$LIB"
node core/render/events.mjs "$HERE"
"$PY" "$HERE/mix.py"
node core/render/video.mjs "$HERE" --fps 60 --workers 3 --size 1080x1920 --out "$HERE/out/video.mp4"
sh "$HERE/mux6.sh" "$HERE/out/video.mp4" "$HERE/out/mix.wav" "$HERE/out/full.mp4"
ffmpeg -y -loglevel error -i "$HERE/out/full.mp4" -c:v libx264 -preset slow -crf 21 -pix_fmt yuv420p -c:a copy -movflags +faststart "$HERE/millionen.mp4"
"$PY" core/render/srt.py "$HERE/cues.json" "$HERE/subtitles_de.srt"
ffmpeg -y -loglevel error -ss 30.0 -i "$HERE/millionen.mp4" -frames:v 1 -q:v 2 "$HERE/poster.jpg"
