# Promo film "One article, all the way down": plan (phase 1, nothing built)

Status: draft for owner sign-off. It follows `academy/SCRIPT_REVIEW.md`: the
script (`script.md`) and the claims ledger (`claims-ledger.md`) must pass an
independent check and the owner's sign-off before any frame is built.
Creative guidance taken from the open-source brag-slim skill (hook, clarity,
show the thing, readable timing, sound as one piece). Its default 20 s length
does not apply here.

## Angle

We follow **one real article**, from the law to the control. AMLR Art. 42(1)
has three lettered points, (a), (b) and (c). In the film it is a slab of text
that splits along those letters. Each point becomes a duty card, and each card
lands on a board where it gets a control, an owner and a status. One point has
no control and lights up warm: **the gap**. A thin glowing line (the "trail"
from film 01) draws back from the test to the article. This is not a metaphor
for the product: it is exactly what `workspace.html` and `topics.html` do with
the demo data today (`AMLR-art42` has the three sub-requirements, demo controls
`ctl-06` and `ctl-07` exist, and the gap markers are the product's own words).

One message: **from the law to the control, in one place, quoted word for
word and cited to the article.**

## Hook (0.0 to 2.0 s)

Frame 1 is already moving: the camera glides low across a deep stack of
translucent pages of real AMLR text, the planes sliding past at different
depths, the near ones soft and the far ones sharp. On the first downbeat a
low bell and a sub hit land, and the caption settles by 0.5 s:
**"The AMLR has 90 articles."** (true: `docs/data/laws/32024R1624_EN.json`
has articles 1 to 90). At 2.0 s it hands over to **"Which duties are yours?"**
A stranger gets the problem in two seconds without knowing the product.

## Reveal (4 to 10 s)

One page pulls forward out of the stack and turns square to the camera:
Art. 42(1), set in the serif the site uses for law, with point (a) lit:
"obtain senior management approval". Caption: "Max starts from the law, word
for word."

## Highlights (how it works in three beats, then two short extras)

1. **The article splits into duties** (10 to 16 s). The three points peel apart
   on three beats. Each point turns into a blue duty card.
2. **Each duty gets a control, an owner, a status** (16 to 24 s). The cards
   fly into a 3D board. (a) docks onto "Four-eyes approval on high-risk
   onboarding" (Sanmi O., In review), (c) onto "Enhanced ongoing monitoring,
   PEP book" (M. Van Damme, In review). (b) finds nothing: "No control mapped"
   in warm amber; (c) carries a small amber "Not tested". The gaps are shown,
   not hidden (these are the product's own gap markers, `docs/topics.js`).
3. **Log the test, keep the evidence, trace it back** (24 to 30 s). The (a)
   card flips to its test log: date, result, "Evidence: link". The trail line
   draws from the evidence back up to the article.

Extras (30 to 40 s): the topic view in four layers; the deadlines calendar;
training with a printable record.

## Punchline (40 to 44 s) and end card (44 to 48 s)

The camera pulls back and up: the whole chain, law, duty, control, test,
evidence, sits on one plane, cool green where linked and amber where the
product marks a gap.
**"From the law to the control. In one place."** End card on navy: "Max",
then "Prototype with sample data. Not legal advice." No company name.
Optional: the all-black cat sits beside the word and blinks once.

## Tone and identity

Tone: brag "polished" crossed with "deadpan": calm, exact, confident; long
holds, soft dips through the background, no hype words. Colours are the
landing page tokens (`docs/index.html`): ink `#05070C`, law `#F5F7FB`, duty
blue `#5B8CFF`, control green `#3DDCA7` (clean), count amber `#FFB454` (risk
and gaps), layer grounds `#1A2030 / #16224A / #0E2C28 / #30200A`. Type: system
SF Pro Display for captions, Georgia for law text, SF Mono for locators
("AMLR Art. 42(1)"). A small "Prototype · sample data" tag sits top right from
4 s to 44 s.

## Tempo

**120 BPM**, 4/4: one beat = 0.5 s = 15 frames, one bar = 2 s = 60 frames.
Length **48 s = 24 bars** (inside the 30 to 60 s brief; 3 s over the 45 s
target so that every line meets the 0.3 s per word rule). Every cut is on a
bar line; every card arrival is on a beat. Key: D minor (D, F, A, C on the
plucks; effects tuned to D and A).

## Storyboard

Times in seconds, frames at 30 fps. "Settled" = the whole line is on screen
and still. Caption ids refer to `script.md`.

| # | Time | Bars | Visual (camera, layers, motion) | Text on screen | Audio |
|---|---|---|---|---|---|
| 1 Hook | 0.0 to 4.0 | 1 to 2 | Perspective camera (35 mm feel) dollies low and fast across about 20 translucent page planes of real AMLR text (Art. 1 to 90 headings visible as texture), z-spread 0 to 3000 units, depth of field focused at mid-stack, slow parallax; faint grain. At 2.0 s the dolly brakes and the stack tilts up like a cliff face. | C1 0.1 to 2.0 (settled 0.4); C2 2.2 to 4.0 (settled 2.5) | Bar 1 beat 1: bell (D) + sub drop. Filtered pulse (8ths) fades in. Bar 2: kick on 1 and 3, soft hat 8ths. |
| 2 Reveal | 4.0 to 10.0 | 3 to 5 | One page (Art. 42) slides out of the stack toward camera, rotates from 35 deg to face-on, others go out of focus and dim. Point (a) highlights with a law-white underline sweep on beat. Locator chip appears below. Prototype tag fades in top right. | C3 4.4 to 7.6 (settled 4.8); C4 chip 6.0 to 10.0; texture: full Art. 42(1) text | Pad (Dm9) enters, low-pass opening over 3 bars. "Paper" whoosh (band-passed noise, tuned to A) under the slide-out, landing on bar 3 beat 1. Underline sweep = soft rising tone into beat. |
| 3 Duties | 10.0 to 16.0 | 6 to 8 | The page cracks along the lines between (a), (b), (c) on beats 10.5 / 11.0 / 11.5; the three slices drift apart in z, each rotates 180 deg in 9 frames and becomes a blue duty card (front: the key words of its point, verbatim; back: the full point as faint texture). Camera orbits 15 deg right. | C5 10.4 to 13.0 (settled 10.7); cards K1 to K3 settled by 11.8, held to 16.0 | Three plucks D, F, A on the three crack beats; a light glass crack layered at -24 dB. Bass enters bar 7 (D, root-fifth). |
| 4 Board | 16.0 to 24.0 | 9 to 12 | Hard cut on bar 9 to the 3D board: four columns ("To do", "In progress", "Waiting for approval", "Done") on a tilted plane receding to a vanishing point. The duty cards arc in from the left on beats and dock beside control cards: (a) + ctl-06, (c) + ctl-07 (green edge, owner, "In review" pill; ctl-07 also gets a small amber "Not tested" tag). (b) docks into an empty slot; its slot glows amber with "No control mapped". Camera slow push toward (b) from 20.0 s. | C6 16.4 to 20.2 (settled 16.7); C7 20.5 to 24.0 (settled 20.8); card texts K4 to K9 | Full groove: kick, clap on 2 and 4 (soft), bass 8ths. Each dock = muted wood tick on the beat, panned to the card's x. Gap reveal at 20.0: the music drops to pad + sub only for one bar, one low amber tone (A, slightly flat sine pair, beating gently). Groove returns bar 12. |
| 5 Test and trail | 24.0 to 30.0 | 13 to 15 | Cut to close-up of the (a) control card; it flips (Y rotate) to its test log, where a test is logged as the user would in `workspace.html` ("Log test today"): result "Effective", "Evidence: link or reference". Illustrative user action on sample data; no date shown. Then the trail: a thin luminous line (film 01 motif) draws from the evidence row to the control, to the duty, and up to the Art. 42(1)(a) page, which fades back in deep behind; the camera rides along the line in a crane move. | C8 24.4 to 27.4 (settled 24.7); C9 27.5 to 30.0 (settled 27.8); K10 | Flip = soft card swish on beat 1 of bar 13; "logged" = two-note chime (A then D) on bar 13 beat 3. Trail = rising filtered arpeggio D-F-A-C in 16ths, one note per node, landing on bar 15 beat 1. |
| 6 Topic view | 30.0 to 34.0 | 16 to 17 | Dip through navy, then four layered planes stacked in depth like the landing hero stack (`docs/index.html` `.stack3d`): "AMLR (the law)", "AMLA (RTS drafts, guidelines)", "Supervisors and guidance (NBB, EBA, FATF...)", "Your controls". Camera rises through them, parallax between layers. Only the law layer and the AMLA mandate line carry readable text. | C10 30.4 to 34.0 (settled 30.7); K11 labels as texture | Pad chord moves to Bb maj7. Each layer passing = airy swell, 4 in 2 bars. |
| 7 Calendar | 34.0 to 37.0 | 18 to mid 19 | A month grid in perspective lies like a floor; the camera tilts down onto 10 July 2027; a date tile rises with "AMLR applies" and the source line. | C11 34.4 to 37.0 (settled 34.7); K12 | Clock-like tick on each beat (filtered click in the groove), soft bell on the tile rise. |
| 8 Training | 37.0 to 40.0 | mid 19 to 20 | A certificate sheet floats up from below, slight paper bend, light sweep across. Small verbatim quote of Art. 12 under it. | C12 37.3 to 40.0 (settled 37.6); K13 | Groove thins to kick and pad; pen-scratch noise (very soft) on the sheet's arrival. |
| 9 Punchline | 40.0 to 44.0 | 21 to 22 | Pull back and up: every element from scenes 2 to 8 now sits on one plane, linked by the trail; green where linked, amber on the two gap markers. Depth of field opens until all is sharp. | C13 40.4 to 44.0 (settled 40.7) | Full mix for one bar, then the last kick at bar 22 beat 1; pad resolves to Dm(add9). |
| 10 End card | 44.0 to 48.0 | 23 to 24 | Navy. "Max" centred, then the line below. Optional cat cameo (all black silhouette, one slow blink at 46.0). | C14 44.3 to 48.0; C15 44.8 to 48.0 (settled 45.1) | Final bell (D) on bar 23 beat 1, long reverb tail, everything else out. Silence from 47.5. |

Reading-time check (0.3 s per word, counted from settled): every caption
in `script.md` lists its words, the time it needs and the time it gets; all
pass with at least 0.3 s to spare.

## Transitions and stills to check

Cuts on bars 3, 6, 9, 13, 16, 18 (mid), 19 (mid), 21, 23. No busy crossfades:
old content out, then new in, or a 6-frame dip through navy. Stills to
inspect before the full render: the middle of every scene and every cut at
minus 8 and plus 8 frames (22 stills), at 16:9 and at 9:16.

## Vertical 9:16 cut (1080 x 1920)

Same scene graph and the same timeline and audio, a second camera rig:
- Captions move to the upper third (safe area 160 px from the top, 320 px from
  the bottom for platform UI); width 900 px; same timings.
- Hook: the page stack is turned 90 deg so pages fall away downward (a well,
  not a corridor).
- Board: one column at a time; the camera pans down the "In review" column,
  the gap slot shown last; card size 900 px wide.
- Topic layers and calendar keep their depth moves; the certificate fills the
  frame.
- End card unchanged, scaled.

## What is not in the film (on purpose)

No company name, no customers, logos, testimonials, prices, numbers we cannot
prove, certifications, "AI-powered", or claims about supervisors' acceptance.
No chat with the assistant (it does not exist yet). No real personal data:
owner names are the fictional demo names from `docs/data/controls.json`.

## Open questions for the owner

1. Length: 48 s (24 bars) so every line can be read at 0.3 s per word. Accept,
   or cut the training scene (scene 8) to get to 45 s?
2. Cat cameo on the end card (all black, one blink): yes or no?
3. Per-point mapping: the register stores Art. 42 as one obligation with three
   sub-requirements, and controls link to the obligation, not to a point. The
   film links per point for clarity. Accept the simplification, or show both
   controls linking to the one Art. 42 card?
4. Calendar card source line: show "Source: AMLR Art. 90" (the law) or the
   calendar's own source label (it cites `applicability.json` and links the
   law page)?
5. Demo owner names (Sanmi O., M. Van Damme, from `controls.json`) or roles
   ("MLRO", "Analyst")?
6. Poster on frame 0 (brag habit) or keep the hook's first frame?
7. Installing tools for .mp4: may we use the Apple route (may prompt for the
   Xcode Command Line Tools), or install ffmpeg, or stay with .webm only?
