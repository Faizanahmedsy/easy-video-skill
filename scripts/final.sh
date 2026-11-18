#!/usr/bin/env bash
# final.sh <project> [--force]: the full-size video with motion blur → <project>/out/video.mp4.
# It only runs after a draft of exactly the same files (--force skips that check).
set -euo pipefail
source "$(dirname "$0")/lib.sh"
[ $# -ge 1 ] || die "Which video? Like: bash scripts/final.sh my-video"
P=$(project_dir "$1"); shift
need_engine
nice -n 10 node "$SKILL/engine/render.mjs" "$P" --final "$@"
