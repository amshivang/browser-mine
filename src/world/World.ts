import * as THREE from 'three';
import { BLOCKS, BlockId, CHUNK_SIZE, WORLD_HEIGHT, isSolid, type BlockIdValue } from './blocks.ts';
import { Chunk } from './Chunk.ts';
import { buildChunkMesh } from './mesher.ts';
import { TerrainGenerator } from './TerrainGenerator.ts';
import { TextureAtlas } from './TextureAtlas.ts';
import type { ItemStack } from '../inventory/items.ts';

export interface BlockChange { x: number; y: number; z: number; id: BlockIdValue; }
interface ChunkCoordinates { cx: number; cz: number; }
interface GenerationRequest extends ChunkCoordinates { epoch: number; startedAt: number; }
interface WorkerSlot { worker: Worker; request?: GenerationRequest; failures: number; disabled: boolean; }
interface GenerationResult extends ChunkCoordinates { epoch: number; blocks?: ArrayBuffer; error?: string; }

function chunkKey(cx: number, cz: number): string { return `${cx},${cz}`; }
function floorDiv(value: number, divisor: number): number { return Math.floor(value / divisor); }
function mod(value: number, divisor: number): number { return ((value % divisor) + divisor) % divisor; }

export class World {
  readonly scene = new THREE.Group();
  readonly chunks = new Map<string, Chunk>();
  readonly meshes = new Map<string, THREE.Group>();
  readonly modifications = new Map<string, BlockIdValue>();
  readonly generator: TerrainGenerator;
  readonly containers = new Map<string, Array<ItemStack | null>>();
  readonly atlas = new TextureAtlas();
  renderDistance = 3;
  loadingDistance = 4;
  private queue: ChunkCoordinates[] = [];
  private queued = new Set<string>();
  private readonly workers: WorkerSlot[] = [];
  private readonly generationFailures = new Map<string, number>();
  private readonly dirtyMeshes = new Set<string>();
  private readonly fluidQueue: Array<{ x: number; y: number; z: number; level: number }> = [];
  private readonly fluidLevels = new Map<string, number>();
  private disposed = false;
  private center?: ChunkCoordinates;
  private requestEpoch = 0;
  generatedCount = 0;
  chunkErrors = 0;

  constructor(public readonly seed: string) {
    this.generator = new TerrainGenerator(seed);
    this.scene.name = 'voxel-world';
    for (let i = 0; i < 2; i += 1) {
      const slot: WorkerSlot = { worker: this.createWorker(), failures: 0, disabled: false };
      this.attachWorker(slot);
      this.workers.push(slot);
    }
  }

  private createWorker(): Worker {
    return new Worker(new URL('./generation.worker.ts', import.meta.url), { type: 'module' });
  }

  private attachWorker(slot: WorkerSlot): void {
    const worker = slot.worker;
    worker.onmessage = (event: MessageEvent<GenerationResult>) => {
      if (this.disposed || slot.worker !== worker) return;
      const request = slot.request;
      const { cx, cz, epoch, blocks, error } = event.data;
      // A late or duplicated response must never release a newer request.
      if (!request || request.epoch !== epoch || request.cx !== cx || request.cz !== cz) return;
      if (error || !(blocks instanceof ArrayBuffer) || blocks.byteLength !== CHUNK_SIZE * WORLD_HEIGHT * CHUNK_SIZE) {
        this.failRequest(slot, error ?? 'Invalid chunk data', false); return;
      }
      slot.request = undefined; slot.failures = 0;
      const key = chunkKey(cx, cz); this.queued.delete(key); this.generationFailures.delete(key);
      if (this.inLoadingRange(cx, cz) && !this.chunks.has(key)) {
        const chunk = new Chunk(cx, cz); chunk.blocks.set(new Uint8Array(blocks)); this.applyModifications(chunk);
        this.chunks.set(key, chunk); this.generatedCount += 1;
        this.markNeighborhoodDirty(cx, cz);
      }
      this.processQueue();
    };
    worker.onerror = (event) => {
      if (this.disposed || slot.worker !== worker) return;
      event.preventDefault(); this.failRequest(slot, event.message || 'Terrain worker crashed', true);
    };
    worker.onmessageerror = () => {
      if (!this.disposed && slot.worker === worker) this.failRequest(slot, 'Unreadable terrain response', true);
    };
  }

