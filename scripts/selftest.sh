#!/usr/bin/env bash
# selftest.sh: makes the sound for a 2-second test video, renders it as a draft
# and checks the result (size, length, sound, and that the picture changes).
# Prints SELFTEST PASSED when the engine works.
set -euo pipefail
source "$(dirname "$0")/lib.sh"
need_engine
FF=$(ffmpeg_bin) || die "SELFTEST FAILED: ffmpeg is missing. Run: bash scripts/setup.sh"
work=$(mktemp -d "${TMPDIR:-/tmp}/easy-video-selftest.XXXXXX")
trap 'rm -rf "$work"' EXIT
cp -R "$SKILL/tests/selftest" "$work/p"
rm -rf "$work/p/out" "$work/p/vo"

say "Selftest: making the sound…"
node "$SKILL/scripts/sound.mjs" "$work/p" >/dev/null || die "SELFTEST FAILED: the sound could not be made."
say "Selftest: rendering a 2-second draft…"
nice -n 10 node "$SKILL/engine/render.mjs" "$work/p" --draft >/dev/null || die "SELFTEST FAILED: the draft did not render."

mp4="$work/p/out/draft.mp4"
[ -s "$mp4" ] || die "SELFTEST FAILED: no video was written."
[ -s "$work/p/out/draft.fingerprint" ] || die "SELFTEST FAILED: the draft fingerprint is missing."
probe=$("$FF" -hide_banner -i "$mp4" 2>&1 || true)
grep -q 'Video: h264.*yuv420p.* 960x540' <<<"$probe" || die "SELFTEST FAILED: the video is not 960x540 H.264."
grep -q 'Audio: aac' <<<"$probe" || die "SELFTEST FAILED: the video has no sound."
secs=$(sed -n 's/.*Duration: \([0-9]*\):\([0-9]*\):\([0-9.]*\).*/\1 \2 \3/p' <<<"$probe" | awk '{ print $1 * 3600 + $2 * 60 + $3 }')
awk -v s="${secs:-0}" 'BEGIN { exit !(s > 1.9 && s < 2.1) }' || die "SELFTEST FAILED: the video is ${secs:-?} s long, not 2 s."
# the first frame is the light shot, the last the dark one: the timeline really moves
lum=$("$FF" -hide_banner -i "$mp4" -vf "select=eq(n\,0)+eq(n\,59),signalstats,metadata=print:key=lavfi.signalstats.YAVG" -an -f null - 2>&1 | sed -n 's/.*YAVG=\([0-9.]*\).*/\1/p' | tr '\n' ' ')
awk -v a="${lum%% *}" -v b="$(awk '{ print $2 }' <<<"$lum")" 'BEGIN { exit !(a - b > 60) }' || die "SELFTEST FAILED: the picture does not change as it should (brightness: $lum)."

say "SELFTEST PASSED (960x540 draft, ${secs} s, with sound)"
