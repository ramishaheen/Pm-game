# 08 — Technical Architecture

How a team would actually build *Nūr*. Two layers: the **production target**
(the real game) and the **prototype** (what's in this repo today).

## Production target (full game)

### Engine
- **Unreal Engine 5** (recommended). Nanite for dense period geometry, Lumen
  for the light-driven art direction, Sequencer for narrative cinematics,
  MetaSounds for spatial audio, and a data-driven dialogue/quest framework.

### Key custom systems

1. **Prophet-POV controller.** A first-person pawn with **no viewmodel**,
   flagged to be **excluded from all reflection captures, planar reflections,
   and shadow casting** for any self-geometry (there is none, but the flag is a
   belt-and-suspenders guarantee against accidental depiction — R1/R2). A
   project-wide lint/test asserts no mirror or reflective-water material is
   placed in Prophet-POV levels.
2. **Narration & sourced-dialogue system.** Data-driven (e.g., a dialogue graph
   + localized string tables). The Prophet's lines are a *special class* of
   node: text-only, sourced, with a citation field linking to
   `02-historical-research.md` references — so every quoted line is traceable
   for scholarly review.
3. **Gaze-interaction system.** Raycast-from-camera attention model driving NPC
   reactions and conversation initiation (the "presence" mechanic in
   `04-first-person-design.md`).
4. **Restraint/choice system.** A moral-choice framework where "do not act"
   is a first-class, instrumented input (held button / turn-away), with its own
   feedback and consequences.
5. **Reverence FX module.** Reusable light/particle/sound effects for
   revelation and the Night Journey, gated so they can never spawn a figural
   asset (R5).
6. **Codex/database** of people, places, events — unlockable, localized,
   citation-backed.

### Content & review pipeline
- A **scholarly-review gate** in the content workflow (R8): missions can't be
  marked "release-ready" until historical content is signed off. Citation
  fields and a review checklist live alongside the narrative data.
- Localization-first (Arabic, English, and major Muslim-world languages),
  with right-to-left UI support from day one.

### Platform
- PC first (the realistic-fidelity target), then current-gen consoles. Online
  is unnecessary — this is a single-player narrative game.

## Prototype (this repository)

Deliberately minimal and dependency-light so it runs anywhere:

- **Three.js (via CDN)** + vanilla JS modules, **no build step, no install.**
- Demonstrates: first-person bodiless POV, WASD + pointer-lock look, a simple
  PBR-ish desert/Kaʿba scene, the **gaze-to-interact** model, and the
  **narration system** delivering a sourced, choice-driven vignette (M1).
- Structure:
  ```
  prototype/
    index.html        ← entry; loads Three.js from CDN, sets up the canvas/UI
    styles.css        ← menu, narration box, objective HUD, reverent type
    js/
      main.js         ← bootstrap, menu → mission flow, game loop
      world.js        ← scene, lighting, ground, Kaʿba + palms placeholders
      player.js       ← first-person controller (no viewmodel), pointer lock
      narrative.js    ← narration/choice engine; the M1 script lives here
      mission.js      ← objective state machine for the demo vignette
  ```
- The prototype intentionally has **no avatar, no reflective surfaces, and no
  combat** — it showcases the respectful, conscience-driven core, not the
  battles.

## Why this split

The docs + prototype let a real studio (or a grant/scholar review board)
evaluate the *design and tone* immediately, while the architecture above
describes the production path to the realistic-fidelity game the brief asks
for.
