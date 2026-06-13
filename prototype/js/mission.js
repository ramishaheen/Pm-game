// mission.js — the "Al-Amīn" vignette (Mission M1 from docs/03).
// A small objective state machine that drives the conscience loop:
// hear both clans, then resolve the dispute through wisdom, not force.

export class AlAminMission {
  constructor(narrative, onComplete) {
    this.n = narrative;
    this.onComplete = onComplete;
    this.objEl = document.getElementById("objText");
    this.heard = { elder_a: false, elder_b: false };
    this.state = "intro";
    this.busy = false;
  }

  setObjective(text) { this.objEl.textContent = text; }

  async start() {
    this.busy = true;
    await this.n.say({ prophet: true,
      text: "I had set out for the Sacred House, and found the clans in uproar over its rebuilding.",
    });
    await this.n.say({ speaker: "A bystander",
      text: "Al-Amīn! The Trustworthy comes. Let him judge between us — whoever enters first, we agreed to accept his word.",
    });
    await this.n.say({ speaker: "Narration",
      text: "The clans dispute who will have the honor of setting the Black Stone in its place. Tempers are drawn like swords. Hear them before you judge.",
    });
    this.n.hide();
    this.state = "gather";
    this.setObjective("Hear each clan. Look at an elder and press E.");
    this.busy = false;
  }

  // Called by main.js when the player presses E on something they're looking at.
  async interact(obj) {
    if (this.busy || !obj) return;
    const id = obj.userData?.id;

    if (this.state === "gather" && (id === "elder_a" || id === "elder_b")) {
      this.busy = true;
      if (id === "elder_a" && !this.heard.elder_a) {
        this.heard.elder_a = true;
        await this.n.say({ speaker: "Elder of Banū ʿAbd al-Dār",
          text: "Ours is the right! Our forefathers have served this House for generations. No other hand shall lift the Stone." });
      } else if (id === "elder_b" && !this.heard.elder_b) {
        this.heard.elder_b = true;
        await this.n.say({ speaker: "Elder of Banū ʿAdī",
          text: "We will not be cast aside. We have dipped our hands in blood over this — and we will again before we yield the honor." });
      } else {
        await this.n.say({ speaker: "Narration", text: "You have already heard this clan. Their position is unchanged." });
      }
      this.n.hide();
      this.busy = false;

      if (this.heard.elder_a && this.heard.elder_b) {
        this.state = "decide";
        this.setObjective("You have heard them all. Approach the Black Stone (press E) to give your judgment.");
      }
      return;
    }

    if (this.state === "decide" && id === "stone") {
      await this._decide();
      return;
    }
  }

  async _decide() {
    this.busy = true;
    const choice = await this.n.choose(
      "Every clan wants the honor, and none will yield. How will you settle it?",
      [
        { label: "Award the honor to the oldest, most senior clan.",
          src: "— a ruling by rank", value: "rank" },
        { label: "Cast lots and let chance decide.",
          src: "— a ruling by chance", value: "lots" },
        { label: "Spread your cloak, place the Stone upon it, and have a leader of every clan lift it together — then set it with your own hands.",
          src: "— Ibn Hishām, Sīrah", value: "cloak" },
      ]
    );

    if (choice === "cloak") {
      await this.n.say({ prophet: true,
        text: "Bring me a cloak. I laid the Black Stone upon it, and bade a chief of each clan take hold of an edge." });
      await this.n.say({ speaker: "Narration",
        text: "Together — no clan above another — they raised the Stone to its place. Then you alone set it in the wall. The honor was shared; the quarrel dissolved without a single blow." });
      await this.n.say({ prophet: true,
        text: "What pride divides, shared honor can heal." });
      this.n.hide();
      this.setObjective("Dispute resolved — without force. (Vignette complete.)");
      this.busy = false;
      this.onComplete?.();
    } else {
      const why = choice === "rank"
        ? "To raise one clan above the rest would only deepen their pride — and the blood they swore to spill would be spilled."
        : "Leaving so sacred an honor to chance satisfies no one; the losers would feel robbed, and the feud would harden.";
      await this.n.say({ speaker: "Narration", text: why + " There may be a way for no one to lose. Consider again." });
      this.n.hide();
      this.busy = false;
      // Let the player re-approach the Stone and choose again.
    }
  }
}
