import * as THREE from 'three';
import { InputManager } from './InputManager.ts';
import { World } from '../world/World.ts';
import { BLOCKS, BlockId, type BlockIdValue } from '../world/blocks.ts';
import { Player } from '../player/Player.ts';
import { EntityManager } from '../entities/EntityManager.ts';
import { ParticleSystem } from '../systems/Particles.ts';
import { AudioManager } from '../systems/AudioManager.ts';
import { DayNightSystem } from '../systems/DayNight.ts';
import { SaveManager, type WorldSave } from '../persistence/SaveManager.ts';
import { UIManager } from '../ui/UIManager.ts';
import { ITEMS } from '../inventory/items.ts';
import { HandModel } from '../player/HandModel.ts';
import { WeatherSystem } from '../systems/Weather.ts';
import { BIOMES } from '../world/BiomeGenerator.ts';
import { raycastVoxel } from '../world/VoxelRaycast.ts';
import { SEA_LEVEL } from '../world/blocks.ts';

interface Target { x: number; y: number; z: number; id: BlockIdValue; normal: THREE.Vector3; }

export class Game {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly input: InputManager;
  private readonly saves = new SaveManager();
  private readonly audio = new AudioManager();
  private readonly ui: UIManager;
  private readonly particles = new ParticleSystem();
  private readonly dayNight: DayNightSystem;
  private readonly weather: WeatherSystem;
  private readonly outline = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.01, 1.01, 1.01)), new THREE.LineBasicMaterial({ color: 0xc7f0a8, transparent: true, opacity: .9 }));
  private world?: World;
  private player?: Player;
  private entities?: EntityManager;
  private hand?: HandModel;
  private spawn: [number, number, number] = [8.5, 50, 8.5];
  private readonly menuCamera = new THREE.PerspectiveCamera(60, 1, .1, 200);
  private waterTimer = 0;
  private pixelRatio = 0;
  private worldInfo?: { id: string; name: string; seed: string };
  private playing = false;
  private lastTime = performance.now();
  private mineProgress = 0;
  private mineKey = '';
  private attackCooldown = 0;
  private target?: Target;
  private saveTimer = 0;
  private frameCount = 0;
  private fps = 60;
  private fpsTimer = 0;

  constructor(root: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.domElement.className = 'game-canvas'; this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6)); this.renderer.shadowMap.enabled = this.saves.settings.shadows; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap; this.renderer.outputColorSpace = THREE.SRGBColorSpace; root.append(this.renderer.domElement);
    this.input = new InputManager(this.renderer.domElement); this.dayNight = new DayNightSystem(this.scene); this.weather = new WeatherSystem(this.scene); this.scene.add(this.outline, this.particles.group); this.outline.visible = false;
    this.ui = new UIManager(root, this.saves, { create: (name, seed) => void this.createWorld(name, seed), load: (id) => void this.loadWorld(id), resume: () => this.resume(), save: () => void this.save(), quit: () => void this.quit(), respawn: () => this.respawn() });
    this.input.onClick = (button) => {
      if (!this.playing || this.ui.isPanelOpen()) return;
      if (!this.input.pointerLocked) { this.input.requestLock(); this.audio.resume(); return; }
      if (button === 2) this.place();
      if (button === 0 && this.attackCooldown <= 0) this.hand?.attack();
    };
    this.renderer.domElement.addEventListener('wheel', (event) => { if (this.input.pointerLocked && this.player) this.player.inventory.setSelected((this.player.inventory.selected + (event.deltaY > 0 ? 1 : 8)) % 9); }, { passive: true });
    window.addEventListener('resize', () => this.resize()); window.addEventListener('pagehide', () => { if (this.playing) void this.save(false); }); document.addEventListener('visibilitychange', () => { if (document.hidden && this.playing) void this.save(false); });
    document.addEventListener('pointerlockchange', () => { if (this.playing && !this.input.pointerLocked && !this.ui.isPanelOpen()) this.ui.pause(); });
    this.renderer.domElement.addEventListener('webglcontextlost', (event) => { event.preventDefault(); this.playing = false; this.ui.error('The graphics context was lost. Reload the page to restore your saved world.'); });
    this.resize(); this.animate();
  }

  private async createWorld(name: string, seed: string): Promise<void> {
    try {
    this.worldInfo = { id: crypto.randomUUID(), name, seed }; this.startWorld(seed); await this.waitForWorld();
    if (!this.player || !this.world) return;
    const center = this.player.object.position;
    let sx = Math.floor(center.x), sz = Math.floor(center.z), sy = this.world.getSurfaceY(sx, sz);
    for (let dx = -3; dx <= 3; dx += 1) for (let dz = -3; dz <= 3; dz += 1) {
      const tx = Math.floor(center.x) + dx, tz = Math.floor(center.z) + dz, ty = this.world.generator.heightAt(tx, tz) + 1;
      if (this.world.hasChunkAt(tx, tz) && ty > SEA_LEVEL + 2 && this.world.isBlockSolid(tx, ty - 1, tz) && this.world.getBlock(tx, ty, tz) === BlockId.Air && this.world.getBlock(tx, ty + 1, tz) === BlockId.Air) { sx = tx; sz = tz; sy = ty; }
    }
    this.spawn = [sx + .5, sy + .02, sz + .5]; this.player.setPosition(...this.spawn); this.player.yaw = Math.PI; this.player.pitch = -.12; this.dayNight.time = this.saves.settings.dayLength * .43;
    this.playing = true; this.ui.showGame(); this.ui.toast('Welcome to the wild. Click to look around.'); await this.save(false);
    } catch (error) { this.ui.error(`World creation failed: ${String(error)}`); }
  }

  private async loadWorld(id: string): Promise<void> {
    try {
    const data = await this.saves.load(id); if (!data) { this.ui.error('This world could not be loaded. Its saved data may be unavailable.'); return; }
    this.worldInfo = { id: data.id, name: data.name, seed: data.seed }; this.startWorld(data.seed, data.player.position); this.world?.loadChanges(data.changes); for (const [key, storage] of data.containers ?? []) this.world?.containers.set(key, storage); await this.waitForWorld();
    if (!this.player) return;
    this.player.setPosition(...data.player.position); this.player.yaw = data.player.yaw; this.player.pitch = data.player.pitch; this.player.health = data.player.health; this.player.hunger = data.player.hunger; this.player.inventory.load(data.player.inventory); this.player.inventory.selected = data.player.selected; this.dayNight.time = data.time; this.spawn = data.spawn ?? [8.5, (this.world?.generator.heightAt(8, 8) ?? 40) + 1, 8.5]; this.entities?.load(data.entities); this.playing = true; this.ui.showGame(); this.ui.toast(`Welcome back to ${data.name}.`); if (this.player.health <= 0) this.ui.death();
    } catch (error) { this.ui.error(`World loading failed: ${String(error)}`); }
  }

  private startWorld(seed: string, position?: [number, number, number]): void {
    this.ui.loading(); this.playing = false;
    if (this.world) { this.scene.remove(this.world.scene); this.world.dispose(); }
    if (this.player) this.scene.remove(this.player.object);
    if (this.entities) { this.scene.remove(this.entities.group); this.entities.dispose(); }
    this.hand?.dispose();
    this.input.keys.clear(); this.mineProgress = 0; this.attackCooldown = 0; this.saveTimer = 0;
    this.world = new World(seed); this.world.renderDistance = this.saves.settings.renderDistance; this.world.loadingDistance = this.saves.settings.loadingDistance;
    let startingPosition = position;
    if (!startingPosition) {
      let sx = 8, sz = 8;
      for (let radius = 0; radius < 256; radius += 16) {
        let found = false;
        for (let side = 0; side < 8; side += 1) {
          const tx = Math.floor(8 + Math.cos(side * Math.PI / 4) * radius), tz = Math.floor(8 + Math.sin(side * Math.PI / 4) * radius);
          if (this.world.generator.heightAt(tx, tz) > SEA_LEVEL + 3) { sx = tx; sz = tz; found = true; break; }
        }
        if (found) break;
      }
      startingPosition = [sx + .5, this.world.generator.heightAt(sx, sz) + 1, sz + .5];
    }
    this.scene.add(this.world.scene); this.player = new Player(this.world, this.input); this.player.setPosition(...startingPosition); this.scene.add(this.player.object); this.hand = new HandModel(this.player.camera);
    this.entities = new EntityManager(this.world, this.player, this.player.inventory, this.particles); this.scene.add(this.entities.group);
    this.entities.onMessage = (message) => this.ui.toast(message); this.entities.onPickup = () => this.audio.play('pickup');
    this.player.onDamage = () => { this.audio.play('hurt'); this.ui.damage(); };
    this.player.onDeath = () => { document.exitPointerLock(); this.ui.death(); for (const stack of this.player?.inventory.slots ?? []) if (stack) this.entities?.spawnDrop(stack.id, this.player!.object.position.clone().add(new THREE.Vector3((Math.random() - .5) * 2, .6, (Math.random() - .5) * 2)), stack.count, stack.durability); this.player?.inventory.slots.fill(null); void this.save(false); };
    this.player.onWater = () => this.audio.play('water'); this.player.onStep = () => this.audio.play('step'); this.player.onJump = () => this.audio.play('jump');
    this.world.updateAround(this.player.object.position); this.resize();
  }

  private async waitForWorld(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      let attempts = 0;
      const interval = window.setInterval(() => {
        const p = this.player?.object.position; if (!p) return;
        const cx = Math.floor(p.x / 16), cz = Math.floor(p.z / 16); let count = 0;
        for (let dx = -1; dx <= 1; dx += 1) for (let dz = -1; dz <= 1; dz += 1) if (this.world?.chunks.has(`${cx + dx},${cz + dz}`)) count += 1;
        this.ui.loadingProgress(count, 9);
        if (count >= 9 && this.world?.meshes.has(`${cx},${cz}`)) { window.clearInterval(interval); resolve(); }
        if (++attempts > 1000) { window.clearInterval(interval); reject(new Error('Terrain workers did not respond. Please reload.')); }
      }, 30);
    });
  }

  private animate = (): void => {
    requestAnimationFrame(this.animate); const now = performance.now(); const dt = Math.min(.05, (now - this.lastTime) / 1000); this.lastTime = now; this.frameCount += 1; this.fpsTimer += dt; if (this.fpsTimer > 1) { this.fps = Math.round(this.frameCount / this.fpsTimer); this.frameCount = 0; this.fpsTimer = 0; }
    if (this.playing && this.player && this.world && this.entities) {
      this.handleKeys(); const settings = this.saves.settings; this.input.bindings = settings.bindings; this.audio.setVolumes(settings.masterVolume, settings.soundVolume, settings.musicVolume); this.world.renderDistance = settings.renderDistance; this.world.loadingDistance = settings.loadingDistance; this.dayNight.cycleLength = settings.dayLength; this.renderer.shadowMap.enabled = settings.shadows; this.player.camera.fov = settings.fov; this.player.camera.updateProjectionMatrix();
      const ratio = Math.min(window.devicePixelRatio, settings.graphics === 'low' ? .85 : settings.graphics === 'high' ? 1.6 : 1.25); if (ratio !== this.pixelRatio) { this.pixelRatio = ratio; this.renderer.setPixelRatio(ratio); this.resize(); }
      this.world.updateAround(this.player.object.position);
      if (!this.ui.isPanelOpen()) {
        this.player.update(dt, settings.sensitivity, settings.invertMouse, settings.viewBobbing); this.entities.update(dt, this.dayNight.isNight); this.dayNight.update(dt, this.player.object.position, this.world); this.particles.update(dt); this.attackCooldown = Math.max(0, this.attackCooldown - dt); this.updateTarget(); this.updateMining(dt); this.hand?.update(dt, this.player.inventory.selectedStack?.id, this.mineProgress > 0); this.audio.update(dt, this.player.isInWater(), this.world.generator.biomeAt(this.player.object.position.x, this.player.object.position.z));
        this.waterTimer += dt; if (this.waterTimer > .18) { this.waterTimer = 0; this.world.updateWater(); }
        this.weather.update(dt, this.world, this.player.object.position, this.dayNight.time);
        if (this.player.isInWater()) { this.dayNight.fog.color.set(0x367685); this.dayNight.fog.near = .1; this.dayNight.fog.far = 12; }
        this.saveTimer += dt; if (this.saveTimer > 25) { this.saveTimer = 0; void this.save(false); }
      }
      const p = this.player.object.position; const info = this.renderer.info; this.ui.updateHud(this.player.inventory, this.player.health, this.player.hunger, this.mineProgress, `${this.fps} FPS · ${(dt * 1000).toFixed(1)} ms\nChunks ${this.world.getLoadedCount()} · Generated ${this.world.generatedCount}\nDraws ${info.render.calls} · Triangles ${info.render.triangles}\nEntities ${this.entities.count}\n${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${p.z.toFixed(1)}`);
      this.ui.environment(`${BIOMES[this.world.generator.biomeAt(p.x, p.z)].name}\n${this.dayNight.isNight ? 'Nightfall' : 'Daylight'} · ${this.weather.label}${this.player.breath < 11 ? ` · Breath ${Math.ceil(this.player.breath)}s` : ''}`);
      this.renderer.render(this.scene, this.player.camera);
    } else {
      if (this.world && this.player) this.world.updateAround(this.player.object.position);
      this.menuCamera.position.set(0, 10, 10); this.menuCamera.lookAt(0, 0, 0); this.renderer.render(this.scene, this.menuCamera);
    }
    this.input.endFrame();
  };

  private handleKeys(): void {
    if (!this.player) return;
    for (let i = 1; i <= 9; i += 1) if (this.input.consume(`Digit${i}`)) this.player.inventory.setSelected(i - 1);
    if (this.input.consume(this.input.bindings.inventory) && this.player.health > 0) { if (this.ui.isPanelOpen()) { this.ui.closePanel(); this.resume(); } else { document.exitPointerLock(); this.ui.inventory(this.player.inventory); } }
    if (this.input.consume('Escape') && !this.ui.isPanelOpen()) { document.exitPointerLock(); this.ui.pause(); }
    if (this.input.consume('F3')) { this.saves.settings.debug = !this.saves.settings.debug; try { this.saves.saveSettings(); } catch { this.ui.toast('Debug preference applies for this session; browser storage is unavailable.'); } }
    if (this.input.consume('F5')) void this.save();
    if (!this.ui.isPanelOpen() && this.input.consume(this.input.bindings.eat) && this.player.eat()) { this.audio.play('pickup'); this.ui.toast('A little energy for the journey.'); }
    if (!this.ui.isPanelOpen() && this.input.consume(this.input.bindings.drop)) { const stack = this.player.inventory.selectedStack; if (stack) { this.entities?.spawnDrop(stack.id, this.player.object.position.clone().add(new THREE.Vector3(0, 1, 0)).add(this.player.camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(1.2)), 1, stack.durability); stack.count -= 1; if (!stack.count) this.player.inventory.slots[this.player.inventory.selected] = null; } }
  }

  private updateTarget(): void {
    if (!this.player || !this.world) return;
    this.target = raycastVoxel(this.world, this.player.camera.getWorldPosition(new THREE.Vector3()), this.player.camera.getWorldDirection(new THREE.Vector3()));
    this.outline.visible = Boolean(this.target); if (this.target) this.outline.position.set(this.target.x + .5, this.target.y + .5, this.target.z + .5);
  }

  private updateMining(dt: number): void {
    if (!this.player || !this.world || !this.input.pointerLocked) return;
    if (!this.input.mouseDown.left) { this.mineProgress = 0; return; }
    if (this.attackCooldown > 0) return;
    const weapon = this.player.inventory.selectedStack;
    if (this.entities?.attack(this.player.camera.getWorldPosition(new THREE.Vector3()), this.player.camera.getWorldDirection(new THREE.Vector3()), weapon ? ITEMS[weapon.id].tool?.damage ?? 3 : 2)) { this.hand?.attack(); this.audio.play('attack'); this.attackCooldown = .5; this.player.inventory.damageSelected(); return; }
    if (!this.target) { this.mineProgress = 0; return; } const block = BLOCKS[this.target.id]; const key = `${this.target.x},${this.target.y},${this.target.z}`; if (key !== this.mineKey) { this.mineKey = key; this.mineProgress = 0; } if (!Number.isFinite(block.hardness)) return;
    const stack = this.player.inventory.selectedStack; const tool = stack ? ITEMS[stack.id].tool : undefined; const correct = tool?.kind === block.tool; const speed = correct ? tool?.speed ?? 1 : block.tool === 'pickaxe' ? .35 : 1;
    this.mineProgress += dt * speed / block.hardness;
    if (this.mineProgress >= 1) { const target = this.target; this.mineProgress = 0; if (!this.world.setBlock(target.x, target.y, target.z, BlockId.Air)) return; this.particles.burst(new THREE.Vector3(target.x + .5, target.y + .5, target.z + .5), block.color); this.audio.play('break'); if (block.drops && (block.minTier === undefined || correct && (tool?.tier ?? -1) >= block.minTier)) this.entities?.spawnDrop(block.drops, new THREE.Vector3(target.x + .5, target.y + .5, target.z + .5)); if (target.id === BlockId.Chest) { for (const stack of this.world.containers.get(key) ?? []) if (stack) this.entities?.spawnDrop(stack.id, new THREE.Vector3(target.x + .5, target.y + .5, target.z + .5), stack.count, stack.durability); this.world.containers.delete(key); } this.player.inventory.damageSelected(); }
  }

  private place(): void {
    if (!this.player || !this.world || !this.target) return;
    const target = this.target;
    if (target.id === BlockId.Chest && !this.player.crouching) {
      const key = `${target.x},${target.y},${target.z}`;
      let storage = this.world.containers.get(key);
      if (!storage) { storage = Array.from({ length: 27 }, () => null); this.world.containers.set(key, storage); }
      this.input.mouseDown.right = false;
      document.exitPointerLock();
      this.ui.container(this.player.inventory, storage);
      return;
    }
    const stack = this.player.inventory.selectedStack; if (!stack) return; const item = ITEMS[stack.id]; if (item.blockId === undefined) return;
    const x = target.x + target.normal.x, y = target.y + target.normal.y, z = target.z + target.normal.z;
    const existing = this.world.getBlock(x, y, z); if (existing !== BlockId.Air && existing !== BlockId.Water) return;
    if (this.player.intersectsBlock(x, y, z)) { this.ui.toast('That space is occupied by you.'); return; }
    if (this.world.setBlock(x, y, z, item.blockId as BlockIdValue)) { stack.count -= 1; if (!stack.count) this.player.inventory.slots[this.player.inventory.selected] = null; this.audio.play('place'); this.hand?.attack(); }
  }

  private resume(): void { this.audio.resume(); this.ui.closePanel(); this.input.requestLock(); }
  private respawn(): void { if (!this.player || !this.world) return; this.player.health = 100; this.player.hunger = 100; this.player.breath = 12; this.player.velocity.set(0, 0, 0); this.player.setPosition(...this.spawn); this.player.inventory.add('berries', 3); this.resume(); }

  private async save(notify = true): Promise<void> {
    if (!this.player || !this.world || !this.worldInfo) return;
    const p = this.player.object.position; const data: WorldSave = { ...this.worldInfo, lastPlayed: Date.now(), time: this.dayNight.time, player: { position: [p.x, p.y, p.z], yaw: this.player.yaw, pitch: this.player.pitch, health: this.player.health, hunger: this.player.hunger, inventory: this.player.inventory.serialize(), selected: this.player.inventory.selected }, changes: this.world.getSaveChanges(), containers: [...this.world.containers], entities: this.entities?.serialize(), spawn: this.spawn };
    try { await this.saves.save(data); if (notify) this.ui.toast('World saved. Your story is safe.'); } catch (error) { this.ui.toast(`Save failed: ${String(error)}. Free browser storage and try again.`); }
  }

  private async quit(): Promise<void> { await this.save(false); document.exitPointerLock(); this.playing = false; this.ui.mainMenu(); }
  private resize(): void { const width = window.innerWidth; const height = window.innerHeight; this.renderer.setSize(width, height); this.menuCamera.aspect = width / height; this.menuCamera.updateProjectionMatrix(); if (this.player) { this.player.camera.aspect = width / height; this.player.camera.updateProjectionMatrix(); } }
}
