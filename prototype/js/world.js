// world.js — builds the scene: desert, light, the Kaʿba, palms, and the clan
// elders (NPCs other than the Prophet, who is never depicted — see docs R1/R4).
import * as THREE from "three";

export function buildWorld() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xbfa97a);
  scene.fog = new THREE.Fog(0xc9b487, 40, 140);

  // --- Lighting: warm desert sun ("nūr" motif, see docs/07) ---
  const sun = new THREE.DirectionalLight(0xfff1d0, 2.2);
  sun.position.set(30, 50, 20);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -60; sun.shadow.camera.right = 60;
  sun.shadow.camera.top = 60; sun.shadow.camera.bottom = -60;
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xffe9c0, 0x6b5836, 0.7));

  // --- Ground (sand) ---
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(400, 400),
    new THREE.MeshStandardMaterial({ color: 0xd9c08a, roughness: 1 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Low surrounding hills (Mecca's valley), for silhouette only.
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const hill = new THREE.Mesh(
      new THREE.ConeGeometry(18 + Math.random() * 10, 14 + Math.random() * 8, 6),
      new THREE.MeshStandardMaterial({ color: 0xb39a6a, roughness: 1 })
    );
    hill.position.set(Math.cos(a) * 95, 4, Math.sin(a) * 95);
    hill.castShadow = hill.receiveShadow = true;
    scene.add(hill);
  }

  // --- The Kaʿba (placeholder cube, draped) ---
  const kaaba = new THREE.Mesh(
    new THREE.BoxGeometry(9, 11, 9),
    new THREE.MeshStandardMaterial({ color: 0x1b1b1b, roughness: 0.7, metalness: 0.05 })
  );
  kaaba.position.set(0, 5.5, -22);
  kaaba.castShadow = kaaba.receiveShadow = true;
  kaaba.userData = { id: "kaaba", name: "The Kaʿba" };
  scene.add(kaaba);
  // A gold band, evoking the kiswah's embroidery.
  const band = new THREE.Mesh(
    new THREE.BoxGeometry(9.2, 1.2, 9.2),
    new THREE.MeshStandardMaterial({ color: 0xc9a45c, metalness: 0.6, roughness: 0.3 })
  );
  band.position.set(0, 8.6, -22);
  scene.add(band);

  // Date palms scattered around.
  const palmGroup = new THREE.Group();
  for (let i = 0; i < 14; i++) {
    palmGroup.add(makePalm(
      (Math.random() - 0.5) * 120,
      (Math.random() - 0.5) * 120
    ));
  }
  scene.add(palmGroup);

  // --- Clan elders (interactable NPCs) ---
  const interactables = [];
  const elderA = makePerson(0x5a7d9a, "elder_a", "Elder of Banū ʿAbd al-Dār");
  elderA.position.set(-9, 0, -8);
  elderA.rotation.y = Math.PI * 0.15;
  scene.add(elderA);
  interactables.push(elderA);

  const elderB = makePerson(0x8a5a4a, "elder_b", "Elder of Banū ʿAdī");
  elderB.position.set(9, 0, -8);
  elderB.rotation.y = -Math.PI * 0.15;
  scene.add(elderB);
  interactables.push(elderB);

  // The Black Stone's resting place by the Kaʿba (the decision point).
  const stoneSpot = makePerson(0x444444, "kaaba", "The Black Stone");
  // Represent the stone as a small dark plinth instead of a person.
  stoneSpot.clear();
  const plinth = new THREE.Mesh(
    new THREE.CylinderGeometry(0.6, 0.7, 1.0, 12),
    new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.5 })
  );
  plinth.position.y = 0.5;
  const stone = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 16, 16),
    new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.25, metalness: 0.2 })
  );
  stone.position.y = 1.2;
  stoneSpot.add(plinth, stone);
  stoneSpot.position.set(0, 0, -16);
  stoneSpot.userData = { id: "stone", name: "The Black Stone" };
  stoneSpot.castShadow = true;
  scene.add(stoneSpot);
  interactables.push(stoneSpot);

  return { scene, interactables };
}

function makePalm(x, z) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.25, 0.4, 6, 7),
    new THREE.MeshStandardMaterial({ color: 0x6b4f2a, roughness: 1 })
  );
  trunk.position.y = 3; trunk.castShadow = true;
  g.add(trunk);
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x4c6b2f, roughness: 1, side: THREE.DoubleSide });
  for (let i = 0; i < 7; i++) {
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.5, 4, 4), leafMat);
    leaf.position.y = 6;
    leaf.rotation.z = Math.PI / 2.4;
    leaf.rotation.y = (i / 7) * Math.PI * 2;
    leaf.translateY(1.8);
    leaf.castShadow = true;
    g.add(leaf);
  }
  g.position.set(x, 0, z);
  return g;
}

// A simple, dignified stylized human figure for NPCs (robe + head).
function makePerson(color, id, name) {
  const g = new THREE.Group();
  const robe = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.85, 1.7, 12),
    new THREE.MeshStandardMaterial({ color, roughness: 0.9 })
  );
  robe.position.y = 0.95; robe.castShadow = true;
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 16, 16),
    new THREE.MeshStandardMaterial({ color: 0xcaa472, roughness: 0.8 })
  );
  head.position.y = 2.0; head.castShadow = true;
  const cloth = new THREE.Mesh(
    new THREE.SphereGeometry(0.32, 16, 16, 0, Math.PI * 2, 0, Math.PI / 1.8),
    new THREE.MeshStandardMaterial({ color: color, roughness: 0.9 })
  );
  cloth.position.y = 2.05;
  g.add(robe, head, cloth);
  g.userData = { id, name };
  return g;
}
