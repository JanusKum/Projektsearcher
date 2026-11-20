#!/bin/sh
# Renders all 720 frames in two halves, each retried until its frames exist; then encodes out/video.mp4
HERE=$(cd "$(dirname "$0")" && pwd); LIB=${LIB:-/root/lemo-opuscar}; export LIB; cd "$LIB"
half() { until node "$HERE/frames.mjs" $1 $2 2>&1 | tee -a "$HERE/out/frames_$1.log" | grep -q "nothing to do"; do sleep 2; done; }
half 0 360 & half 360 720 & wait
ffmpeg -y -loglevel error -framerate 24 -i "$HERE/out/frames/f_%04d.jpg" -c:v libx264 -preset medium -crf 14 -pix_fmt yuv420p "$HERE/out/video.mp4" && echo VIDEO_DONE > "$HERE/out/STATUS"
