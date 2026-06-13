// world.js — builds the scene: realistic sky + sun, textured sand, the Kaʿba,
// palms, rocks, and the clan elders (NPCs other than the Prophet, who is never
// depicted — see docs R1/R4). Visual fidelity is tuned for atmosphere; the
// true AAA target lives in the Unreal path (docs/07).
import * as THREE from "three";
import { Sky } from "three/addons/objects/Sky.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

// Real character model loaded for the NPCs. This default is a realistic,
// textured, animated human served from a CORS-enabled CDN (jsDelivr → the
// three.js example assets). It is a *modern* figure — chosen for realism, not
// historical accuracy. Swap this URL for any .glb (e.g. a period-accurate robed
// character you obtain) and the loader below auto-fits and anchors it.
const CHARACTER_MODEL_URL =
  "https://cdn.jsdelivr.net/gh/mrdoob/three.js@r160/examples/models/gltf/Soldier.glb";

// Optional real palm/tree model. Empty by default (no reliable free, CORS-
// enabled palm .glb to reference blind) → improved procedural palms are used.
// Paste a .glb URL here and addPalms() will load it once and scatter clones,
// auto-fitting to ~7 m and anchoring to the ground; on failure it falls back
// to the procedural palm so the scene is never empty.
const PALM_MODEL_URL = "";

const gltfLoader = new GLTFLoader();

// Scatter palms across the given [x,z] positions. Uses a real model if
// PALM_MODEL_URL is set, otherwise the procedural makePalm().
function addPalms(parent, spots) {
  if (!PALM_MODEL_URL) {
    spots.forEach(([x, z]) => parent.add(makePalm(x, z)));
    return;
  }
  // Placeholders first, so something is there immediately.
  const placeholders = spots.map(([x, z]) => {
    const p = makePalm(x, z); parent.add(p); return p;
  });
  gltfLoader.load(PALM_MODEL_URL, (gltf) => {
    const base = gltf.scene;
    base.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
    let box = new THREE.Box3().setFromObject(base);
    const size = box.getSize(new THREE.Vector3());
    base.scale.setScalar(7 / (size.y || 1));
    spots.forEach(([x, z], i) => {
      parent.remove(placeholders[i]);
      const tree = base.clone();
      const b = new THREE.Box3().setFromObject(tree);
      tree.position.set(x, -b.min.y, z);
      tree.rotation.y = Math.random() * Math.PI * 2;
      parent.add(tree);
    });
  }, undefined, (err) => {
    console.warn("[Nūr] palm model failed to load; using procedural palms.", err);
  });
}

