import * as THREE from 'three';
import { Inventory } from '../inventory/Inventory.ts';
import { ITEMS } from '../inventory/items.ts';
import { Player } from '../player/Player.ts';
import { BlockId } from '../world/blocks.ts';
import { World } from '../world/World.ts';
import { ParticleSystem } from '../systems/Particles.ts';

export type CreatureKind = 'brambleback' | 'skyshard' | 'mireling' | 'mosskin';
export interface CreatureDefinition { name: string; color: number; health: number; speed: number; damage: number; passive?: boolean; nocturnal?: boolean; ranged?: boolean; drop: string; }
export const CREATURES: Record<CreatureKind, CreatureDefinition> = {
  brambleback: { name: 'Brambleback', color: 0x945d47, health: 22, speed: 2.1, damage: 7, drop: 'copper' },
  skyshard: { name: 'Skyshard', color: 0x776899, health: 15, speed: 1.6, damage: 5, ranged: true, drop: 'coal' },
  mireling: { name: 'Mireling', color: 0x3c8f74, health: 16, speed: 2.6, damage: 6, nocturnal: true, drop: 'lumenite' },
  mosskin: { name: 'Mosskin', color: 0xa2bc73, health: 12, speed: 1.1, damage: 0, passive: true, drop: 'berries' },
};
interface DroppedItem { mesh: THREE.Mesh; id: string; count: number; durability?: number; velocity: THREE.Vector3; life: number; age: number; }
interface Creature { object: THREE.Group; kind: CreatureKind; health: number; velocity: THREE.Vector3; cooldown: number; wander: number; direction: THREE.Vector3; hurt: number; }
interface Projectile { mesh: THREE.Mesh; velocity: THREE.Vector3; life: number; }
export interface EntitySave { drops: Array<{ id: string; count: number; durability?: number; position: number[]; life: number }>; creatures: Array<{ kind: CreatureKind; health: number; position: number[] }> }

export class EntityManager {
  readonly group = new THREE.Group();
  private drops: DroppedItem[] = [];
  private creatures: Creature[] = [];
  private projectiles: Projectile[] = [];
  private spawnTimer = 3;
  private readonly dropGeometry = new THREE.BoxGeometry(.2, .2, .2);
  private readonly shotGeometry = new THREE.OctahedronGeometry(.13);
  private readonly shotMaterial = new THREE.MeshBasicMaterial({ color: 0xe5a2ff });
  private readonly materials = new Map<string, THREE.MeshLambertMaterial>();
  onMessage?: (message: string) => void;
  onPickup?: () => void;

  constructor(private readonly world: World, private readonly player: Player, private readonly inventory: Inventory, private readonly particles: ParticleSystem) {
    Object.entries(CREATURES).forEach(([kind, definition]) => this.materials.set(kind, new THREE.MeshLambertMaterial({ color: definition.color })));
    Object.entries(ITEMS).forEach(([id, definition]) => this.materials.set(id, new THREE.MeshLambertMaterial({ color: definition.color })));
  }

  spawnDrop(id: string, position: THREE.Vector3, count = 1, durability?: number): DroppedItem | undefined {
    if (!ITEMS[id] || count < 1) return undefined;
    if (this.drops.length >= 128) this.removeDrop(0);
    const mesh = new THREE.Mesh(this.dropGeometry, this.materials.get(id));
    mesh.position.copy(position).add(new THREE.Vector3(0, .15, 0));
    const drop: DroppedItem = { mesh, id, count, durability, velocity: new THREE.Vector3((Math.random() - .5) * 1.2, 2.2, (Math.random() - .5) * 1.2), life: 300, age: 0 };
    this.drops.push(drop);
    this.group.add(mesh);
    return drop;
  }

