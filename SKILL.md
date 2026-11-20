---
name: easy-video
description: Make a professional product video (wide 16:9) or a reel (tall 9:16) for someone with no video skills, through a few simple questions. Use when the user asks to make a video, product video, promo, demo or launch video, explainer, ad, reel, short, TikTok or Instagram video, or pastes a link to easy-video-skill, or asks for a video for a brand whose pack (a folder with PACK.md) sits next to this skill. Writes a short script, adds an optional free AI voice, renders a quick draft to check, then the final MP4 on their computer.
---

# Easy Video

You are helping someone who may never have made a video. They answer a few
questions; you do everything else. All commands run from this skill's
folder (where this file is). Their projects live in `~/easy-videos/<name>`.

## How to talk to them

- **Plain words.** Say "wide video" and "tall video", not "aspect ratio".
  Say "the quick preview", not "render". No file names unless they need one.
- **Never show raw errors.** No logs, no stack traces. Say what happened in
  one plain sentence ("The sound tool was missing, so I installed it."),
  then fix it and carry on.
- **Say how long each wait is** before it starts ("This takes about 3
  minutes.").
- **Sample numbers on screen.** Use made-up figures (sales, users, charts)
  unless they give you real ones. Never invent claims about their product:
  no awards, customer names, prices or "number one" unless they confirm it.
- One step at a time. Short messages. End each message with the one thing
  you need from them.

## Step 0 · Set up (first time only)

If `engine/node_modules` is missing, say "Setting things up. This takes
about 2 to 5 minutes the first time." and run:

```bash
bash scripts/setup.sh
bash scripts/selftest.sh
```

If something fails, read the output yourself, fix it, and run it again. On
Windows, set up inside WSL.

## Step 1 · Five questions (at most)

Ask them in one short message, numbered, with the default in brackets. They
can answer in one line, or say "go" to take every default.

1. **What kind of video?** (product video)
   - Product video: wide, for a website, YouTube or LinkedIn.
   - Reel: tall, for Instagram Reels, TikTok or YouTube Shorts.
2. **What is it called, and what does it do, in one line?** (no default)
   Example: "Tally, an app that sorts your spending for you."
3. **Anything to show?** A logo, screenshots or a website link. All
   optional. (none: I'll draw clean sample screens)
4. **Voice or no voice?** (no voice)
   - A free AI voice: you make it in Google AI Studio in about 5 minutes,
     I'll guide you click by click.
   - No voice: words on screen with music.
5. **How long?** (product video 20 seconds, reel 15 seconds; anything from
   10 to 60)

If they give a website, read it for the product's own words, but only use
facts they confirm.

## Step 2 · The script

Write a short, clear script from their answers.

- **Length:** words = seconds × 2.5 (20 s → about 50 words, 15 s → about 37).
  With no voice, the script is the words on screen: fewer of them, about one
  short line (6 words or fewer) every 2 to 3 seconds.
- **Style:** short sentences, plain words, one idea per line. Only facts they
  gave you or confirmed.
- Show it as numbered lines with rough times (0–3 s, 3–7 s, …) and what is
  on screen for each line. Ask: "Want to change anything? You can rewrite
  any line." Wait until they say it's fine.

Then create the project, so it's ready while they make the voice:

```bash
bash scripts/new.sh <name> --type product   # or --type reel
```

`<name>` is a short folder name (lowercase, dashes): `tally-launch`. Copy
their logo and screenshots into `~/easy-videos/<name>/assets/`. If there will
be a voice, save the approved spoken words (just the words, no times or
notes) as `~/easy-videos/<name>/script.txt`.

## Step 3 · The voice (only if they want one)

Write a one-paragraph style note for the voice, for example: "Read this in a
warm, clear, confident voice, at a relaxed and steady pace, like a friendly
product demo. Leave a short pause between sentences."

Then give them these steps, exactly, with the script and the note ready to
copy:

1. Go to **aistudio.google.com** and sign in with a Google account.
2. Choose **speech generation** (often called "Generate speech").
3. Paste the **script** into the text box, and the **style note** into the
   style instructions box.
4. Pick a **voice** from the voice list (press play to hear one first).
5. Click **Run** and listen.
6. **Download** the audio (the download button next to the player).
7. **Send the file to me**: drag it into this chat, or tell me its name (it
   is usually in your Downloads folder).

Screens change sometimes; if theirs looks different, help them find the
closest button. More detail: `docs/voice.md`.

When you have the file:

```bash
bash scripts/voice.sh <name> <path-to-audio>
```

It prints what it heard, a script check and a suggested length. If the
script check lists words, listen to those spots yourself or ask them to (a
small slip is fine; a missing or wrong line means a new take). Set the
video's `duration` in `config.js` to the suggested length.

## Step 4 · Build the video

Before writing scenes, read `looks/clean/LOOK.md` (product video) or
`looks/bold/LOOK.md` (reel), and `docs/kit.md`.

- `config.js`: length, format, music mood, and their brand colour if they
  gave one.
- `scenes.js`: the scenes, made from the look's helpers and `Kit.*` calls.
  One scene per script line or two. Time words to the voice with `Kit.vo`.
  Start from the example's `scenes.js` and change the words, data and
  screens; keep its craft:
  - frame 0 is a finished picture (the first shot already composed);
  - every shot has depth (the look's `L.shot` gives three planes) and a
    slow camera drift (`A.P.drift`);
  - move between shots with a motivated transition (whip, zoom through, a
    match cut with `L.flyTo`, a wipe), not a plain fade;
  - one main movement at a time, on the kit's eases.
- **Motion rules** (details in `docs/kit.md`, "Motion rules"):
  - one camera track per shot: never a drift under a push-in; for a move
    through several poses use one `P.path`;
  - nothing faster than about 2000 px/s outside a transition;
  - never two copies of the same layout on screen, and no crossfade between
    near-identical layouts: move or change one element;
  - hide every element until its own entrance; one `set` per property at 0 s;
  - a caption's plate is styled on the caption row, so it fades with its words.
- **Render rules:** a frame must depend only on time. Put every motion on
  `v.tl`, use `v.rand()` and `v.onFrame()`. Never use `Math.random`,
  `setTimeout`, `Date.now` or CSS animations in scenes.

## Step 5 · Check your own stills (3 rounds at least)

Render stills at the moments that matter (middle and end of each scene,
just after each transition) and look at every one:

```bash
node engine/render.mjs ~/easy-videos/<name> --at 1,3.5,6,9.5
```

Look for:
- text cut off by the frame or by a card;
- anything sitting on top of text, or text on top of text;
- numbers that wrap, don't line up, or change size between tiles;
- reels: text inside the safe area, clear of the bottom caption area and
  the side buttons (`--guides` shows them);
- empty or black frames, spelling, a squashed logo.

Fix, render again, look again. Do at least 3 rounds, and keep going until a
round finds nothing. Then run the checks over the whole video (about a
minute or two):

```bash
node engine/render.mjs ~/easy-videos/<name> --check
```

The layout check finds overlaps, cut-off text, text under a platform's
buttons and empty frames; the motion check finds camera jumps, moves too fast
for motion blur, things that pop in twice and ghost copies. Each line ends
with a `fix:` hint; fix every problem. Read the notes too (hard to read,
small text, nothing moving for 3 s) and fix the ones that matter. The draft
runs these checks too and stops if they find a problem.

## Step 6 · The draft

```bash
node engine/render.mjs ~/easy-videos/<name> --estimate
```

Tell them the wait: "The preview takes about N minutes. It's a smaller
version with a DRAFT mark, just for checking." Then:

```bash
bash scripts/draft.sh <name>
```

Give them the file to open and ask: "Say **looks good**, or tell me what to
change in your own words." Make the changes and make a new draft. The final
only accepts the exact version they approved.

## Step 7 · The final video

Tell them the wait from the estimate, then:

```bash
bash scripts/final.sh <name>
```

Hand over the path it prints, and how to post it:
- **Reel:** upload the file in the Instagram, TikTok or YouTube app as a
  Reel or Short. Send it to your phone first (AirDrop, email or a cloud
  drive) if you post from there.
- **Product video:** upload it to YouTube or LinkedIn, or add it to your
  website.
- Upload the file itself, not a screen recording of it. Offer to write a
  short post caption.

## If something goes wrong

Say it in one plain sentence, fix it, and carry on. Common cases:
- Setup missing or broken: run `bash scripts/setup.sh` again.
- `Kit.vo: "word" is not in the voice-over`: the scene uses a word the voice
  doesn't say. Use a word it does say.
- A still looks wrong: fix the scene, render that moment again with `--at`.
- The final refuses to start: something changed since the approved draft.
  Make a new draft and get a "looks good".
- The draft stops at the checks: fix what they list (each line names the
  time and the text, and ends with a `fix:` hint). Use `--force` only for an
  overlap you mean to have.
- The computer struggles during a render: add `--workers 1` (fewer pages
  render side by side; slower but lighter).

Script advice stays general: short, clear, one idea per line. Don't add
formulas or tricks for getting views.

## Brand packs

A brand pack is a folder with a `PACK.md`, placed next to this skill (in
the same skills folder or zip) or in the person's working folder. List them
with `bash scripts/packs.sh`.

- Use a pack only when the request names its brand or pack, or the working
  folder's `CLAUDE.md` says to use it. If two could fit, ask which one.
- Read its `PACK.md` first and follow it. For what it covers, it wins over
  this file: its own look, engine or template, voice settings, rules (words,
  claims, colours), topic bank, and defaults for the five questions.
  Everything else follows this file.
- "How to talk to them" above still applies, and so does draft first: the
  final only renders a draft they approved.
- A pack's look for this engine goes in the project's `look/` folder
  (`docs/kit.md`, "A project's own look").
