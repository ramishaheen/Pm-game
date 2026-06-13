// main.js — bootstrap: renderer, menus, game loop, interaction wiring.
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
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
// Filmic tone-mapping for realistic light response (works with the Sky's HDR range).
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.55;

const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.1, 2000);

const world = buildWorld();
const { scene, interactables, mixers } = world;

// Image-based lighting: bake an environment map from the sky so PBR materials
// receive realistic ambient light and subtle reflections. Wrapped defensively
// so a GPU/driver hiccup here can never block the game from starting.
try {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  scene.remove(world.sky);
  envScene.add(world.sky);
  scene.environment = pmrem.fromScene(envScene).texture;
  envScene.remove(world.sky);
  scene.add(world.sky);
  pmrem.dispose();
} catch (err) {
  console.warn("[Nūr] environment-lighting bake skipped:", err);
}
const player = new Player(camera, canvas);
const narrative = new NarrativeEngine();

// Post-processing: MSAA render target + a gentle bloom for the gold/light.
const renderTarget = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, { samples: 4 });
const composer = new EffectComposer(renderer, renderTarget);
composer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.35, // strength — subtle
  0.7,  // radius
  0.85  // threshold — only the brightest (sky, gold) bloom
);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// UI refs
const menu = document.getElementById("menu");
const pause = document.getElementById("pause");
const hud = document.getElementById("hud");
const crosshair = document.getElementById("crosshair");
const prompt = document.getElementById("prompt");
const promptText = document.getElementById("promptText");
const clickHint = document.getElementById("clickHint");

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
  try {
    for (const m of mixers) m.update(dt); // drive character idle animations
    world.update(now * 0.001, dt);        // palm sway + drifting dust
  } catch (err) { /* never let an animation hiccup halt the loop */ }

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
    lookedAt = null;
    crosshair.classList.remove("active");
    prompt.classList.add("hidden");
  }

  // "Click to look around" hint when the mouse isn't captured mid-game.
  const needClick = started && !narrationVisible() &&
    pause.classList.contains("hidden") && !player.isLocked;
  clickHint.classList.toggle("hidden", !needClick);

  composer.render();
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
  bloom.setSize(window.innerWidth, window.innerHeight);
});
