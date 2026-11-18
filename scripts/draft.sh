#!/usr/bin/env bash
# draft.sh <project>: a fast draft to check (half size, no motion blur, a DRAFT mark)
# → <project>/out/draft.mp4. Remakes vo/mix.wav first when config.js uses it,
# so the sound effects always match the picture.
set -euo pipefail
source "$(dirname "$0")/lib.sh"
[ $# -ge 1 ] || die "Which video? Like: bash scripts/draft.sh my-video"
P=$(project_dir "$1"); shift
need_engine
if grep -q 'vo/mix\.wav' "$P/config.js"; then
  nice -n 10 node "$SKILL/scripts/sound.mjs" "$P"
fi
nice -n 10 node "$SKILL/engine/render.mjs" "$P" --draft "$@"
