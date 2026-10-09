import { BlockId, CHUNK_SIZE, SEA_LEVEL, WORLD_HEIGHT, type BlockIdValue } from './blocks.ts';
import { fbm2, fbm3, hash2, valueNoise3 } from './noise.ts';
import { Chunk } from './Chunk.ts';
import { BiomeGenerator, BIOMES, type Biome } from './BiomeGenerator.ts';
import { ORE_RULES } from './OreRegistry.ts';

export type { Biome } from './BiomeGenerator.ts';

export interface GeneratedChunk {
  chunk: Chunk;
  biome: Biome;
}

function seedNumber(seed: string): number {
  let result = 2166136261;
  for (let i = 0; i < seed.length; i += 1) result = Math.imul(result ^ seed.charCodeAt(i), 16777619);
  return result | 0;
}

export function numericSeed(seed: string): number { return seedNumber(seed); }

const CAVE_CELL_SIZE = 80;
const CAVE_REACH = 44;
const CARDINAL_DIRECTIONS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

export class TerrainGenerator {
  readonly numericSeed: number;
  readonly biomes: BiomeGenerator;
  constructor(public readonly seed: string) { this.numericSeed = seedNumber(seed); this.biomes = new BiomeGenerator(this.numericSeed); }

  biomeAt(x: number, z: number): Biome {
    return this.biomes.at(x, z);
  }

  heightAt(x: number, z: number): number {
    const continental = fbm2(x / 260, z / 260, this.numericSeed + 3, 4);
    const hills = fbm2(x / 70, z / 70, this.numericSeed + 9, 4);
    const detail = fbm2(x / 22, z / 22, this.numericSeed + 21, 3);
    const { warmth, moisture } = this.biomes.climate(x, z);
    let base = 24 + continental * 20 + hills * 17 + detail * 3;
    const frost = Math.max(0, Math.min(1, (.36 - warmth) / .15));
    const dune = Math.max(0, Math.min(1, (.38 - moisture) / .17));
    const fen = Math.max(0, Math.min(1, (moisture - .63) / .13));
    base += frost * (9 + hills * 17) - dune * 7 - fen * 9;
    const ocean = Math.max(0, Math.min(1, (.4 - continental) / .14));
    base = base * (1 - ocean) + (17 + continental * 9) * ocean;
    return Math.max(5, Math.min(WORLD_HEIGHT - 8, Math.floor(base)));
  }

  generate(cx: number, cz: number): GeneratedChunk {
    const chunk = new Chunk(cx, cz);
    const biome = this.biomeAt(cx * CHUNK_SIZE + 8, cz * CHUNK_SIZE + 8);
    const heightMap = new Int16Array(CHUNK_SIZE * CHUNK_SIZE);
    for (let x = 0; x < CHUNK_SIZE; x += 1) {
      for (let z = 0; z < CHUNK_SIZE; z += 1) {
        const wx = cx * CHUNK_SIZE + x;
        const wz = cz * CHUNK_SIZE + z;
        const height = this.heightAt(wx, wz);
        const columnBiome = this.biomeAt(wx, wz);
        const definition = BIOMES[columnBiome];
        heightMap[x + z * CHUNK_SIZE] = height;
        // New chunks are already air-filled above terrain and the ocean surface.
        for (let y = 0; y <= Math.max(height, SEA_LEVEL); y += 1) {
          let id: BlockIdValue = BlockId.Air;
          if (y === 0) id = BlockId.Bedrock;
          else if (y <= height) {
            const caveField = y > 5 && y < height - 3 ? fbm3(wx / 18, y / 14, wz / 18, this.numericSeed + 501, 3) : 0;
            const cave = y > 5 && y < height - 3 && (caveField > .66 || Math.abs(caveField - .5) < .055 && Math.abs(valueNoise3(wx / 26, y / 22, wz / 26, this.numericSeed + 601) - .5) < .14);
            if (cave && y < height - 2) id = BlockId.Air;
            else if (y === height) {
              if (height <= SEA_LEVEL + 1) id = columnBiome === 'fen' ? BlockId.Moss : BlockId.Sand;
              else id = definition.surface;
            } else if (y > height - 4) {
              id = height <= SEA_LEVEL + 1 && columnBiome !== 'fen' ? BlockId.Sand : definition.subsurface;
            } else {
              id = BlockId.Stone;
              const ore = hash2(wx * 5 + y * 2, wz * 3 - y, this.numericSeed + 992);
              for (const rule of ORE_RULES) if (y >= rule.minDepth && y <= rule.maxDepth && ore > rule.threshold) id = rule.block;
              if (y < 3) id = BlockId.Bedrock;
            }
          } else if (y <= SEA_LEVEL) id = BlockId.Water;
          chunk.set(x, y, z, id);
        }
      }
    }
    this.addCaveEntrances(chunk, heightMap);
    this.addVegetation(chunk, heightMap, cx, cz);
    return { chunk, biome };
  }

