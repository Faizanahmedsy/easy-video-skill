#!/usr/bin/env bash
# new.sh <name> [--type product|reel]: starts a new video from an example,
# in ~/easy-videos/<name>. product = Clean look, 16:9; reel = Bold look, 9:16.
set -euo pipefail
source "$(dirname "$0")/lib.sh"
name="${1:-}"
type=product
[ $# -gt 0 ] && shift
while [ $# -gt 0 ]; do
  case "$1" in
    --type) type="${2:-}"; shift 2 || shift ;;
    --type=*) type="${1#*=}"; shift ;;
    *) shift ;;
  esac
done
[ -n "$name" ] || die "Give the video a short name, like: bash scripts/new.sh my-launch --type product"
[[ "$name" =~ ^[A-Za-z0-9][A-Za-z0-9._-]*$ ]] || die "Use only letters, numbers and dashes in the name (like my-launch)."
case "$type" in
  product) src="$SKILL/examples/product-video" ;;
  reel) src="$SKILL/examples/reel" ;;
  *) die "The type is product or reel." ;;
esac
[ -d "$src" ] || die "The $type example is missing from the skill ($src)."
dest="$HOME/easy-videos/$name"
[ -e "$dest" ] && die "There is already a video called $name ($dest). Pick another name."
mkdir -p "$HOME/easy-videos"
cp -R "$src" "$dest"
rm -rf "$dest/out"
say "New $type video: $dest"
