# Academy films

Motion explainers for the Watch beat of each lesson (`academy/LEARNING_PATH.md`). Every film goes
through the script review gate (`academy/SCRIPT_REVIEW.md`) **before** anything is built.

| Film | Module | Title | Length | Gate status |
|---|---|---|---|---|
| 01 | `context` | Follow the money | 30 s | Built as a lab prototype (`docs/labs/010-follow-the-money/`, branch `lab/010-follow-the-money`); ledger `FACTCHECK.md` there |
| 02 | `aml-basics` | Effort follows risk | 58 s | Script v1 · [`aml-basics.script.md`](aml-basics.script.md) · independent check pending |
| 03 | `cdd-kyc` | Know who, know why | 60 s | Script v1 · [`cdd-kyc.script.md`](cdd-kyc.script.md) · independent check pending |
| 04 | `beneficial-ownership` | Look through | 60 s | Script v1 · [`beneficial-ownership.script.md`](beneficial-ownership.script.md) · independent check pending |

Each `<id>.script.md` holds the brief, the scene-by-scene storyboard (timecodes, visual, kinetic
type, caption) and the numbered claim ledger. When a film is built, its ledger moves next to the
film as `FACTCHECK.md` (gate step 2), and the words on screen must be the words in the ledger
(gate step 6).

Shared fiction across films 02 to 04: **Brindle Pay** (fictional payment and e-money firm, films 02
and 03) and **Orrin** (fictional crypto-asset service provider, film 04), so the audience sees all
three firm types. Every name, company and amount is fictional and labelled on screen.

## Shared visual language (taken from film 01)

Everything below is how film 01 (`docs/labs/010-follow-the-money/index.html`) already works. New
films reuse it so the series reads as one.

### Frame and player

- **Always a dark film**, whatever the page theme. 16:9 canvas, drawn in a **1600 x 900** logical
  frame; the world is larger and the camera moves over it.
- Player below the canvas: **captions in the DOM** (one paragraph per caption, only the current one
  visible), scrubber with **chapter ticks**, play, replay, time, **sound off by default**,
  chapter chips, keyboard (Space, arrows one second, Shift + arrows five seconds, click the picture
  to pause).
- Under the player: "Fictional example. Not legal advice.", a **transcript** (same words as the
  captions, with timecodes) and a fine-print box naming the typology and the teaching models.
- **Reduced motion**: the film does not autoplay; a grid of **stills** (key frames with a heading
  and a one-line caption) is shown instead. Each script lists its stills.
- Every frame is a pure function of time: scrubbing, chapters, stills and replay all just set the
  time and redraw. Randomness is seeded, so every frame is reproducible.

### Palette

| Token | Value | Use |
|---|---|---|
| Film background | `#070B14` | stage, fades |
| Panel / line | `#0B111E` / `#1D2638` | captions panel, borders |
| Text | `#E6EDF3` · `#AAB4C6` · `#8A93A0` | high, secondary, tertiary (mono labels) |
| Highlight | `#F5F7FB` | headlines, key numbers |
| Card fill | `#0B1322` | company, account and file cards |
| **Warm** | `#FFB454` (255,180,84) | not yet understood: dirty money, open questions, risk, red flags |
| **Cool** | `#78A9FF` (120,169,255) | understood: checked, explained, identified, clean-looking |
| Brand mark | `#4D8DFF` square, `#05070C` letter | end card only |

**Temperature is the storytelling device.** Anything can sit on the warm-to-cool scale (a value
from 0 to 1): in film 01 money cools as it is laundered; in films 02 to 04 a radar blip, a file
block or a person marker cools as the firm **understands** it. Warm never means "guilty": it means
"not yet understood". The HUD dot shows the film's temperature at a glance.

### Camera

- Keyframes of centre x, centre y and zoom z, each with an easing. **Zoom is interpolated in log
  space** so zooms feel even.
- House easing for moves: `cubic-bezier(.65,0,.25,1)` (slow out, decisive, long settle). Between
  moves the camera never stops: a slow linear drift of 2 to 5 % in zoom.
- **Dip**: on long moves the camera pulls back mid-move (0.18 to 0.22 of z) and comes back in, so
  the viewer sees where they are going.
- **Level of detail**: fine labels fade out when zoomed out (between z 0.45 and 0.62) and on
  narrow screens; the layout switches at 560 px and 900 px of player width (bigger type, fewer
  labels).

### Kinetic type

