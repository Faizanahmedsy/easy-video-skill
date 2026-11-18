# lib.sh: shared helpers for the other scripts (sourced, not run on its own).
SKILL="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
say() { printf '%s\n' "$*"; }
die() { printf '\n%s\n\n' "$*" >&2; exit 1; }
# ffmpeg from this computer, else the copy setup.sh downloaded
ffmpeg_bin() {
  if command -v ffmpeg >/dev/null 2>&1; then echo ffmpeg
  elif [ -x "$SKILL/engine/node_modules/ffmpeg-static/ffmpeg" ]; then echo "$SKILL/engine/node_modules/ffmpeg-static/ffmpeg"
  else return 1; fi
}
# a project: a folder with config.js, or a name in ~/easy-videos
project_dir() {
  if [ -f "$1/config.js" ]; then (cd "$1" && pwd)
  elif [ -f "$HOME/easy-videos/$1/config.js" ]; then echo "$HOME/easy-videos/$1"
  else die "I can't find a video called \"$1\" (looked in $1 and ~/easy-videos/$1)."; fi
}
need_engine() {
  command -v node >/dev/null 2>&1 || die "Node.js is not installed yet. Run: bash scripts/setup.sh"
  [ -d "$SKILL/engine/node_modules/playwright" ] || die "The video engine is not set up yet. Run: bash scripts/setup.sh"
}
