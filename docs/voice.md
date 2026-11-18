# The voice

A voice is optional. You can make a free AI voice in Google AI Studio in
about 5 minutes, or skip it and have words on screen with music.

## Option A · A free AI voice (Google AI Studio)

You need a Google account. Claude gives you two things to copy: the
**script** and a one-paragraph **style note** (how the voice should sound).

1. **Open the site.** Go to [aistudio.google.com](https://aistudio.google.com)
   and sign in with your Google account. Accept the terms the first time.
2. **Choose speech generation.** Find "Generate speech" (sometimes under
   "Generate media" or in the list of things you can make) and open it.
   Choose a **single speaker** if it asks.
3. **Paste.** Paste the **script** into the main text box. Paste the **style
   note** into the box for style instructions. If there is only one box,
   paste the style note first, then a blank line, then the script.
4. **Pick a voice.** Open the voice list and press play on a few to hear
   them. Pick one that fits: calm and clear for a product video, upbeat for
   a reel.
5. **Run.** Click **Run**. Wait a few seconds, then listen. If a word sounds
   wrong, change the spelling in the box (for example write a name the way
   it sounds) and run again.
6. **Download.** Click the download button next to the audio player. It
   saves a sound file, usually to your Downloads folder.
7. **Send it to Claude.** Drag the file into the chat, or tell Claude its
   name. Claude finds it and does the rest.

The site changes now and then. If your screen looks different, tell Claude
what you see and it will help you find the right button.

### What Claude does with the file

```bash
bash scripts/voice.sh <project> <audio-file>
```

This converts the file, finds when each word is spoken (so words on screen
appear in time with the voice) and suggests the video's length. If the
optional speech tool is installed (`pip install faster-whisper`), the
word times are exact; without it they are close enough for most videos.

### A good style note

One short paragraph about tone, pace and feel. For example:

> Read this in a warm, clear, confident voice, at a relaxed and steady pace,
> like a friendly product demo. Leave a short pause between sentences.

## Option B · No voice

Choose "no voice" and the video uses short lines of text on screen, timed to
the music. Nothing to record, nothing to download. You can add a voice later
by making a new draft with one.

## Your own recording

You can also record yourself on your phone or computer, reading the script.
Send the file to Claude the same way as in step 7. A quiet room helps.