  private failRequest(slot: WorkerSlot, message: string, restart: boolean): void {
    if (this.disposed || slot.disabled) return;
    console.error('Terrain worker failed:', message); this.chunkErrors += 1;
    const request = slot.request; slot.request = undefined;
    if (request) {
      const key = chunkKey(request.cx, request.cz); this.queued.delete(key);
      const failures = (this.generationFailures.get(key) ?? 0) + 1;
      this.generationFailures.set(key, failures);
      if (failures < 2 && this.inLoadingRange(request.cx, request.cz) && !this.chunks.has(key)) {
        this.queue.unshift({ cx: request.cx, cz: request.cz }); this.queued.add(key);
      }
    }
    if (restart) {
      slot.worker.terminate(); slot.failures += 1;
      if (slot.failures > 2) slot.disabled = true;
      else {
        try { slot.worker = this.createWorker(); this.attachWorker(slot); }
        catch { slot.disabled = true; }
      }
    }
    this.processQueue();
  }

  private get loadRadius(): number { return Math.max(0, Math.floor(this.renderDistance), Math.floor(this.loadingDistance)); }

  private distance(cx: number, cz: number): number {
    return this.center ? Math.max(Math.abs(cx - this.center.cx), Math.abs(cz - this.center.cz)) : 0;
  }

  private inLoadingRange(cx: number, cz: number): boolean { return this.distance(cx, cz) <= this.loadRadius; }

  private markDirty(cx: number, cz: number): void {
    const key = chunkKey(cx, cz), chunk = this.chunks.get(key);
    if (chunk) { chunk.dirty = true; this.dirtyMeshes.add(key); }
  }

  private markNeighborhoodDirty(cx: number, cz: number): void {
    // Corner neighbors also contribute to top-face ambient occlusion.
    for (let dz = -1; dz <= 1; dz += 1) for (let dx = -1; dx <= 1; dx += 1) this.markDirty(cx + dx, cz + dz);
  }

  private markBlockDirty(x: number, z: number): void {
    const cx = floorDiv(x, CHUNK_SIZE), cz = floorDiv(z, CHUNK_SIZE);
    const lx = mod(x, CHUNK_SIZE), lz = mod(z, CHUNK_SIZE);
    const xs = lx === 0 ? [0, -1] : lx === CHUNK_SIZE - 1 ? [0, 1] : [0];
    const zs = lz === 0 ? [0, -1] : lz === CHUNK_SIZE - 1 ? [0, 1] : [0];
    for (const dx of xs) for (const dz of zs) this.markDirty(cx + dx, cz + dz);
  }

  updateAround(position: THREE.Vector3): void {
    if (this.disposed) return;
    const cx = floorDiv(position.x, CHUNK_SIZE);
    const cz = floorDiv(position.z, CHUNK_SIZE);
    this.center = { cx, cz };
    const desired: Array<{ cx: number; cz: number; distance: number }> = [];
    const radius = this.loadRadius;
    for (let dz = -radius; dz <= radius; dz += 1) for (let dx = -radius; dx <= radius; dx += 1) {
      const distance = Math.max(Math.abs(dx), Math.abs(dz));
      if (distance <= radius) desired.push({ cx: cx + dx, cz: cz + dz, distance });
    }
    desired.sort((a, b) => a.distance - b.distance);
    this.queue = this.queue.filter((item) => {
      if (Math.max(Math.abs(item.cx - cx), Math.abs(item.cz - cz)) <= radius) return true;
      this.queued.delete(chunkKey(item.cx, item.cz)); return false;
    });
    for (const item of desired) {
      const key = chunkKey(item.cx, item.cz);
      if (!this.chunks.has(key) && !this.queued.has(key) && (this.generationFailures.get(key) ?? 0) < 2) { this.queue.push(item); this.queued.add(key); }
    }
    // Reprioritize pending work after movement, rather than finishing the old ring first.
    this.queue.sort((a, b) => this.distance(a.cx, a.cz) - this.distance(b.cx, b.cz));
    for (const [key, chunk] of this.chunks) {
      const mesh = this.meshes.get(key);
      const distance = this.distance(chunk.cx, chunk.cz);
      if (mesh) mesh.visible = distance <= this.renderDistance;
      if (distance > radius + 1) {
        if (mesh) this.disposeGroup(mesh);
        this.meshes.delete(key);
        this.chunks.delete(key);
        this.dirtyMeshes.delete(key);
        this.markNeighborhoodDirty(chunk.cx, chunk.cz);
      }
    }
    for (const key of this.generationFailures.keys()) {
      const [fx, fz] = key.split(',').map(Number);
      if (!this.inLoadingRange(fx, fz)) this.generationFailures.delete(key);
    }
    for (const slot of this.workers) if (slot.request && performance.now() - slot.request.startedAt > 15_000) this.failRequest(slot, 'Terrain request timed out', true);
    this.processQueue();
    let nearest: Chunk | undefined, nearestDistance = Infinity;
    for (const key of this.dirtyMeshes) {
      const chunk = this.chunks.get(key);
      if (!chunk) { this.dirtyMeshes.delete(key); continue; }
      const distance = this.distance(chunk.cx, chunk.cz);
      if (distance <= this.renderDistance && distance < nearestDistance) { nearest = chunk; nearestDistance = distance; }
    }
    if (nearest) { this.rebuildChunk(nearest.cx, nearest.cz); this.dirtyMeshes.delete(chunkKey(nearest.cx, nearest.cz)); }
  }