- Words (or letters, for mono eyebrows) **rise from behind a mask**, staggered 0.06 to 0.09 s, with
  the site easing `cubic-bezier(.16,1,.3,1)`; out: they fall back with an ease-in. One word can be
  tinted (warm or cool) to carry the meaning.
- **Scene header**: top left, a short accent bar that grows, a mono eyebrow in tracked capitals
  (`01 · PLACEMENT`), then a 58 px headline of four to six words. A soft scrim keeps it readable
  over whatever the camera passes. On phones the headline yields the frame back after about three
  seconds.
- **HUD**: top right, mono `FICTIONAL EXAMPLE` over the case name or key figure, with a glowing
  temperature dot.
- Headlines are short slogans; the claims live in the captions. Both are ledgered.

### Motifs

- **Comet**: a luminous head (white core, radial glow) and a tapering tail along a curved path,
  additive blending, coloured by temperature, leaving a faint trace. In film 01 it is money. In
  films 02 to 04 it is anything that **moves**: payments (02 risks beat), data flowing into the file
  (03), ownership percentages travelling up the chart (04).
- **Line art drawn on**: shapes appear by tracing their outline (path-length reveal, staggered).
- **Cards**: rounded cards with a hairline border tinted by temperature; a pulse ring when
  something lands on them. Company cards carry a mono country or status pill.