  private addCaveEntrances(chunk: Chunk, heightMap: Int16Array): void {
    const startX = chunk.cx * CHUNK_SIZE, startZ = chunk.cz * CHUNK_SIZE;
    const minCellX = Math.floor((startX - CAVE_REACH) / CAVE_CELL_SIZE);
    const maxCellX = Math.floor((startX + CHUNK_SIZE - 1 + CAVE_REACH) / CAVE_CELL_SIZE);
    const minCellZ = Math.floor((startZ - CAVE_REACH) / CAVE_CELL_SIZE);
    const maxCellZ = Math.floor((startZ + CHUNK_SIZE - 1 + CAVE_REACH) / CAVE_CELL_SIZE);
    const carveColumn = (wx: number, wz: number, floor: number, clearance: number): void => {
      const x = wx - startX, z = wz - startZ;
      if (x < 0 || x >= CHUNK_SIZE || z < 0 || z >= CHUNK_SIZE || floor < 6) return;
      const surface = heightMap[x + z * CHUNK_SIZE];
      // Keep coasts sealed and avoid unsupported cuts through a downhill slope.
      if (surface <= SEA_LEVEL + 3 || floor >= surface) return;
      if (chunk.get(x, floor, z) === BlockId.Air) chunk.set(x, floor, z, BlockId.Stone);
      for (let y = floor + 1; y <= Math.min(surface, floor + clearance); y += 1) chunk.set(x, y, z, BlockId.Air);
    };
    for (let cellZ = minCellZ; cellZ <= maxCellZ; cellZ += 1) for (let cellX = minCellX; cellX <= maxCellX; cellX += 1) {
      if (hash2(cellX, cellZ, this.numericSeed + 1700) < .5) continue;
      const ax = cellX * CAVE_CELL_SIZE + 12 + Math.floor(hash2(cellX, cellZ, this.numericSeed + 1701) * 56);
      const az = cellZ * CAVE_CELL_SIZE + 12 + Math.floor(hash2(cellX, cellZ, this.numericSeed + 1702) * 56);
      if (ax < startX - CAVE_REACH || ax > startX + CHUNK_SIZE - 1 + CAVE_REACH || az < startZ - CAVE_REACH || az > startZ + CHUNK_SIZE - 1 + CAVE_REACH) continue;
      const surface = this.heightAt(ax, az);
      if (surface <= SEA_LEVEL + 6) continue;
      let direction: readonly [number, number] = CARDINAL_DIRECTIONS[0], uphill = -Infinity;
      for (const candidate of CARDINAL_DIRECTIONS) {
        const height = this.heightAt(ax + candidate[0] * 10, az + candidate[1] * 10);
        if (height > uphill) { uphill = height; direction = candidate; }
      }
      const [dx, dz] = direction;
      // One-block steps every two blocks make a walk-in ramp instead of a shaft.
      // Features use world coordinates so generation order cannot break seams.
      for (let t = 0; t <= 36; t += 1) {
        const floor = surface - 1 - Math.floor(Math.min(t, 28) / 2);
        const width = t > 26 ? 2 : 1;
        const clearance = t > 26 ? 4 : 3 + (hash2(ax + dx * t, az + dz * t, this.numericSeed + 1703) > .6 ? 1 : 0);
        for (let side = -width; side <= width; side += 1) carveColumn(ax + dx * t - dz * side, az + dz * t + dx * side, floor, clearance);
      }
      const roomX = ax + dx * 32, roomZ = az + dz * 32, roomFloor = surface - 15;
      for (let rx = -5; rx <= 5; rx += 1) for (let rz = -5; rz <= 5; rz += 1) {
        const radius = rx * rx + rz * rz;
        if (radius <= 25) carveColumn(roomX + rx, roomZ + rz, roomFloor, radius < 10 ? 5 : 4);
      }
      // A wider transverse gallery connects the entry to the natural cave field.
      for (let t = -18; t <= 18; t += 1) for (let side = -1; side <= 1; side += 1) {
        carveColumn(roomX - dz * t + dx * side, roomZ + dx * t + dz * side, roomFloor, 4);
      }
    }
  }

  private addVegetation(chunk: Chunk, heightMap: Int16Array, cx: number, cz: number): void {
    for (let x = 0; x < CHUNK_SIZE; x += 1) for (let z = 0; z < CHUNK_SIZE; z += 1) {
      const wx = cx * CHUNK_SIZE + x, wz = cz * CHUNK_SIZE + z;
      const biome = this.biomeAt(wx, wz), surface = heightMap[x + z * CHUNK_SIZE];
      if (biome === 'dune' || surface <= SEA_LEVEL + 2 || chunk.get(x, surface, z) !== BIOMES[biome].surface || chunk.get(x, surface + 1, z) !== BlockId.Air) continue;
      const roll = hash2(wx, wz, this.numericSeed + 1200);
      // Tree canopies fit within this chunk; smaller plants can cross chunk edges.
      const treeFits = x >= 2 && x < CHUNK_SIZE - 2 && z >= 2 && z < CHUNK_SIZE - 2;
      if (treeFits && roll > 1 - BIOMES[biome].treeDensity) this.addTree(chunk, x, surface + 1, z, 4 + Math.floor(hash2(wx, wz, this.numericSeed + 33) * 3));
      else if (roll > .78) chunk.set(x, surface + 1, z, roll > .96 ? BlockId.Bush : roll > .94 ? BlockId.Flower : roll > .91 ? BlockId.Mushroom : BlockId.Tuft);
    }
  }

  private addTree(chunk: Chunk, x: number, y: number, z: number, height: number): void {
    for (let dy = 0; dy < height; dy += 1) chunk.set(x, y + dy, z, BlockId.Wood);
    for (let dx = -2; dx <= 2; dx += 1) for (let dz = -2; dz <= 2; dz += 1) {
      for (let dy = height - 2; dy <= height + 1; dy += 1) {
        if (Math.abs(dx) + Math.abs(dz) + (dy === height + 1 ? 2 : 0) < 4 && chunk.get(x + dx, y + dy, z + dz) === BlockId.Air) chunk.set(x + dx, y + dy, z + dz, BlockId.Leaves);
      }
    }
  }
}