  private processQueue(): void {
    if (this.disposed) return;
    for (const slot of this.workers) {
      if (slot.request || slot.disabled) continue;
      const next = this.queue.shift(); if (!next) break;
      slot.request = { ...next, epoch: ++this.requestEpoch, startedAt: performance.now() };
      try { slot.worker.postMessage({ cx: next.cx, cz: next.cz, seed: this.seed, epoch: slot.request.epoch }); }
      catch (error) { this.failRequest(slot, String(error), true); }
    }
  }

  private applyModifications(chunk: Chunk): void {
    // Saved edits are sparse; avoid allocating a key for every voxel on every load.
    for (const [key, id] of this.modifications) {
      const [x, y, z] = key.split(',').map(Number);
      if (floorDiv(x, CHUNK_SIZE) !== chunk.cx || floorDiv(z, CHUNK_SIZE) !== chunk.cz) continue;
      const lx = mod(x, CHUNK_SIZE), lz = mod(z, CHUNK_SIZE);
      if (chunk.get(lx, y, lz) !== BlockId.Bedrock) chunk.set(lx, y, lz, id);
    }
  }

  /** Retrieve a chunk using chunk coordinates, rather than block coordinates. */
  getChunk(cx: number, cz: number): Chunk | undefined { return this.chunks.get(chunkKey(cx, cz)); }

  /** Whether terrain data is available at these world-space horizontal coordinates. */
  hasChunkAt(x: number, z: number): boolean { return this.getChunk(floorDiv(x, CHUNK_SIZE), floorDiv(z, CHUNK_SIZE)) !== undefined; }

  /** Unloaded voxels read as air; use hasChunkAt or isBlockSolid for availability/collision. */
  getBlock(x: number, y: number, z: number): BlockIdValue {
    x = Math.floor(x); y = Math.floor(y); z = Math.floor(z);
    if (y < 0 || y >= WORLD_HEIGHT) return BlockId.Air;
    const cx = floorDiv(x, CHUNK_SIZE); const cz = floorDiv(z, CHUNK_SIZE);
    const chunk = this.chunks.get(chunkKey(cx, cz));
    return chunk?.get(mod(x, CHUNK_SIZE), y, mod(z, CHUNK_SIZE)) ?? BlockId.Air;
  }

