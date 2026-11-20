#!/usr/bin/env bash
# packs.sh [folder]: lists the brand packs Claude can use. A brand pack is a folder
# with a PACK.md in it, sitting next to this skill (in the same skills folder or
# zip) or in the person's working folder (or the folder given). Prints one line per
# pack: its name, where its PACK.md is, and the first line that says what it is.
set -euo pipefail
source "$(dirname "$0")/lib.sh"
where="${1:-$PWD}"
seen=""
found=0
for f in "$SKILL"/../*/PACK.md "$where"/PACK.md "$where"/*/PACK.md "$where"/*/*/PACK.md; do
  [ -f "$f" ] || continue
  real=$(cd "$(dirname "$f")" && pwd -P)
  case "$seen" in *"|$real|"*) continue ;; esac
  seen="$seen|$real|"
  # the first heading, else the first line with words in it
  about=$(grep -m1 -E '^#+ ' "$f" | sed -E 's/^#+ +//' || true)
  [ -n "$about" ] || about=$(grep -m1 -E '[[:alnum:]]' "$f" || true)
  say "$(basename "$real")  ·  $real/PACK.md  ·  ${about:-no description}"
  found=$((found + 1))
done
[ "$found" -gt 0 ] || say "No brand packs found (looked next to the skill and in $where)."
