# 07 — Art Direction (the "Counter-Strike-quality" visual target)

Your reference to Counter-Strike is honored here: **realistic, high-fidelity,
present-day 3D visuals.** This document defines that target and how to hit it
respectfully.

## Visual target

- **Photorealistic-leaning, grounded realism.** Physically based rendering
  (PBR), realistic materials (sandstone, sun-bleached cloth, dust, leather,
  date palms), dynamic time-of-day and weather. The fidelity bar is modern AAA
  — comparable to the environmental realism players associate with current
  Source 2 / Unreal 5 titles.
- **Light as theme.** The motif of **nūr (light)** is the visual through-line:
  the harsh desert sun of Mecca, the warm lamplight of the home, the blinding
  transcendence of revelation, the dawn over Medina. Lighting is the primary
  emotional instrument.
- **Authentic 7th-century Arabia.** Researched, period-accurate architecture
  (Mecca's valley and the Kaʿba, Medina's date groves and mudbrick homes),
  clothing, tools, caravans, and landscape. Consultation with historians on
  material culture.

## Reverence in the art (hard constraints)

- **No depiction of the Prophet ﷺ** in any asset — no model, texture, shadow,
  silhouette, or reflection (R1, R2). Asset pipeline and code review must
  enforce a "no self-reflection / no viewmodel for the Prophet POV" rule.
- **Sacred phenomena are abstract** (R5): revelation and the Night Journey are
  light, particle, and sound — not modeled beings.
- **Calligraphy & geometry, not idols.** UI and reverent framing lean on
  Islamic geometric pattern and Arabic calligraphy (e.g., for narration of his
  words) rather than figural religious imagery.
- **Dignified human depiction.** Companions and other people are depicted with
  realism and dignity; no caricature of any group, including adversaries (R7).

## Audio direction

- **Spatial, cinematic sound.** Wind, crowd, the creak of leather, distant
  call across a valley — audio carries immersion as much as visuals.
- **Music.** Era-appropriate instrumentation and vocal *nasheed*-style themes;
  silence used deliberately (see psychological design). Care to respect
  differing views on instrumentation — an option for voice/percussion-only
  scoring should be considered.
- **Narration voice** for historical framing — warm, measured — distinct from
  the (never-fabricated) voice of the Prophet, which is text only.

## Recommended engine & tech

- **Unreal Engine 5** is the recommended target for the full game: Nanite +
  Lumen deliver the realistic lighting and geometry density the visual goal
  needs, with a strong cinematic toolset for the narrative beats.
  - *Unity (HDRP)* is a viable alternative if team familiarity favors it.
- **The prototype in this repo uses Three.js / WebGL** — not because it matches
  the final fidelity, but because it runs instantly in a browser with no build
  step, letting anyone *feel* the first-person perspective, narration system,
  and conscience loop today. It is a design proof, not the visual target.

## Style guardrail

Realism in service of reverence — never realism in service of shock. Where a
photorealistic depiction of suffering would become gratuitous (torture,
battlefield gore), the art deliberately pulls back to implication, dust, and
aftermath.