  setBlock(x: number, y: number, z: number, id: BlockIdValue): boolean {
    if (this.disposed || !Number.isInteger(x) || !Number.isInteger(y) || !Number.isInteger(z) || y < 1 || y >= WORLD_HEIGHT || !BLOCKS[id]) return false;
    const cx = floorDiv(x, CHUNK_SIZE); const cz = floorDiv(z, CHUNK_SIZE);
    const chunk = this.chunks.get(chunkKey(cx, cz));
    if (!chunk) return false;
    const lx = mod(x, CHUNK_SIZE), lz = mod(z, CHUNK_SIZE), old = chunk.get(lx, y, lz);
    if (old === BlockId.Bedrock || old === id) return false;
    chunk.set(lx, y, lz, id); this.modifications.set(`${x},${y},${z}`, id);
    this.markBlockDirty(x, z);
    if (id !== BlockId.Water) this.fluidLevels.delete(`${x},${y},${z}`);
    if (id === BlockId.Air) {
      for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, 0, 1], [0, 0, -1]]) if (this.getBlock(x + dx, y + dy, z + dz) === BlockId.Water) this.fluidQueue.push({ x: x + dx, y: y + dy, z: z + dz, level: 0 });
    }
    return true;
  }

  private rebuildChunk(cx: number, cz: number): void {
    const key = chunkKey(cx, cz);
    const chunk = this.chunks.get(key);
    if (!chunk) return;
    const oldMesh = this.meshes.get(key);
    if (oldMesh) this.disposeGroup(oldMesh);
    const mesh = buildChunkMesh(chunk, (x, y, z) => {
      const wx = cx * CHUNK_SIZE + x; const wz = cz * CHUNK_SIZE + z;
      return this.getBlock(wx, y, wz);
    }, this.atlas);
    this.meshes.set(key, mesh);
    this.scene.add(mesh);
  }

  private disposeGroup(group: THREE.Group): void {
    group.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
      }
    });
    this.scene.remove(group);
  }

  getSurfaceY(x: number, z: number): number {
    x = Math.floor(x); z = Math.floor(z);
    if (!this.hasChunkAt(x, z)) return this.generator.heightAt(x, z) + 1;
    for (let y = WORLD_HEIGHT - 1; y > 0; y -= 1) if (isSolid(this.getBlock(x, y, z))) return y + 1;
    return 32;
  }

  getSaveChanges(): BlockChange[] {
    return [...this.modifications].map(([key, id]) => {
      const [x, y, z] = key.split(',').map(Number);
      return { x, y, z, id };
    });
  }

  loadChanges(changes: BlockChange[]): void {
    if (this.disposed) return;
    for (const { x, y, z, id } of changes) {
      if (!Number.isInteger(x) || !Number.isInteger(y) || !Number.isInteger(z) || y < 1 || y >= WORLD_HEIGHT || !BLOCKS[id]) continue;
      const chunk = this.getChunk(floorDiv(x, CHUNK_SIZE), floorDiv(z, CHUNK_SIZE));
      const old = chunk?.get(mod(x, CHUNK_SIZE), y, mod(z, CHUNK_SIZE));
      if (old === BlockId.Bedrock) continue;
      this.modifications.set(`${x},${y},${z}`, id);
      if (chunk && old !== id) { chunk.set(mod(x, CHUNK_SIZE), y, mod(z, CHUNK_SIZE), id); this.markBlockDirty(x, z); }
      if (id !== BlockId.Water) this.fluidLevels.delete(`${x},${y},${z}`);
    }
  }

  getLoadedCount(): number { return this.chunks.size; }

  isBlockSolid(x: number, y: number, z: number): boolean {
    if (y < 0) return true;
    if (!this.hasChunkAt(x, z)) return true;
    return isSolid(this.getBlock(x, y, z));
  }

  updateWater(): void {
    if (this.disposed) return;
    for (let i = 0; i < 8 && this.fluidQueue.length; i += 1) {
      const flow = this.fluidQueue.shift(); if (!flow || flow.level > 5) continue;
      const { x, y, z, level } = flow;
      if (this.getBlock(x, y, z) !== BlockId.Water) continue;
      const directions = this.getBlock(x, y - 1, z) === BlockId.Air ? [[0, -1, 0]] : [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]];
      for (const [dx, dy, dz] of directions) {
        const nx = x + dx, ny = y + dy, nz = z + dz; const key = `${nx},${ny},${nz}`;
        if (this.getBlock(nx, ny, nz) !== BlockId.Air || this.fluidLevels.has(key)) continue;
        if (this.setBlock(nx, ny, nz, BlockId.Water)) { this.fluidLevels.set(key, level + 1); this.fluidQueue.push({ x: nx, y: ny, z: nz, level: dy ? level : level + 1 }); }
      }
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true; this.workers.forEach((slot) => { slot.worker.terminate(); slot.request = undefined; });
    this.meshes.forEach((mesh) => this.disposeGroup(mesh)); this.meshes.clear(); this.chunks.clear(); this.atlas.dispose();
    this.queue.length = 0; this.queued.clear(); this.dirtyMeshes.clear(); this.generationFailures.clear();
    this.fluidQueue.length = 0; this.fluidLevels.clear(); this.containers.clear(); this.modifications.clear();
  }

  getBlockName(id: number): string { return BLOCKS[id]?.name ?? 'Unknown'; }
}
