import * as THREE from 'three';
import { Inventory } from '../inventory/Inventory.ts';
import { BlockId } from '../world/blocks.ts';
import { World } from '../world/World.ts';
import { InputManager } from '../game/InputManager.ts';
import { ITEMS } from '../inventory/items.ts';

export class Player {
  private static readonly HALF_WIDTH = .2999;
  readonly object = new THREE.Object3D();
  readonly camera = new THREE.PerspectiveCamera(72, 1, .05, 700);
  readonly inventory = new Inventory();
  readonly velocity = new THREE.Vector3();
  yaw = 0;
  pitch = 0;
  health = 100;
  hunger = 100;
  breath = 12;
  grounded = false;
  crouching = false;
  onDamage?: (amount: number) => void;
  onDeath?: () => void;
  onWater?: (inWater: boolean) => void;
  onStep?: () => void;
  onJump?: () => void;
  private sensitivity = .0022;
  private invertMouse = false;
  private wasInWater = false;
  private bobTime = 0;
  private survivalTimer = 0;
  private footTimer = 0;

  constructor(private readonly world: World, private readonly input: InputManager) {
    this.object.add(this.camera); this.camera.position.y = 1.62; this.object.name = 'player';
    this.input.onMouseMove = (dx, dy) => {
      this.yaw -= dx * this.sensitivity;
      this.pitch -= dy * this.sensitivity * (this.invertMouse ? -1 : 1);
      this.pitch = THREE.MathUtils.clamp(this.pitch, -Math.PI / 2 + .015, Math.PI / 2 - .015);
    };
  }

  setPosition(x: number, y: number, z: number): void { this.object.position.set(x, y, z); }
  get height(): number { return this.crouching ? 1.2 : 1.8; }

  update(dt: number, sensitivity: number, invertMouse: boolean, viewBobbing: boolean): void {
    if (!this.health) return;
    if (!this.world.chunks.has(`${Math.floor(this.object.position.x / 16)},${Math.floor(this.object.position.z / 16)}`)) return;
    this.sensitivity = sensitivity; this.invertMouse = invertMouse;
    this.object.rotation.y = this.yaw; this.camera.rotation.x = this.pitch;
    const p = this.object.position;
    const crouchKey = this.input.down('crouch');
    if (crouchKey) this.crouching = true;
    else if (!this.collides(p.x, p.y, p.z, 1.8)) this.crouching = false;
    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const direction = new THREE.Vector3();
    if (this.input.pointerLocked) {
      if (this.input.down('forward')) direction.add(forward);
      if (this.input.down('backward')) direction.sub(forward);
      if (this.input.down('right')) direction.add(right);
      if (this.input.down('left')) direction.sub(right);
    }
    if (direction.lengthSq()) direction.normalize();
    const swimming = this.isInWater();
    const sprinting = this.input.down('sprint') && !this.crouching && this.hunger > 5;
    const speed = swimming ? 3 : sprinting ? 7.6 : this.crouching ? 2 : 4.6;
    const acceleration = 1 - Math.exp(-dt * (this.grounded || swimming ? 14 : 5));
    this.velocity.x += (direction.x * speed - this.velocity.x) * acceleration;
    this.velocity.z += (direction.z * speed - this.velocity.z) * acceleration;
    if (this.input.consume(this.input.bindings.jump) && this.input.pointerLocked && this.grounded) { this.velocity.y = 8.4; this.grounded = false; this.onJump?.(); }
    const steps = Math.max(1, Math.ceil(dt / (1 / 90)));
    for (let i = 0; i < steps; i += 1) {
      const step = dt / steps;
      this.velocity.y = Math.max(-35, this.velocity.y - (swimming ? 6 : 24) * step);
      if (swimming) { this.velocity.y *= Math.exp(-step * 3); if (this.input.down('jump')) this.velocity.y = 3.4; if (this.crouching) this.velocity.y = -2; }
      this.moveHorizontal('x', this.velocity.x * step);
      this.moveHorizontal('z', this.velocity.z * step);
      this.moveVertical(this.velocity.y * step, swimming);
    }
    if (direction.lengthSq() && this.grounded) {
      this.bobTime += dt * (sprinting ? 13 : 9); this.footTimer += dt;
      if (this.footTimer > (sprinting ? .32 : .48)) { this.footTimer = 0; this.onStep?.(); }
    }
    const eyeHeight = this.crouching ? 1.05 : 1.62;
    const bob = direction.lengthSq() && this.grounded && viewBobbing ? Math.sin(this.bobTime) * .028 : 0;
    this.camera.position.y += (eyeHeight + bob - this.camera.position.y) * Math.min(1, dt * 15);
    this.hunger = Math.max(0, this.hunger - dt * (sprinting && direction.lengthSq() ? .22 : .025));
    this.survivalTimer += dt;
    const headWater = this.world.getBlock(Math.floor(p.x), Math.floor(p.y + this.camera.position.y), Math.floor(p.z)) === BlockId.Water;
    this.breath = THREE.MathUtils.clamp(this.breath + (headWater ? -dt : dt * 3), 0, 12);
    if (this.survivalTimer >= 3) {
      this.survivalTimer = 0;
      if (this.breath <= 0 || this.hunger <= 0) this.takeDamage(4);
      else if (this.hunger > 70 && this.health < 100) { this.heal(2); this.hunger -= .7; }
    }
    if (swimming !== this.wasInWater) this.onWater?.(swimming);
    this.wasInWater = swimming;
  }

