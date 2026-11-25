#!/bin/sh
# Rebuild the film in one command: sh build.sh   (voices/ holds the vidIQ narration, downloaded once)
set -e
LIB=${LIB:-/root/lemo-opuscar}; export LIB
HERE=$(cd "$(dirname "$0")" && pwd); PY="$LIB/.venv/bin/python"
cd "$LIB"
node core/render/events.mjs "$HERE"
"$PY" "$HERE/mix.py"
node core/render/video.mjs "$HERE" --fps 30 --workers 3 --size 1080x1920 --out "$HERE/out/video.mp4"
sh "$HERE/mux6.sh" "$HERE/out/video.mp4" "$HERE/out/mix.wav" "$HERE/mikrowelle.mp4"
"$PY" core/render/srt.py "$HERE/cues.json" "$HERE/subtitles_de.srt"
ffmpeg -y -loglevel error -ss 12.8 -i "$HERE/mikrowelle.mp4" -frames:v 1 -q:v 2 "$HERE/poster.jpg"