export function buildWorld() {
  const scene = new THREE.Scene();
  // Warm horizon haze that matches the sky so distance fades naturally.
  scene.fog = new THREE.Fog(0xdcc6a0, 60, 240);

  // --- Sky + sun (atmospheric scattering) ---
  const sky = new Sky();
  sky.scale.setScalar(12000);
  scene.add(sky);
  const sunDir = new THREE.Vector3();
  const u = sky.material.uniforms;
  u["turbidity"].value = 6;
  u["rayleigh"].value = 1.2;
  u["mieCoefficient"].value = 0.006;
  u["mieDirectionalG"].value = 0.8;
  const elevation = 24, azimuth = 130; // warm mid-morning, long soft shadows
  const phi = THREE.MathUtils.degToRad(90 - elevation);
  const theta = THREE.MathUtils.degToRad(azimuth);
  sunDir.setFromSphericalCoords(1, phi, theta);
  u["sunPosition"].value.copy(sunDir);

  // --- Lighting ---
  const sun = new THREE.DirectionalLight(0xfff2d6, 3.0);
  sun.position.copy(sunDir).multiplyScalar(120);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 1; sun.shadow.camera.far = 260;
  sun.shadow.camera.left = -70; sun.shadow.camera.right = 70;
  sun.shadow.camera.top = 70; sun.shadow.camera.bottom = -70;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  scene.add(sun);
  // Sky fill (warm bounce from above, cool from the sand below).
  scene.add(new THREE.HemisphereLight(0xbcd2ff, 0xb89a63, 0.45));

  // --- Ground (textured sand) ---
  const sandTex = sandTexture();
  sandTex.wrapS = sandTex.wrapT = THREE.RepeatWrapping;
  sandTex.repeat.set(60, 60);
  sandTex.anisotropy = 8;
  const sandBump = sandTexture(true);
  sandBump.wrapS = sandBump.wrapT = THREE.RepeatWrapping;
  sandBump.repeat.set(60, 60);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(600, 600, 1, 1),
    new THREE.MeshStandardMaterial({
      map: sandTex, bumpMap: sandBump, bumpScale: 0.4,
      color: 0xe7cf9d, roughness: 1, metalness: 0,
    })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Distant dunes for a horizon silhouette.
  const duneMat = new THREE.MeshStandardMaterial({ color: 0xcdb079, roughness: 1 });
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + Math.random() * 0.3;
    const r = 150 + Math.random() * 40;
    const dune = new THREE.Mesh(
      new THREE.SphereGeometry(30 + Math.random() * 25, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      duneMat
    );
    dune.position.set(Math.cos(a) * r, -8 - Math.random() * 6, Math.sin(a) * r);
    dune.scale.y = 0.5;
    dune.receiveShadow = true;
    scene.add(dune);
  }

  // --- The Kaʿba (draped cube) ---
  const clothTex = clothTexture();
  clothTex.wrapS = clothTex.wrapT = THREE.RepeatWrapping;
  clothTex.repeat.set(2, 3);
  const kaaba = new THREE.Mesh(
    new THREE.BoxGeometry(9, 11, 9),
    new THREE.MeshStandardMaterial({ map: clothTex, color: 0x14110d, roughness: 0.85, metalness: 0.0 })
  );
  kaaba.position.set(0, 5.5, -22);
  kaaba.castShadow = kaaba.receiveShadow = true;
  kaaba.userData = { id: "kaaba", name: "The Kaʿba" };
  scene.add(kaaba);
  // Gold embroidery band — emissive so it catches the bloom (the "nūr" motif).
  const band = new THREE.Mesh(
    new THREE.BoxGeometry(9.25, 1.3, 9.25),
    new THREE.MeshStandardMaterial({
      color: 0xc9a45c, metalness: 0.85, roughness: 0.25,
      emissive: 0x6b4f1e, emissiveIntensity: 0.6,
    })
  );
  band.position.set(0, 8.7, -22);
  band.castShadow = true;
  scene.add(band);

  // --- Palms, rocks, shrubs ---
  const flora = new THREE.Group();
  const palmSpots = [];
  for (let i = 0; i < 22; i++) {
    const x = (Math.random() - 0.5) * 150, z = (Math.random() - 0.5) * 150;
    if (Math.hypot(x, z) < 14) continue; // keep the plaza clear
    palmSpots.push([x, z]);
  }
  addPalms(flora, palmSpots);
  for (let i = 0; i < 34; i++) {
    flora.add(makeRock((Math.random() - 0.5) * 160, (Math.random() - 0.5) * 160));
  }
  for (let i = 0; i < 40; i++) {
    const x = (Math.random() - 0.5) * 150, z = (Math.random() - 0.5) * 150;
    if (Math.hypot(x, z) < 12) continue;
    flora.add(makeShrub(x, z));
  }
  scene.add(flora);

  // --- Clan elders (interactable NPCs) ---
  const interactables = [];
  const mixers = [];
  const elderA = makePerson(0x4f6f8c, "elder_a", "Elder of Banū ʿAbd al-Dār", mixers);
  elderA.position.set(-9, 0, -8);
  elderA.rotation.y = Math.PI; // face the player (who arrives from +z)
  scene.add(elderA);
  interactables.push(elderA);

  const elderB = makePerson(0x7c4f3f, "elder_b", "Elder of Banū ʿAdī", mixers);
  elderB.position.set(9, 0, -8);
  elderB.rotation.y = Math.PI;
  scene.add(elderB);
  interactables.push(elderB);

  // The Black Stone on a low plinth (the decision point).
  const stoneSpot = new THREE.Group();
  const plinth = new THREE.Mesh(
    new THREE.CylinderGeometry(0.7, 0.85, 1.0, 16),
    new THREE.MeshStandardMaterial({ color: 0x6b6258, roughness: 0.7 })
  );
  plinth.position.y = 0.5; plinth.castShadow = plinth.receiveShadow = true;
  const stone = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.5, 1),
    new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.2, metalness: 0.3 })
  );
  stone.position.y = 1.25; stone.castShadow = true;
  stoneSpot.add(plinth, stone);
  stoneSpot.position.set(0, 0, -16);
  stoneSpot.userData = { id: "stone", name: "The Black Stone" };
  scene.add(stoneSpot);
  interactables.push(stoneSpot);

  return { scene, interactables, mixers };
}

