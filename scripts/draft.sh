#!/usr/bin/env bash
# draft.sh <project> [--force]: a fast draft to check (half size, no motion blur, a DRAFT mark)
# → <project>/out/draft.mp4. First it runs the layout check (overlaps, cut-off text,
# text in a platform's UI areas, empty frames) and stops if it finds a problem;
# --force skips the check. Remakes vo/mix.wav when config.js uses it, so the sound
# effects always match the picture.
set -euo pipefail
source "$(dirname "$0")/lib.sh"
[ $# -ge 1 ] || die "Which video? Like: bash scripts/draft.sh my-video"
P=$(project_dir "$1"); shift
need_engine
force=0
for a in "$@"; do [ "$a" = "--force" ] && force=1; done
if [ "$force" = 0 ]; then
  nice -n 10 node "$SKILL/engine/render.mjs" "$P" --check ||
    die "The layout check found problems (listed above, and in out/check.txt). Fix them and run the draft again, or add --force to make the draft anyway."
fi
if grep -q 'vo/mix\.wav' "$P/config.js"; then
  nice -n 10 node "$SKILL/scripts/sound.mjs" "$P"
fi
nice -n 10 node "$SKILL/engine/render.mjs" "$P" --draft "$@"