  private collides(x: number, y: number, z: number, height = this.height): boolean {
    for (let bx = Math.floor(x - Player.HALF_WIDTH); bx <= Math.floor(x + Player.HALF_WIDTH); bx += 1)
      for (let bz = Math.floor(z - Player.HALF_WIDTH); bz <= Math.floor(z + Player.HALF_WIDTH); bz += 1)
        for (let by = Math.floor(y + .001); by <= Math.floor(y + height - .001); by += 1)
          if (this.world.isBlockSolid(bx, by, bz)) return true;
    return false;
  }

  private moveHorizontal(axis: 'x' | 'z', amount: number): void {
    if (!amount) return;
    const p = this.object.position; const old = p[axis]; p[axis] += amount;
    if (!this.collides(p.x, p.y, p.z)) return;
    if (this.grounded && !this.crouching && !this.collides(p.x, p.y + 1.001, p.z)) { p.y += 1.001; this.velocity.y = 0; return; }
    p[axis] = old; this.velocity[axis] = 0;
  }

  private moveVertical(amount: number, swimming: boolean): void {
    const p = this.object.position; const old = p.y; p.y += amount;
    if (!this.collides(p.x, p.y, p.z)) { this.grounded = false; return; }
    if (amount < 0) {
      let floor = -Infinity;
      for (let x = Math.floor(p.x - Player.HALF_WIDTH); x <= Math.floor(p.x + Player.HALF_WIDTH); x += 1) for (let z = Math.floor(p.z - Player.HALF_WIDTH); z <= Math.floor(p.z + Player.HALF_WIDTH); z += 1)
        for (let y = Math.floor(p.y); y <= Math.floor(old); y += 1) if (this.world.isBlockSolid(x, y, z)) floor = Math.max(floor, y + 1);
      p.y = Number.isFinite(floor) ? floor : old;
      if (this.velocity.y < -12 && !swimming) this.takeDamage(Math.floor((Math.abs(this.velocity.y) - 12) * 2.2));
      this.grounded = true;
    } else p.y = old;
    this.velocity.y = 0;
  }

  intersectsBlock(x: number, y: number, z: number): boolean {
    const p = this.object.position; return p.x + .3 > x && p.x - .3 < x + 1 && p.z + .3 > z && p.z - .3 < z + 1 && p.y + this.height > y && p.y < y + 1;
  }
  isInWater(): boolean { const p = this.object.position; return this.world.getBlock(Math.floor(p.x), Math.floor(p.y + .65), Math.floor(p.z)) === BlockId.Water; }
  takeDamage(amount: number): void { if (amount <= 0 || this.health <= 0) return; this.health = Math.max(0, this.health - amount); this.onDamage?.(amount); if (!this.health) this.onDeath?.(); }
  heal(amount: number): void { this.health = Math.min(100, this.health + amount); }
  eat(): boolean {
    const stack = this.inventory.selectedStack; const definition = stack ? ITEMS[stack.id] : undefined;
    if (!stack || !definition?.food || this.hunger >= 100) return false;
    this.hunger = Math.min(100, this.hunger + definition.food * 3); this.heal(2); stack.count -= 1;
    if (!stack.count) this.inventory.slots[this.inventory.selected] = null;
    this.inventory.onChange?.(); return true;
  }
}
