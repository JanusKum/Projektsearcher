#!/bin/sh
# Rebuild "Nebel · 1000 Jahre" from scratch: sh build.sh   (runs from any directory)
set -e
LIB=${LIB:-/root/lemo-opuscar}
HERE=$(cd "$(dirname "$0")" && pwd)
export LIB
[ -f "$LIB/core/render/video.mjs" ] || { echo "set LIB to the Lemo-Opuscar library folder"; exit 1; }
# ffmpeg 7+ for mastering: a project-local static build (pip imageio-ffmpeg) when the system one is older
if [ ! -x "$HERE/.tools/ffbin/ffmpeg" ]; then
  python3 -m venv "$HERE/.tools" && "$HERE/.tools/bin/pip" install -q imageio-ffmpeg
  mkdir -p "$HERE/.tools/ffbin" && ln -sf "$("$HERE/.tools/bin/python" -c 'import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())')" "$HERE/.tools/ffbin/ffmpeg"
fi
export PATH="$HERE/.tools/ffbin:$PATH"
PY="$LIB/.venv/bin/python"
SIZE=1080x1920
cd "$LIB"
"$PY" "$HERE/tools/tts_de.py" "$HERE/voice/lines.json" "$HERE/voice" --voice de-DE-ChristophNeural --rate +4%   # 1. narration (edge-tts, online; cached)
"$PY" "$HERE/music/score.py"                                                                                  # 2. original chiptune → music/score.wav
node core/render/events.mjs "$HERE" --size $SIZE                                                              # 3. timeline → events.json
"$PY" "$HERE/mix.py"                                                                                          # 4. foley + voice + ducked music → out/mix.wav
"$PY" core/render/srt.py "$HERE/out/cues.json" "$HERE/subtitles_de.srt"                                       # 5. subtitles (same array as the dialogue box)
node core/render/readcheck.mjs "$HERE" --size $SIZE                                                           # 6. every on-screen text long enough to read
node core/render/video.mjs "$HERE" --fps 24 --workers 4 --size $SIZE --out "$HERE/out/video.mp4"             # 7. frames → video
sh core/render/mux.sh "$HERE/out/video.mp4" "$HERE/out/mix.wav" "$HERE/nebel-1000-jahre.mp4" 24 0             # 8. mux, −14 LUFS, no grain
node core/render/still.mjs "$HERE" 0 --q poster=1 --size $SIZE --prefix poster_ --out "$HERE/out" && cp "$HERE/out/poster_0.jpg" "$HERE/poster.jpg"
node core/render/still.mjs "$HERE" 0 --q sheet=1 --size $SIZE --prefix sheet_ --out "$HERE/out"             # model sheet → out/sheet_0.jpg
