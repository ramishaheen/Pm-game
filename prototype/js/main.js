// main.js — bootstrap: renderer, menus, game loop, interaction wiring.
import * as THREE from "three";
import { buildWorld } from "./world.js";
import { Player } from "./player.js";
import { NarrativeEngine } from "./narrative.js";
import { AlAminMission } from "./mission.js";

const canvas = document.getElementById("scene");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 500);

const { scene, interactables } = buildWorld();
const player = new Player(camera, canvas);
const narrative = new NarrativeEngine();

// UI refs
const menu = document.getElementById("menu");
const pause = document.getElementById("pause");
const hud = document.getElementById("hud");
const crosshair = document.getElementById("crosshair");
const prompt = document.getElementById("prompt");
const promptText = document.getElementById("promptText");

let started = false;
let lookedAt = null;
const mission = new AlAminMission(narrative, () => { /* completion handled inline via objective */ });

// --- Menu / flow ---
document.getElementById("beginBtn").onclick = () => {
  menu.classList.add("hidden");
  hud.classList.remove("hidden");
  started = true;
  player.enabled = true;
  player.lock();
  mission.start();
};
document.getElementById("resumeBtn").onclick = () => {
  pause.classList.add("hidden");
  player.lock();
};

function narrationVisible() { return document.getElementById("narration").classList.contains("visible-narr"); }

// Pointer lock: when locked, the player controls the view. When narration is
// open we intentionally release the cursor so sourced choices are clickable.
document.addEventListener("pointerlockchange", () => {
  const locked = player.isLocked;
  player.enabled = locked && !narrationVisible();
  if (!locked && started && !narrationVisible() && menu.classList.contains("hidden")) {
    pause.classList.remove("hidden");
  }
});

canvas.addEventListener("click", () => {
  if (started && !narrationVisible() && pause.classList.contains("hidden")) player.lock();
});

// Interact
document.addEventListener("keydown", (e) => {
  if (e.code === "KeyE" && started && !narrationVisible() && !mission.busy && lookedAt) {
    mission.interact(lookedAt);
  }
});

// Keep player disabled while narration is up; re-enable when it closes.
function syncControlState() {
  if (!started) return;
  if (narrationVisible()) {
    player.enabled = false;
    if (player.isLocked) document.exitPointerLock();
  } else {
    player.enabled = player.isLocked;
  }
}

// --- Loop ---
let last = performance.now();
function tick(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;

  syncControlState();
  player.update(dt);

  // Gaze: highlight interactables and show the prompt.
  if (started && player.enabled) {
    lookedAt = player.getLookedAt(interactables);
    if (lookedAt) {
      crosshair.classList.add("active");
      prompt.classList.remove("hidden");
      const id = lookedAt.userData.id;
      promptText.textContent =
        id === "stone" ? "give your judgment" :
        id.startsWith("elder") ? "hear this clan" : "examine";
    } else {
      crosshair.classList.remove("active");
      prompt.classList.add("hidden");
    }
  } else {
    crosshair.classList.remove("active");
    prompt.classList.add("hidden");
  }

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
