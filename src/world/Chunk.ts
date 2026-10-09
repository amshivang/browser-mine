import { CHUNK_SIZE, WORLD_HEIGHT, BlockId, type BlockIdValue } from './blocks.ts';

export class Chunk {
  readonly blocks = new Uint8Array(CHUNK_SIZE * WORLD_HEIGHT * CHUNK_SIZE);
  dirty = true;
  meshVersion = 0;

  constructor(public readonly cx: number, public readonly cz: number) {}

  private index(x: number, y: number, z: number): number {
    return x + CHUNK_SIZE * (z + CHUNK_SIZE * y);
  }

  get(x: number, y: number, z: number): BlockIdValue {
    if (x < 0 || z < 0 || x >= CHUNK_SIZE || z >= CHUNK_SIZE || y < 0 || y >= WORLD_HEIGHT) return BlockId.Air;
    return this.blocks[this.index(x, y, z)] as BlockIdValue;
  }

  set(x: number, y: number, z: number, id: BlockIdValue): void {
    if (x < 0 || z < 0 || x >= CHUNK_SIZE || z >= CHUNK_SIZE || y < 0 || y >= WORLD_HEIGHT) return;
    const index = this.index(x, y, z);
    if (this.blocks[index] !== id) {
      this.blocks[index] = id;
      this.dirty = true;
      this.meshVersion += 1;
    }
  }
}
