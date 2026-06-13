// narrative.js — the narration & sourced-choice engine.
// The Prophet's words are shown as on-screen narration (never voiced); his
// lines are a special class flagged `prophet:true` and carry a `src` citation,
// mirroring the production design in docs/04 and docs/08.

export class NarrativeEngine {
  constructor() {
    this.box = document.getElementById("narration");
    this.speakerEl = document.getElementById("speaker");
    this.lineEl = document.getElementById("line");
    this.choicesEl = document.getElementById("choices");
    this.advanceEl = document.getElementById("advance");
    this._resolveAdvance = null;
    this._typing = false;
    this._fullText = "";

    document.addEventListener("keydown", (e) => {
      if (e.code === "Space" && this.box.classList.contains("visible-narr")) {
        e.preventDefault();
        if (this._typing) { this._finishTyping(); }
        else if (this._resolveAdvance) { const r = this._resolveAdvance; this._resolveAdvance = null; r(); }
      }
    });
  }

  _show() { this.box.classList.remove("hidden"); this.box.classList.add("visible-narr"); }
  hide() { this.box.classList.add("hidden"); this.box.classList.remove("visible-narr"); }

  // Display a line. Returns a promise that resolves when the player presses Space.
  say({ speaker = "", text = "", prophet = false, revelation = false } = {}) {
    return new Promise((resolve) => {
      this._show();
      this.choicesEl.innerHTML = "";
      this.advanceEl.classList.add("hidden");
      this.speakerEl.textContent = prophet ? "Muhammad ﷺ — narrated" : speaker;
      this.lineEl.className = revelation ? "revelation" : "";
      this._typeText(text, () => {
        this.advanceEl.classList.remove("hidden");
        this._resolveAdvance = resolve;
      });
    });
  }

  // Present sourced choices. Returns the chosen option's `value`.
  choose(prompt, options) {
    return new Promise((resolve) => {
      this._show();
      this.advanceEl.classList.add("hidden");
      this.lineEl.className = "";
      this.speakerEl.textContent = "Your judgment";
      this._typeText(prompt, () => {
        this.choicesEl.innerHTML = "";
        options.forEach((opt) => {
          const b = document.createElement("button");
          b.className = "choice";
          b.innerHTML = opt.label + (opt.src ? `<span class="src">${opt.src}</span>` : "");
          b.onclick = () => { this.choicesEl.innerHTML = ""; resolve(opt.value); };
          this.choicesEl.appendChild(b);
        });
      });
    });
  }

  _typeText(text, done) {
    this._fullText = text;
    this._typing = true;
    this.lineEl.textContent = "";
    let i = 0;
    clearInterval(this._timer);
    this._timer = setInterval(() => {
      this.lineEl.textContent = text.slice(0, ++i);
      if (i >= text.length) { this._finishTyping(); }
    }, 18);
    this._doneCb = done;
  }

  _finishTyping() {
    clearInterval(this._timer);
    this.lineEl.textContent = this._fullText;
    this._typing = false;
    if (this._doneCb) { const cb = this._doneCb; this._doneCb = null; cb(); }
  }
}