  update(dt: number, night: boolean): void {
    this.updateDrops(dt); this.updateProjectiles(dt);
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) { this.spawnTimer = 8 + Math.random() * 5; this.trySpawn(night); }
    this.updateCreatures(dt, night);
  }

  private updateDrops(dt: number): void {
    const target = this.player.object.position.clone().add(new THREE.Vector3(0, .7, 0));
    for (let i = this.drops.length - 1; i >= 0; i -= 1) {
      const drop = this.drops[i]; const p = drop.mesh.position; drop.life -= dt; drop.age += dt; drop.velocity.y -= 14 * dt;
      p.x += drop.velocity.x * dt; p.z += drop.velocity.z * dt;
      const nextY = p.y + drop.velocity.y * dt;
      if (this.world.isBlockSolid(Math.floor(p.x), Math.floor(nextY - .1), Math.floor(p.z))) {
        p.y = Math.floor(nextY - .1) + 1.11; drop.velocity.y = Math.abs(drop.velocity.y) > 1 ? -drop.velocity.y * .17 : 0; drop.velocity.x *= .7; drop.velocity.z *= .7;
      } else p.y = nextY;
      drop.mesh.rotation.y += dt * 2; drop.mesh.rotation.z = Math.sin(drop.age * 2) * .12;
      const distance = p.distanceTo(target);
      if (distance < 2.7 && drop.age > 1) { p.addScaledVector(target.clone().sub(p).normalize(), dt * (3.5 + (2.7 - distance) * 2)); }
      if (distance < .65 && drop.age > 1) {
        const remainder = this.inventory.add(drop.id, drop.count, drop.durability);
        if (remainder < drop.count) { this.onPickup?.(); drop.count = remainder; }
        if (!remainder) { this.removeDrop(i); continue; }
      }
      if (drop.life <= 0 || p.y < -20) this.removeDrop(i);
    }
  }

  private removeDrop(index: number): void { this.group.remove(this.drops[index].mesh); this.drops.splice(index, 1); }

  private trySpawn(night: boolean): void {
    if (this.creatures.length >= 14) return;
    const angle = Math.random() * Math.PI * 2; const radius = 11 + Math.random() * 18;
    const x = Math.floor(this.player.object.position.x + Math.cos(angle) * radius); const z = Math.floor(this.player.object.position.z + Math.sin(angle) * radius);
    if (!this.world.chunks.has(`${Math.floor(x / 16)},${Math.floor(z / 16)}`)) return;
    const y = this.world.getSurfaceY(x, z);
    const surfaceBlock = this.world.getBlock(x, y - 1, z);
    if (Math.abs(y - this.player.object.position.y) > 15 || this.world.getBlock(x, y, z) === BlockId.Water || surfaceBlock === BlockId.Leaves) return;
    const roll = Math.random();
    const kind: CreatureKind = night ? (roll < .5 ? 'mireling' : roll < .75 ? 'skyshard' : 'brambleback') : roll < .7 ? 'mosskin' : roll < .9 ? 'brambleback' : 'skyshard';
    this.spawnCreature(kind, x + .5, y, z + .5);
  }

  spawnCreature(kind: CreatureKind, x: number, y: number, z: number): Creature | undefined {
    const definition = CREATURES[kind]; if (!definition) return undefined;
    const object = new THREE.Group(); const material = this.materials.get(kind);
    const addBox = (w: number, h: number, d: number, px: number, py: number, pz: number, mat = material) => { const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); box.position.set(px, py, pz); box.castShadow = true; object.add(box); return box; };
    addBox(.85, .65, 1, 0, .65, 0);
    addBox(.54, .42, .45, 0, .78, -.57);
    for (const side of [-1, 1]) for (const front of [-1, 1]) addBox(.19, .3, .2, side * .27, .15, front * .3);
    const eyeMaterial = new THREE.MeshLambertMaterial({ color: definition.passive ? 0x263d35 : 0xffd699, emissive: definition.passive ? 0 : 0x563021 });
    for (const side of [-1, 1]) addBox(.09, .09, .05, side * .16, .86, -.82, eyeMaterial);
    if (kind === 'brambleback') for (let j = 0; j < 4; j += 1) { const spike = new THREE.Mesh(new THREE.ConeGeometry(.12, .4, 4), material); spike.position.set(0, 1.14, -.25 + j * .2); object.add(spike); }
    if (kind === 'skyshard') { const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(.38), material); crystal.position.set(0, 1.35, 0); object.add(crystal); }
    if (kind === 'mosskin') addBox(.96, .16, 1.08, 0, 1.02, .02);
    object.position.set(x, y, z); object.userData.creature = definition.name; this.group.add(object);
    const creature: Creature = { object, kind, health: definition.health, velocity: new THREE.Vector3(), cooldown: 1, wander: 2, direction: new THREE.Vector3(Math.random() - .5, 0, Math.random() - .5).normalize(), hurt: 0 };
    this.creatures.push(creature);
    return creature;
  }

  private updateCreatures(dt: number, night: boolean): void {
    for (let i = this.creatures.length - 1; i >= 0; i -= 1) {
      const creature = this.creatures[i]; const definition = CREATURES[creature.kind]; const object = creature.object;
      const toPlayer = this.player.object.position.clone().sub(object.position); const distance = toPlayer.length();
      creature.cooldown -= dt; creature.wander -= dt; creature.hurt = Math.max(0, creature.hurt - dt);
      if (creature.wander <= 0) { creature.wander = 2 + Math.random() * 3; creature.direction.set(Math.random() - .5, 0, Math.random() - .5).normalize(); }
      const pursuing = distance < 17 && !definition.passive;
      if (pursuing) creature.direction.copy(toPlayer.setY(0).normalize());
      if (definition.passive && (distance < 3 || creature.hurt)) creature.direction.copy(toPlayer.setY(0).normalize().negate());
      let speed = definition.speed * (definition.passive && creature.hurt ? 3 : 1);
      if (definition.ranged && distance < 8 && pursuing) speed = 0;
      const p = object.position; const nx = p.x + creature.direction.x * speed * dt + creature.velocity.x * dt; const nz = p.z + creature.direction.z * speed * dt + creature.velocity.z * dt;
      const blocked = this.world.isBlockSolid(Math.floor(nx), Math.floor(p.y + .45), Math.floor(nz)) || this.world.isBlockSolid(Math.floor(nx), Math.floor(p.y + 1), Math.floor(nz));
      if (!blocked) { p.x = nx; p.z = nz; }
      else if (!this.world.isBlockSolid(Math.floor(nx), Math.floor(p.y + 1.5), Math.floor(nz)) && !this.world.isBlockSolid(Math.floor(nx), Math.floor(p.y + 2), Math.floor(nz))) { p.y += 1.01; p.x = nx; p.z = nz; }
      else { creature.direction.set(-creature.direction.z, 0, creature.direction.x); creature.wander = .5; }
      creature.velocity.multiplyScalar(Math.exp(-dt * 5)); creature.velocity.y -= dt * 18;
      const nextY = p.y + creature.velocity.y * dt;
      if (this.world.isBlockSolid(Math.floor(p.x), Math.floor(nextY), Math.floor(p.z))) { p.y = Math.floor(nextY) + 1; creature.velocity.y = 0; } else p.y = nextY;
      object.rotation.y = Math.atan2(-creature.direction.x, -creature.direction.z);
      object.scale.setScalar(creature.hurt > 0 ? 1 + Math.sin(creature.hurt * 50) * .05 : 1);
      if (pursuing && creature.cooldown <= 0 && this.player.health > 0) {
        if (definition.ranged && distance < 16 && this.lineClear(p.clone().add(new THREE.Vector3(0, 1, 0)), this.player.object.position.clone().add(new THREE.Vector3(0, .8, 0)))) {
          creature.cooldown = 2.5; this.shoot(p.clone().add(new THREE.Vector3(0, 1.2, 0)));
        } else if (distance < 1.65) { creature.cooldown = 1.3; this.player.takeDamage(definition.damage); this.player.velocity.addScaledVector(creature.direction, 4); }
      }
      if (distance > 75 || definition.nocturnal && !night || p.y < -5) this.removeCreature(i);
    }
  }

  private shoot(origin: THREE.Vector3): void {
    if (this.projectiles.length > 16) return;
    const mesh = new THREE.Mesh(this.shotGeometry, this.shotMaterial); mesh.position.copy(origin); this.group.add(mesh);
    this.projectiles.push({ mesh, life: 4, velocity: this.player.object.position.clone().add(new THREE.Vector3(0, 1, 0)).sub(origin).normalize().multiplyScalar(9) });
  }
  private updateProjectiles(dt: number): void {
    for (let i = this.projectiles.length - 1; i >= 0; i -= 1) {
      const shot = this.projectiles[i]; shot.life -= dt; shot.mesh.position.addScaledVector(shot.velocity, dt); shot.mesh.rotation.y += dt * 5;
      const p = shot.mesh.position, target = this.player.object.position;
      if (Math.abs(p.x - target.x) < .45 && Math.abs(p.z - target.z) < .45 && p.y > target.y && p.y < target.y + this.player.height) { this.player.takeDamage(5); shot.life = 0; }
      if (shot.life <= 0 || this.world.isBlockSolid(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z))) { this.particles.burst(p, 0xd995ff, 4); this.group.remove(shot.mesh); this.projectiles.splice(i, 1); }
    }
  }

  private lineClear(a: THREE.Vector3, b: THREE.Vector3): boolean {
    const direction = b.clone().sub(a); const length = direction.length(); direction.normalize();
    for (let d = .2; d < length; d += .2) { const p = a.clone().addScaledVector(direction, d); if (this.world.isBlockSolid(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z))) return false; }
    return true;
  }

  attack(origin: THREE.Vector3, direction: THREE.Vector3, damage: number): boolean {
    let target: Creature | undefined; let nearest = 4;
    for (const creature of this.creatures) {
      const center = creature.object.position.clone().add(new THREE.Vector3(0, .7, 0)); const offset = center.clone().sub(origin); const along = offset.dot(direction);
      if (along < 0 || along > nearest || along > 3.8 || offset.addScaledVector(direction, -along).length() > .8 || !this.lineClear(origin, center)) continue;
      nearest = along; target = creature;
    }
    if (!target) return false;
    target.health -= damage; target.hurt = .35; target.velocity.addScaledVector(direction, 5); target.velocity.y = 3;
    this.particles.burst(target.object.position.clone().add(new THREE.Vector3(0, .7, 0)), 0xffb16f, 8);
    if (target.health <= 0) { this.spawnDrop(CREATURES[target.kind].drop, target.object.position.clone().add(new THREE.Vector3(0, .5, 0)), 2); this.onMessage?.(`${CREATURES[target.kind].name} defeated`); this.removeCreature(this.creatures.indexOf(target)); }
    return true;
  }

  private removeCreature(index: number): void {
    if (index < 0) return;
    const creature = this.creatures[index]; this.group.remove(creature.object);
    const ownedMaterials = new Set<THREE.Material>();
    creature.object.traverse((child) => { if (child instanceof THREE.Mesh) { child.geometry.dispose(); if (![...this.materials.values()].includes(child.material as THREE.MeshLambertMaterial)) ownedMaterials.add(child.material as THREE.Material); } });
    ownedMaterials.forEach((material) => material.dispose()); this.creatures.splice(index, 1);
  }
  serialize(): EntitySave { return { drops: this.drops.map((drop) => ({ id: drop.id, count: drop.count, durability: drop.durability, position: drop.mesh.position.toArray(), life: drop.life })), creatures: this.creatures.map((creature) => ({ kind: creature.kind, health: creature.health, position: creature.object.position.toArray() })) }; }
  load(data?: EntitySave): void {
    if (!data) return;
    for (const drop of data.drops.slice(0, 128)) {
      const spawned = this.spawnDrop(drop.id, new THREE.Vector3(...drop.position), drop.count, drop.durability);
      if (spawned) spawned.life = drop.life;
    }
    for (const creature of data.creatures.slice(0, 14)) {
      const spawned = this.spawnCreature(creature.kind, ...creature.position as [number, number, number]);
      if (spawned) spawned.health = creature.health;
    }
  }
  dispose(): void { while (this.creatures.length) this.removeCreature(0); this.group.clear(); this.materials.forEach((material) => material.dispose()); this.dropGeometry.dispose(); this.shotGeometry.dispose(); this.shotMaterial.dispose(); }
  get count(): number { return this.creatures.length + this.drops.length + this.projectiles.length; }
}
