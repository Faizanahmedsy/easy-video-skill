# Example: product video (Clean)

A 21.5-second, 16:9 video for a made-up task app called Tidy, in the **Clean** look.
No voice: music and on-screen text. All data is dummy data.

- `config.js`: size, length, look, backdrop
- `scenes.js`: the shots
- `script.md`: what is on screen, and when

Try it from the skill folder:

```
node engine/render.mjs examples/product-video --stills 6   # a few pictures
node engine/render.mjs examples/product-video --check      # the layout check
node engine/render.mjs examples/product-video --draft      # a quick draft video
```

![Clean](../../docs/images/clean-numbers.webp)