- **Stack reveal**: cards fanning out behind a card (film 01's shells behind the company), reused
  for the holding company in film 04.
- **Dashed silhouette**: the unknown person (film 01's "Beneficial owner?"); in film 04 it turns
  solid and cool once identified.
- Background: a dot grid that rescales with zoom, soft region glows, a vignette, film grain at
  3.5 % re-seeded 24 times a second, fade in from black over 0.35 s.

### Sound (off until the viewer asks)

Generated with WebAudio, no files: a low pulse at each scene change, soft ticks and tocks for
events (deposits, hops, blocks), a low tone for a reveal, light tones for detection marks, a chord
on the end card. New films reuse the same palette of sounds.

### End card

The world dims to about 32 %. A two-line kinetic headline (key word in cool), the RegRadar mark
and wordmark rise in, then two mono footers: the law with its application date
(`AMLR · Regulation (EU) 2024/1624 · applies from 10 July 2027`) and
`Fictional example. Not legal advice.`

### Lessons from film 01 (do not reuse)

Found while preparing these scripts; they concern the built film 01, not these scripts.

1. **Control cards tagged with stages.** The detection cards in film 01 carry the eyebrows
   `01 · PLACEMENT`, `02 · LAYERING`, `03 · INTEGRATION` above CDD, TM and STR. That maps one
   control to one stage, which its own ledger (row 9) and gate rule 4 rule out. New films never
   number controls by stage.
2. **On-canvas text that the ledger did not see.** Film 01's ledger row 6 records that "who pays
   in" was reworded in the caption, but the desktop CDD card on the canvas still reads
   `Who pays in?`. From film 02 on, every on-canvas string that carries a claim has its own ledger
   row (the "Where" column says `on canvas`).

Both should be fixed on `lab/010-follow-the-money` before that film leaves the lab.

## Proposal: one scene-data format for all films (description only)

Today film 01 is one hand-written file: its story data (amounts, nodes, hops, camera, captions)
sits inside the renderer. To play films 02 to 04 with **one engine**, each film becomes a data file
(proposed: `docs/data/academy/films/<id>.json`) and the engine draws it. The format below is a
proposal for review; nothing is built.

### Principles

- **Time is the only input.** Every element has entry and exit times; the engine draws the frame
  for time t. Scrubbing, stills and reduced motion come free.
- **Words are data, and every word points to the ledger.** Each caption, headline, label and
  on-canvas string carries a `claim` key (`"aml-basics#16"`) or `"none"` for pure decoration.
  A check (an extension of `academy/verify.mjs`) then fails when a string has no ledger row, when
  the string differs from the ledger wording, or when a cited article does not exist. This makes
  gate step 6 (the words on screen are the words checked) automatic.
- **Temperature, not colour.** Elements carry a temperature from 0 (warm) to 1 (cool), or a
  timeline of temperatures; the engine maps it to the palette. Films cannot drift off-palette.
- **A small set of element types** covers the four films; new types are added to the engine, not
  improvised in a film.

### Top-level fields

| Field | Content |
|---|---|
| `id`, `version`, `module` | film id, script version, curriculum module id |
| `title`, `duration`, `lang` | as shown in the player; duration in seconds (30 to 90) |
| `brief` | audience, one message, situation or typology named, fictional items (shown in the fine print) |
| `ledger` | path to the ledger (`FACTCHECK.md`) and its status: `self-checked`, `independently checked`, `signed off`, `needs review` |
| `law` | celex ids and articles the film relies on, so a change in `docs/data/laws/` can mark the film `needs review` (gate step 7) |
| `world` | logical frame (1600 x 900) and world bounds |
| `seed` | random seed for grain, jitter and positions |
| `camera` | list of keyframes: time, x, y, zoom, easing name, optional dip |
| `chapters` | time and name, for ticks and chips |
| `captions` | time in, time out, text (with a light bold markup), `claim` keys |
| `headers` | eyebrow, one or two headline lines (optional swap time), time in and out, accent temperature, `claim` |
| `hud` | label, value, time range, temperature timeline |
| `elements` | the picture (next table) |
| `flows` | comets: from element, to element (or a world point), start, duration, temperature, bend, optional mono label with `claim` |
| `type` | free kinetic text: string, position, size, weight, mono or sans, alignment, split by word or letter, stagger, tinted word indexes, time in and out, `claim` |
| `sounds` | time and sound name from the shared set |
| `stills` | time, heading, still caption (reduced motion grid) |
| `transcript` | generated from `captions`, never written by hand |
| `end_card` | headline lines, tinted word, footers |
| `responsive` | per breakpoint (`sm` under 560 px, `md` under 900 px): which labels hide, size multipliers |

### Element types (enough for films 01 to 04)

| Type | Used for | Key properties |
|---|---|---|
| `card` | companies, accounts, customers, the customer file, outcome cards | position, size, title, mono pill, lines of text, temperature timeline, pulse times |
| `person` | beneficial owners, customers | position, name, dashed or solid, temperature timeline, tag (`BENEFICIAL OWNER`) |
| `lineart` | café, prepaid card, apartment, yacht | list of polylines, draw-on time and stagger |
| `stack` | blocks building up on a card (CDD measures, EDD extras) | parent card, ordered blocks with label, temperature and land time |
| `radar` | business-wide risk assessment (02) | centre, radius, spoke labels, sweep period, blips (spoke, distance, label, temperature, time) |
| `dial` | risk scale (02, 03) | ends' labels, needle per customer with settle time |
| `meter` | ownership bars against the 25 % line (04) | threshold, bars per person with value timeline, crossing tag |
| `edge` | ownership and control links | from, to, kind (`owns`, `controls`), percentage label, dashed or solid |
| `tiles` | trigger lists, warning-sign chips | items with label, temperature, tick time |
| `ruler` | review intervals (03) | markers and pulses along a time axis |
| `stamp` | `BEFORE LAUNCH` (02) | text, position, land time |
| `math` | `45 % × 40 % = 18 %` | string typed on beside a path, with `claim` |

Each element has `id`, `t_in`, optional `t_out`, and optional `claim` for any text it shows.

### Illustrative shape (not code, not final)

```json
{
  "id": "beneficial-ownership",
  "version": "script-v1",
  "module": "beneficial-ownership",
  "duration": 60,
  "ledger": { "path": "docs/labs/04-look-through/FACTCHECK.md", "status": "self-checked" },
  "law": [{ "celex": "32024R1624", "arts": ["2", "20", "21", "22", "24", "51", "52", "53", "90"] }],
  "captions": [
    { "t0": 12, "t1": 18, "text": "Ownership means 25 % or more of the shares, voting rights or other ownership interest, directly or indirectly. Mira holds 30 % directly: she is a beneficial owner.", "claim": ["beneficial-ownership#7", "beneficial-ownership#9"] }
  ],
  "elements": [
    { "id": "meter", "type": "meter", "threshold": 25, "t_in": 12.2,
      "bars": [{ "person": "jonas", "values": [[22.5, 18], [29.0, 26]], "claim": "beneficial-ownership#11" }] }
  ],
  "flows": [
    { "from": "jonas", "to": "kappa", "t0": 19.4, "dur": 0.8, "temp": 0.4 },
    { "from": "kappa", "to": "velmont", "t0": 20.2, "dur": 0.8, "temp": 0.4,
      "label": "45 % × 40 % = 18 %", "claim": "beneficial-ownership#10" }
  ]
}
```

### What stays in code

Easing curves, the comet, kinetic type, grain, vignette, camera maths, sounds, the player and its
accessibility. Film 01 can be ported to the format later as the test that the engine is complete;
until then it stays as it is.
