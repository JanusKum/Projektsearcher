#!/bin/sh
# Rebuild INDUKTION in one command: sh build.sh
set -e
LIB=${LIB:-/root/lemo-opuscar}; export LIB
HERE=$(cd "$(dirname "$0")" && pwd)
[ -f "$LIB/core/render/video.mjs" ] || { echo "set LIB to the Lemo-Opuscar library folder"; exit 1; }
PY="$LIB/.venv/bin/python"
echo "== 1. voice (edge-tts, de-DE-ConradNeural; needs speech.platform.bing.com)"
LIB=$LIB SSL_CERT_FILE=${SSL_CERT_FILE:-} "$PY" "$HERE/tts_proxy.py" "$HERE/lines.json" "$HERE/voices"
echo "== 2. score"
"$PY" "$HERE/music/score.py"
cd "$LIB"
echo "== 3. events → foley + mix"
node core/render/events.mjs "$HERE"
"$PY" "$HERE/mix.py"
echo "== 4. picture (1080×1920, 24 fps)"
node core/render/video.mjs "$HERE" --fps 24 --workers 3 --size 1080x1920 --out "$HERE/out/video.mp4"
echo "== 5. mux (−14 LUFS) + subtitles"
sh "$HERE/mux6.sh" "$HERE/out/video.mp4" "$HERE/out/mix.wav" "$HERE/induktion.mp4"
"$PY" "$HERE/subs.py" && "$PY" core/render/srt.py "$HERE/cues.json" "$HERE/subtitles_de.srt"
ffmpeg -y -loglevel error -ss 20.6 -i "$HERE/induktion.mp4" -frames:v 1 -q:v 2 "$HERE/poster.jpg"
