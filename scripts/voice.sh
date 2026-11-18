#!/usr/bin/env bash
# voice.sh <project> <audio file> [--script script.txt]: makes vo/voice.wav and the
# word times (vo/words.js) from the voice-over file, and prints its length.
set -euo pipefail
source "$(dirname "$0")/lib.sh"
[ $# -ge 2 ] || die "Use: bash scripts/voice.sh my-video ~/Downloads/voice.wav"
P=$(project_dir "$1"); shift
need_engine
node "$SKILL/scripts/voice.mjs" "$P" "$@"
