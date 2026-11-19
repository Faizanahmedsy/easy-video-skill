#!/usr/bin/env bash
# setup.sh: gets everything the video engine needs (Node.js check, engine packages,
# Chromium, ffmpeg). Run it once; running it again is safe.
set -euo pipefail
source "$(dirname "$0")/lib.sh"
say "Setting up the video engine. The first time takes 1 to 3 minutes."

# 1. Node.js 18 or newer
command -v node >/dev/null 2>&1 || die "Node.js is not installed. Install the LTS version from https://nodejs.org, then run this again."
major=$(node -p 'process.versions.node.split(".")[0]')
[ "$major" -ge 18 ] || die "Node.js $(node -v) is too old: version 18 or newer is needed. Install the LTS version from https://nodejs.org, then run this again."
say "  Node.js $(node -v): ok"

# 2. the engine's packages (GSAP and Playwright)
cd "$SKILL/engine"
npm install --no-audit --no-fund --loglevel=error >/dev/null || die "Could not install the engine's packages. Check the internet connection and run this again."
say "  engine packages: ok"

# 3. the Chromium the video is drawn in
node node_modules/playwright/cli.js install --only-shell chromium >/dev/null 2>&1 || die "Could not download Chromium (the browser the video is drawn in). Check the internet connection and run this again."
starts() { node -e 'import("playwright").then(async ({ chromium }) => { await (await chromium.launch()).close() }).catch(() => process.exit(1))' 2>/dev/null; }
if ! starts && [ "$(uname)" = Linux ]; then
  say "  Chromium needs a few system libraries; installing them…"
  if [ "$(id -u)" = 0 ]; then node node_modules/playwright/cli.js install-deps chromium >/dev/null 2>&1 || true
  elif sudo -n true 2>/dev/null; then sudo -n "$(command -v node)" node_modules/playwright/cli.js install-deps chromium >/dev/null 2>&1 || true
  fi
fi
starts || die "Chromium is installed but can't start: some system libraries are missing. Run this once (it asks for your computer login): cd \"$SKILL/engine\" && sudo npx playwright install-deps chromium"
say "  Chromium: ok"

# 4. ffmpeg (turns the pictures into an MP4)
if command -v ffmpeg >/dev/null 2>&1; then
  say "  ffmpeg: ok (already on this computer)"
else
  npm install --no-save --no-audit --no-fund --loglevel=error ffmpeg-static >/dev/null 2>&1 || true
  ffmpeg_bin >/dev/null || die "Could not get ffmpeg. Check the internet connection and run this again (or install ffmpeg from https://ffmpeg.org)."
  say "  ffmpeg: ok (downloaded for the engine)"
fi

say "All set. To check that everything works: bash scripts/selftest.sh"
