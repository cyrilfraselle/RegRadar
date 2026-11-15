# Promo film: technical plan (phase 2, not started)

Goal: one self-contained page `strategy/promo/film/max-promo.html` (later
copied to `docs/` if the owner wants it on the site) that draws every frame
as a pure function of time, plus a render script that turns it into a file
with sound. No third-party libraries, samples or music; nothing downloaded.

## 1. Picture: deterministic WebGL2, own code

- **Why WebGL2, not CSS 3D or Canvas 2D.** Canvas 2D (used by film 01,
  `docs/film-follow-the-money.html`) only does affine transforms, so a page
  plane cannot have true perspective. CSS 3D (the landing `.stack3d`) has
  real perspective but no depth of field and is hard to capture frame-exact.
  WebGL2 gives a real perspective camera, depth sorting and blur, in about
  600 lines with no library.
- **Scene graph.** Everything is a textured quad (a "plane") in 3D: page
  sheets, duty cards, control cards, board columns, layer slabs, calendar
  tiles, the certificate. Each plane's texture is drawn once into an offscreen
  Canvas 2D (system fonts: SF Pro Display, Georgia, SF Mono; `document.fonts.ready`
  is awaited before any texture is drawn), at 2x for sharp text.
- **Camera.** One perspective camera (about 38 deg vertical field of view)
  whose position, target and roll are keyframed per scene with eased splines
  (the site's ease `cubic-bezier(.16,1,.3,1)` reproduced in JS). A second
  rig for 9:16 re-frames the same scene graph.
- **Depth of field.** Planes are drawn back to front; each plane's blur radius
  comes from its distance to the focus plane (circle of confusion). Blur is
  done by sampling a pre-built mip chain of the plane's texture (bias by blur
  radius), which is cheap and exact enough for flat cards. Optional bokeh-free
  glow pass for the trail line.
- **Trail line.** A ribbon mesh along a spline between nodes, drawn with an
  additive glow shader; its length is a function of time.
- **Determinism.** `render(t)` reads only `t` and constant data. No
  `Date.now`, `performance.now` or `Math.random` inside it; a seeded PRNG
  (mulberry32) generates grain and page jitter once at load. The preview player
  uses `requestAnimationFrame` only to choose `t`. A `window.__promo.seek(t)`
  hook (same contract as `window.__ftm` in film 01) renders a given time and
  resolves after two frames.
- **Text in the film = text in the ledger.** All on-screen strings live in one
  `STRINGS` object keyed by ledger id (C1, K4...). A small Node check
  (`strategy/promo/film/check-strings.mjs`) fails if a string in the page is
  not in `claims-ledger.md`, if any line breaks the 0.3 s per word rule
  (from its settled time to its exit), or if "RegRadar" appears.

## 2. Sound: generated in WebAudio, rendered offline

- One score on a 120 BPM grid counted from frame 0: events are
  `[bar, beat, voice, note, velocity]`. The same table fires effects on cuts
  and arrivals, so music and effects cannot drift apart.
- Rendered with an `OfflineAudioContext(2, 48000 * 48, 48000)`: exact,
  faster than real time and identical on every run (noise buffers from the
  seeded PRNG).
- Voices (all oscillators, noise and filters): bell (FM, D), sub (sine with
  pitch drop), pulse (filtered saw 8ths), pad (detuned saws through a slowly
  opening low-pass), pluck (Karplus-Strong style from seeded noise), bass,
  kick, soft clap, hats (high-passed noise), whoosh and paper (band-passed
  noise tuned to A), wood tick, chimes.
- Mix: music bus and effects bus into a shared convolution reverb (impulse
  generated from decaying seeded noise), so effects sit in the same room;
  effects 6 to 10 dB under the music, repeated ticks lower still; gentle bus
  compressor and a limiter (peak about -1 dBFS); target loudness about
  -14 LUFS integrated (measured by a small RMS/K-weighting script on the WAV).
- The preview page plays the same rendered buffer through an
  `AudioBufferSourceNode`, so the preview sounds exactly like the file.

## 3. Making the file without ffmpeg

