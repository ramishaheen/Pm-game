# 04 — First-Person Design: "Playing as the Prophet ﷺ" Without Depiction

You chose first-person *as* the Prophet ﷺ. This document defines exactly how
that works so the experience is immersive **and** never crosses the depiction
red line (R1, R2, R3, R5).

## The core technique: a bodiless, voiceless vantage

The camera **is** the Prophet's point of view, but he has no rendered presence:

- **No avatar.** No hands, arms, or body are drawn on screen (no "viewmodel").
  Where most first-person games show your hands, here the frame stays clear —
  reinforcing that you are inhabiting a perspective, not embodying a likeness.
  - *Exception:* In **1P-Companion** missions (where you play a named Sahabi,
    not the Prophet), normal first-person hands/body are allowed.
- **No reflection, no shadow.** Engineering must guarantee the Prophet's POV
  casts **no visible self-shadow** and that **no reflective surface** (mirror,
  still water, polished metal) ever renders a body. This is a hard constraint
  in the renderer and level design (R2).
- **No self-voice.** The Prophet does not speak in casual recorded VO. His
  authentic, sourced words appear as **on-screen narration** in a distinct,
  reverent typographic style, optionally with calligraphic framing. Others in
  the scene react and reply to him; the player feels addressed and answered
  without his voice being fabricated.

## How the player "acts" as him

Because he has no body or improvised voice, player agency is expressed through:

1. **Gaze & presence.** Looking at the right person/object drives events
   (others respond to your attention; conversations begin when you face
   someone).
2. **Choice prompts.** At decision points, the player selects from options that
   are **drawn from or consistent with the historical record** — never
   free-form words placed in his mouth. Choosing surfaces the *sourced*
   response as narration.
3. **Movement & positioning.** Where you go, what you approach, who you stand
   beside (e.g., stepping between Bilāl and his tormentor, or walking the ranks
   at the Trench).
4. **Restraint as input.** The signature mechanic: at moments where revenge or
   force is possible (Ṭāʾif, Fatḥ Makka), *the deliberate choice not to act* is
   the meaningful player input — see `05-psychological-design.md`.

## Conversation model

- NPCs (companions, adversaries, townspeople) are fully voiced and animated.
- When they address the Prophet, the player listens; when it's "his turn,"
  the player either **selects a sourced response** (shown as narration) or
  performs a **gesture/positioning** action.
- A subtle on-screen indicator (a soft light at frame center, never a face)
  can represent "his attention," so NPCs have something to orient to in
  cutscene framing without depicting him.

## Reverence rendering for sacred moments (R5)

- **Revelation / the angel Jibrīl:** pure light, harmonic sound design,
  air-pressure and bloom effects; the *world* reacts. No creature, no face.
- **The Night Journey:** abstract, non-literal — luminous architecture, a sense
  of ascent through light and verse. Explicitly not a "level to clear."
- **Prayer:** never scored or gamified (R6). It can be a calm, optional,
  player-initiated moment that restores focus, framed with dignity.

## Why this still feels powerful

Removing the avatar paradoxically deepens immersion: the player isn't watching
a character act righteously — *they are the one choosing restraint, mercy, and
truth, with nothing standing between them and the choice.* The absence is the
design.