// ---- Procedural textures (no external asset files needed) ----
function sandTexture(asBump = false) {
  const s = 512;
  const c = document.createElement("canvas");
  c.width = c.height = s;
  const g = c.getContext("2d");
  g.fillStyle = asBump ? "#808080" : "#e3cb98";
  g.fillRect(0, 0, s, s);
  // Fine grain.
  for (let i = 0; i < 60000; i++) {
    const x = Math.random() * s, y = Math.random() * s;
    const v = Math.random();
    if (asBump) {
      const l = Math.floor(110 + v * 70);
      g.fillStyle = `rgb(${l},${l},${l})`;
    } else {
      g.fillStyle = v > 0.5 ? `rgba(210,188,140,0.5)` : `rgba(160,135,90,0.35)`;
    }
    g.fillRect(x, y, 1.4, 1.4);
  }
  // Soft wind ripples.
  g.globalAlpha = asBump ? 0.5 : 0.12;
  for (let y = 0; y < s; y += 6) {
    g.strokeStyle = asBump ? "#6e6e6e" : "#9c7f54";
    g.beginPath();
    for (let x = 0; x <= s; x += 8) {
      const yy = y + Math.sin(x * 0.05 + y) * 2;
      x === 0 ? g.moveTo(x, yy) : g.lineTo(x, yy);
    }
    g.stroke();
  }
  g.globalAlpha = 1;
  const t = new THREE.CanvasTexture(c);
  if (!asBump) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function clothTexture() {
  const s = 256;
  const c = document.createElement("canvas");
  c.width = c.height = s;
  const g = c.getContext("2d");
  g.fillStyle = "#15120d";
  g.fillRect(0, 0, s, s);
  // Subtle woven weave.
  g.globalAlpha = 0.25;
  for (let i = 0; i < s; i += 3) {
    g.strokeStyle = "#241d12";
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i, s); g.stroke();
    g.strokeStyle = "#0b0906";
    g.beginPath(); g.moveTo(0, i); g.lineTo(s, i); g.stroke();
  }
  // Faint gold geometric motif.
  g.globalAlpha = 0.5;
  g.strokeStyle = "#7a5c25";
  for (let i = 0; i < 6; i++) {
    g.beginPath();
    g.arc((i + 0.5) * (s / 6), s / 2, 10, 0, Math.PI * 2);
    g.stroke();
  }
  g.globalAlpha = 1;
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const PALM_BARK = new THREE.MeshStandardMaterial({ color: 0x7a5a33, roughness: 1 });
const PALM_LEAF = new THREE.MeshStandardMaterial({ color: 0x55732f, roughness: 0.8, side: THREE.DoubleSide });

function makePalm(x, z) {
  const g = new THREE.Group();
  const h = 5 + Math.random() * 2.5;
  const lean = (Math.random() - 0.5) * 0.5;

  // Curved trunk: stacked tapering segments that accumulate a gentle lean,
  // with ring "scars" for bark relief.
  const segs = 6;
  let prevY = 0, tilt = 0;
  for (let i = 0; i < segs; i++) {
    const t = i / segs;
    const segH = h / segs;
    const rTop = 0.34 - t * 0.16, rBot = 0.36 - t * 0.16;
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, segH, 9), PALM_BARK);
    tilt += lean / segs;
    seg.position.set(Math.sin(tilt) * (prevY + segH / 2) * 0.12, prevY + segH / 2, 0);
    seg.rotation.z = -tilt;
    seg.castShadow = true;
    g.add(seg);
    prevY += segH;
  }
  const topX = Math.sin(tilt) * h * 0.12, topY = prevY;
  const crown = new THREE.Group();
  crown.position.set(topX, topY, 0);
  crown.rotation.z = -tilt;

  // Drooping fronds built as curved tapering strips.
  const n = 11;
  for (let i = 0; i < n; i++) {
    const frond = new THREE.Mesh(frondGeometry(3.0 + Math.random() * 0.8), PALM_LEAF);
    frond.rotation.y = (i / n) * Math.PI * 2 + Math.random() * 0.2;
    frond.rotation.z = 0.5 + Math.random() * 0.2; // lift then droop (curve does the droop)
    frond.castShadow = true;
    crown.add(frond);
  }
  // A few date clusters.
  const dateMat = new THREE.MeshStandardMaterial({ color: 0x6b3b1f, roughness: 0.7 });
  for (let i = 0; i < 2; i++) {
    const dates = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 8), dateMat);
    dates.scale.set(0.7, 1.3, 0.7);
    dates.position.set(Math.cos(i * 3) * 0.4, -0.3, Math.sin(i * 3) * 0.4);
    crown.add(dates);
  }
  g.add(crown);
  g.position.set(x, 0, z);
  return g;
}

