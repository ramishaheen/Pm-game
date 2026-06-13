// player.js — first-person controller for the Prophet's point of view.
// Deliberately has NO viewmodel (no hands/body) and casts no self-geometry,
// so nothing of the Prophet is ever depicted (see docs/04, rules R1/R2).
import * as THREE from "three";

export class Player {
  constructor(camera, domElement) {
    this.camera = camera;
    this.dom = domElement;
    this.enabled = false;

    this.yaw = 0;
    this.pitch = 0;
    this.position = new THREE.Vector3(0, 1.7, 6); // eye height ~1.7m
    this.velocity = new THREE.Vector3();
    this.keys = {};
    this.speed = 4.2;

    this.raycaster = new THREE.Raycaster();
    this.raycaster.far = 60; // interaction reach (aim from across the courtyard)

    this._onMouseMove = this._onMouseMove.bind(this);
    this._onKeyDown = (e) => { this.keys[e.code] = true; };
    this._onKeyUp = (e) => { this.keys[e.code] = false; };

    document.addEventListener("keydown", this._onKeyDown);
    document.addEventListener("keyup", this._onKeyUp);
    document.addEventListener("mousemove", this._onMouseMove);
  }

  lock() { this.dom.requestPointerLock?.(); }
  get isLocked() { return document.pointerLockElement === this.dom; }

  _onMouseMove(e) {
    if (!this.enabled || !this.isLocked) return;
    const s = 0.0022;
    this.yaw -= e.movementX * s;
    this.pitch -= e.movementY * s;
    const lim = Math.PI / 2 - 0.05;
    this.pitch = Math.max(-lim, Math.min(lim, this.pitch));
  }

  // Returns the interactable object currently under the crosshair, if any.
  getLookedAt(interactables) {
    const dir = new THREE.Vector3(0, 0, -1).applyEuler(this.camera.rotation);
    this.raycaster.set(this.camera.position, dir);
    const hits = this.raycaster.intersectObjects(interactables, true);
    if (!hits.length) return null;
    // Walk up to the object that carries userData.id.
    let o = hits[0].object;
    while (o && !(o.userData && o.userData.id)) o = o.parent;
    return o || null;
  }

  update(dt) {
    if (!this.enabled) return;

    // Apply look.
    this.camera.rotation.order = "YXZ";
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;

    // Movement on the ground plane relative to facing.
    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const move = new THREE.Vector3();
    if (this.keys["KeyW"]) move.add(forward);
    if (this.keys["KeyS"]) move.sub(forward);
    if (this.keys["KeyD"]) move.add(right);
    if (this.keys["KeyA"]) move.sub(right);
    if (move.lengthSq() > 0) move.normalize().multiplyScalar(this.speed * dt);
    this.position.add(move);

    // Soft bounds so the player stays in the valley.
    const r = Math.hypot(this.position.x, this.position.z);
    if (r > 70) { this.position.x *= 70 / r; this.position.z *= 70 / r; }

    this.position.y = 1.7;
    this.camera.position.copy(this.position);
  }
}
