#!/bin/sh
# Mux for ffmpeg 6 (the library's mux.sh needs ffmpeg 7): two-pass loudnorm → −14 LUFS / −1.5 dBTP into a WAV, then AAC + the picture.
# sh mux6.sh video.mp4 mix.wav out.mp4
set -e
V="$1"; A="$2"; O="$3"; T=$(dirname "$O")/.mux_tmp.wav
M=$(ffmpeg -hide_banner -nostats -i "$A" -af loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json -f null - 2>&1 | sed -n '/^{/,/^}/p')
g() { echo "$M" | sed -n "s/.*\"$1\" : \"\([^\"]*\)\".*/\1/p"; }
ffmpeg -hide_banner -loglevel error -y -i "$A" -af "loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=$(g input_i):measured_TP=$(g input_tp):measured_LRA=$(g input_lra):measured_thresh=$(g input_thresh):offset=$(g target_offset):linear=true,aresample=48000" -c:a pcm_s16le "$T"
ffmpeg -hide_banner -loglevel error -y -i "$V" -i "$T" -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 256k -ar 48000 -shortest -movflags +faststart "$O.part.mp4"
mv "$O.part.mp4" "$O"; rm -f "$T"
ffmpeg -hide_banner -nostats -i "$O" -af ebur128=peak=true -f null - 2>&1 | sed -n '/Summary/,$p' | grep -E "I:|Peak:" | tr -s ' '
echo "$O"