// A curved, tapering palm frond as a flat strip (a central rib that arcs up
// then droops, with width narrowing to the tip).
function frondGeometry(len) {
  const segs = 10;
  const verts = [], idx = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const x = t * len;
    const y = Math.sin(t * Math.PI * 0.6) * 0.9 - t * t * 1.6; // up then droop
    const w = 0.34 * Math.pow(1 - t, 0.6);
    verts.push(x, y, -w, x, y, w);
  }
  for (let i = 0; i < segs; i++) {
    const a = i * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

function makeRock(x, z) {
  const r = 0.4 + Math.random() * 1.3;
  const geo = new THREE.DodecahedronGeometry(r, 1);
  // Perturb vertices for an irregular, natural silhouette.
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const n = 0.78 + Math.random() * 0.44;
    p.setXYZ(i, p.getX(i) * n, p.getY(i) * n, p.getZ(i) * n);
  }
  geo.computeVertexNormals();
  const shade = 0x7d7058 + Math.floor(Math.random() * 0x101010);
  const rock = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: shade, roughness: 1, flatShading: true }));
  rock.position.set(x, r * 0.35, z);
  rock.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
  rock.scale.y = 0.6 + Math.random() * 0.2;
  rock.castShadow = rock.receiveShadow = true;
  return rock;
}

// A small dry desert shrub (a clump of thin blades).
function makeShrub(x, z) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x6e6a3a, roughness: 1, side: THREE.DoubleSide });
  for (let i = 0; i < 7; i++) {
    const blade = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.5 + Math.random() * 0.3, 4), mat);
    blade.position.set((Math.random() - 0.5) * 0.3, 0.25, (Math.random() - 0.5) * 0.3);
    blade.rotation.set((Math.random() - 0.5) * 0.5, 0, (Math.random() - 0.5) * 0.5);
    blade.castShadow = true;
    g.add(blade);
  }
  g.position.set(x, 0, z);
  return g;
}

// A robed Arabian figure for NPCs (thobe, arms, head, beard, draped keffiyeh
// with an agal band). Hand-built and low-poly — dignified but not a scanned
// character model; true realism lives in the asset/Unreal path (docs/07).
const SKIN_TONES = [0xb07a4f, 0xc28e5e, 0x9c6a42, 0xd0a070];