Chrome 157 is installed (`/Applications/Google Chrome.app`), Node 24 is
installed, ffmpeg and Homebrew are not. `swift`, `avconvert` and `afconvert`
exist in `/usr/bin` (Apple tools).

| Option | How | Result | Needs |
|---|---|---|---|
| **A (recommended for .webm)** WebCodecs in headless Chrome | A Node script (built-in `WebSocket`, no npm package) starts Chrome `--headless=new --remote-debugging-port`, opens the page, and calls a page function that for each frame n: `render(n/30)`, `new VideoFrame(canvas, {timestamp: n*1e6/30})`, `VideoEncoder` (VP9); the offline-rendered audio goes through `AudioEncoder` (Opus). A small WebM (EBML) muxer written in the page (about 200 lines, our own code) assembles the bytes, which are returned to Node in base64 chunks and written to `strategy/promo/out/max-promo.webm`. | Frame-exact .webm, 1920x1080, 30 fps, any machine speed | Nothing new |
| B MediaRecorder (as in the brief) | `canvas.captureStream(30)` + `MediaStreamAudioDestinationNode` into one `MediaStream`, `MediaRecorder` (`video/webm;codecs=vp9,opus`), played in real time. | .webm | Nothing new. Real time, so a slow frame is dropped or held; timing is only as good as the machine. Use as a quick preview, not as the master. |
| **C (recommended for .mp4)** Apple AVFoundation | Same page; the Node script saves PNG frames (`canvas.toBlob` or CDP `Page.captureScreenshot`) and a WAV of the offline audio to `strategy/promo/out/work/`. A Swift script (our own, about 120 lines) uses `AVAssetWriter` to write H.264 video and AAC audio into `max-promo.mp4`. | Frame-exact .mp4 (H.264/AAC), plays everywhere | `swift` needs the Xcode Command Line Tools; if they are missing, macOS offers to install them: **owner's permission first**. |
| D WebCodecs to MP4 | As A, with `VideoEncoder` codec `avc1.640028` and `AudioEncoder` `mp4a.40.2` (check `isConfigSupported` in this Chrome), plus our own MP4 (ISO BMFF) muxer, about 400 lines. | .mp4 without any install | More code to write and test; AAC encoding support varies by Chrome build. Fallback if C is refused. |
| E Install ffmpeg | Homebrew then `brew install ffmpeg`, or a static ffmpeg binary. Then `ffmpeg -framerate 30 -i f%05d.png -i mix.wav -c:v libx264 -pix_fmt yuv420p -c:a aac`. | .mp4 and any other format | **Owner's permission to install** (Homebrew install script or a downloaded binary). Not needed if A plus C works. |

Upload note: YouTube and Vimeo accept .webm; LinkedIn and X need .mp4, so
the .mp4 route matters for social posts.

## 4. Checks before and after the full render

1. Strings check (section 1) passes.
2. Contact sheet: stills at every scene middle and at each cut minus and plus
   8 frames, at 16:9 and 9:16, saved to `strategy/promo/out/stills/` and
   looked at for overflow, collisions, contrast (captions at least 4.5:1 on
   their local background) and muddy double exposures.
3. Audio: peak and loudness measured on the WAV; cut sync check (an effect's
   onset frame equals the cut frame).
4. Poster: the strongest settled frame (punchline, about 43.0 s) saved as
   `max-promo.jpg` and, following brag guidance, written over frame 0 of the
   file (replace, not add, so length and sync stay the same). Open question
   for the owner: this costs the first frame of the hook.
5. After build: captions re-read against the ledger (SCRIPT_REVIEW step 6).

## 5. Files (phase 2)

```
strategy/promo/film/max-promo.html     the film page (preview player + render hooks)
strategy/promo/film/render.mjs         Node + CDP driver (no npm packages)
strategy/promo/film/webm-mux.js        own WebM muxer
strategy/promo/film/avwriter.swift     option C
strategy/promo/film/check-strings.mjs  ledger and timing check
strategy/promo/out/                    renders (git-ignored except the poster)
```
