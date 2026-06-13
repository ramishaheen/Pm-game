# Nūr — A First-Person Journey Through the Life of Prophet Muhammad ﷺ

> Working title: **Nūr** (نور, "Light"). A respectful, historically-grounded,
> mission-based narrative game inspired by the Seerah (life) of Prophet
> Muhammad ﷺ — built for **emotional and psychological impact**, with
> realistic AAA-quality visuals.

This repository contains the **game design** and a **runnable browser
prototype** that demonstrates the core experience: a first-person,
narration-driven mission with the psychological loop that the full game is
built around.

---

## What this is (and is not)

This is **not** a violent first-person shooter. It borrows from Counter-Strike
*only* in its visual ambition — realistic, high-fidelity 3D environments —
not its gameplay. The Prophet's life was overwhelmingly about *da'wah*
(invitation), patience under persecution, justice, mercy, and
community-building. The game reflects that: combat exists (the historical
defensive battles) but is a small minority of the experience, and victory is
almost always measured in *conviction, restraint, and forgiveness* rather than
in enemies defeated.

### Design red lines (non-negotiable for respectfulness)

1. **The Prophet ﷺ is never visually depicted.** The player experiences the
   world *through his eyes* (first person, no avatar, no reflection, no mirror
   surfaces that would render a body). His speech is delivered as on-screen
   historical narration, not casual voice-acting.
2. **No invented dialogue is put in his mouth.** Where his words are shown,
   they are drawn from authenticated historical sources and clearly framed as
   narration/quotation.
3. **Era-accurate only.** 7th-century Arabia — no firearms, no anachronisms.
4. **Reverence over spectacle.** Sacred moments (revelation, the Night
   Journey) are conveyed through light, sound, and restraint — never literal
   or gamified.
5. **Scholarly review before release.** The narrative and historical content
   are intended to be reviewed by qualified scholars prior to any publication.

---

## Repository layout

```
README.md                     ← you are here
docs/
  01-vision-and-principles.md  ← design pillars + the respectful-design rulebook
  02-historical-research.md    ← Seerah research, the source material for missions
  03-narrative-and-missions.md ← the full chapter/mission breakdown
  04-first-person-design.md    ← how "playing as the Prophet" works without depiction
  05-psychological-design.md   ← how the game creates emotional/psychological impact
  06-systems-and-combat.md     ← mechanics, combat, non-combat verbs
  07-art-direction.md          ← the "CS-quality" realistic visual target + engine
  08-technical-architecture.md ← how a team would actually build it
  09-roadmap.md                ← phased plan from prototype → vertical slice → release
prototype/
  index.html                   ← open this in a browser to play the demo
  styles.css
  js/                          ← the prototype source (Three.js, no build step)
```

## Run the prototype

No build step. From the repo root:

```bash
# any static server works; e.g.:
python3 -m http.server 8000
# then open http://localhost:8000/prototype/
```

Or simply open `prototype/index.html` directly in a modern browser.

**Controls:** `WASD` move · mouse look (click to capture) · `E` interact ·
`Space` advance narration · `Esc` menu.

The demo ships one playable vignette — *"The Trustworthy"* (rebuilding the
Kaaba, the Black Stone dispute) — chosen because it shows the game's
non-combat, conscience-driven core: you resolve a tribal conflict with wisdom,
not force.

---

## Status

Pre-production. This is a design foundation + concept prototype, not a
finished game. See `docs/09-roadmap.md` for what production would involve.