// Interactable NPC: a group carrying userData (so raycasting/interaction works
// immediately), holding a hand-built robed figure as a fallback. We then try to
// load a real 3D character model and, on success, swap it in. If the load fails
// (offline/CORS), the fallback simply remains — interaction is unaffected.
function makePerson(robeColor, id, name, mixers) {
  const g = new THREE.Group();
  g.userData = { id, name };

  const fallback = makeFallbackFigure(robeColor);
  g.add(fallback);

  gltfLoader.load(
    CHARACTER_MODEL_URL,
    (gltf) => {
      const model = gltf.scene;
      model.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });

      // Fit to ~1.8 m tall and anchor feet at y=0, centered on x/z.
      let box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      model.scale.setScalar(1.8 / (size.y || 1));
      box = new THREE.Box3().setFromObject(model);
      const center = box.getCenter(new THREE.Vector3());
      model.position.set(-center.x, -box.min.y, -center.z);

      g.remove(fallback);
      g.add(model);

      if (gltf.animations && gltf.animations.length) {
        const mixer = new THREE.AnimationMixer(model);
        const clip = THREE.AnimationClip.findByName(gltf.animations, "Idle") || gltf.animations[0];
        mixer.clipAction(clip).play();
        mixers.push(mixer);
      }
    },
    undefined,
    (err) => { console.warn("[Nūr] character model failed to load; using fallback figure.", err); }
  );

  return g;
}

// The hand-built robed figure (used as a fallback / when offline).
function makeFallbackFigure(robeColor) {
  const g = new THREE.Group();
  const robeMat = new THREE.MeshStandardMaterial({ color: robeColor, roughness: 0.95 });
  const skinMat = new THREE.MeshStandardMaterial({
    color: SKIN_TONES[Math.floor(Math.random() * SKIN_TONES.length)], roughness: 0.7,
  });
  const clothMat = new THREE.MeshStandardMaterial({ color: 0xece4d2, roughness: 0.9 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.6 });

  // --- Thobe (flowing robe) via a lathed profile that flares at the hem ---
  const profile = [
    [0.06, 0.0], [0.5, 0.0], [0.46, 0.08], [0.4, 0.5],
    [0.34, 1.0], [0.3, 1.35], [0.26, 1.55], [0.15, 1.62],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const robe = new THREE.Mesh(new THREE.LatheGeometry(profile, 24), robeMat);
  robe.castShadow = robe.receiveShadow = true;
  g.add(robe);

  // --- Arms (down along the body) + hands ---
  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.11, 0.95, 10), robeMat);
    arm.position.set(side * 0.26, 1.05, 0);
    arm.rotation.z = side * 0.22;
    arm.castShadow = true;
    g.add(arm);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 10), skinMat);
    hand.position.set(side * 0.36, 0.58, 0);
    hand.castShadow = true;
    g.add(hand);
  }

  // --- Neck + head ---
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.16, 10), skinMat);
  neck.position.y = 1.66; g.add(neck);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 24, 24), skinMat);
  head.scale.set(0.92, 1.05, 0.95);
  head.position.y = 1.86; head.castShadow = true;
  g.add(head);
  // Nose, for a bit of facial relief.
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.12, 8), skinMat);
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, 1.85, 0.19);
  g.add(nose);
  // Beard (front-lower face).
  const beard = new THREE.Mesh(
    new THREE.SphereGeometry(0.19, 16, 16, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.55),
    darkMat
  );
  beard.scale.set(1.0, 1.1, 0.8);
  beard.position.set(0, 1.82, 0.04);
  g.add(beard);

  // --- Keffiyeh: cap + side drapes + agal band ---
  const cap = new THREE.Mesh(
    new THREE.SphereGeometry(0.225, 20, 16, 0, Math.PI * 2, 0, Math.PI / 1.7),
    clothMat
  );
  cap.position.y = 1.9; cap.castShadow = true;
  g.add(cap);
  for (const side of [-1, 1]) {
    const drape = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.45, 0.3), clothMat);
    drape.position.set(side * 0.2, 1.74, -0.02);
    drape.rotation.z = side * 0.15;
    drape.castShadow = true;
    g.add(drape);
  }
  const backDrape = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.4, 0.04), clothMat);
  backDrape.position.set(0, 1.74, -0.2);
  backDrape.castShadow = true;
  g.add(backDrape);
  const agal = new THREE.Mesh(new THREE.TorusGeometry(0.21, 0.028, 8, 24), darkMat);
  agal.rotation.x = Math.PI / 2;
  agal.position.y = 2.0;
  g.add(agal);

  g.userData = { id, name };
  return g;
}
