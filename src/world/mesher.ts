import * as THREE from 'three';
import { BLOCKS, BlockId, CHUNK_SIZE, WORLD_HEIGHT, isOpaqueSolid } from './blocks.ts';
import { Chunk } from './Chunk.ts';
import { ATLAS_COLUMNS, TILE_SIZE, type TextureAtlas } from './TextureAtlas.ts';

const FACES = [
  { dir: [0, 1, 0], corners: [[0, 1, 0], [1, 1, 0], [1, 1, 1], [0, 1, 1]] },
  { dir: [0, -1, 0], corners: [[0, 0, 1], [1, 0, 1], [1, 0, 0], [0, 0, 0]] },
  { dir: [1, 0, 0], corners: [[1, 0, 0], [1, 0, 1], [1, 1, 1], [1, 1, 0]] },
  { dir: [-1, 0, 0], corners: [[0, 0, 1], [0, 0, 0], [0, 1, 0], [0, 1, 1]] },
  { dir: [0, 0, 1], corners: [[1, 0, 1], [0, 0, 1], [0, 1, 1], [1, 1, 1]] },
  { dir: [0, 0, -1], corners: [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]] },
] as const;
const FACE_SHADES = [1, .62, .85, .82, .92, .78];
const FULL_BOUNDS = [0, 0, 0, 1, 1, 1] as const;
const SMALL_BOUNDS: Record<number, readonly number[]> = {
  [BlockId.Torch]: [.42, 0, .42, .16, .75, .16],
  [BlockId.Tuft]: [.37, 0, .37, .26, .4, .26],
  [BlockId.Flower]: [.32, 0, .32, .36, .6, .36],
  [BlockId.Mushroom]: [.25, 0, .25, .5, .25, .5],
  [BlockId.Bush]: [.1, 0, .1, .8, .65, .8],
};

export function buildChunkMesh(chunk: Chunk, get: (x: number, y: number, z: number) => number, atlas: TextureAtlas): THREE.Group {
  const sample = (x: number, y: number, z: number): number => {
    if (y < 0 || y >= WORLD_HEIGHT) return BlockId.Air;
    return x >= 0 && x < CHUNK_SIZE && z >= 0 && z < CHUNK_SIZE ? chunk.get(x, y, z) : get(x, y, z);
  };
  const atlasSize = ATLAS_COLUMNS * TILE_SIZE;
  const uvSize = (TILE_SIZE - 1) / atlasSize;
  const buffers = Array.from({ length: 2 }, () => ({ positions: [] as number[], normals: [] as number[], colors: [] as number[], uvs: [] as number[], indices: [] as number[] }));
  const heights = new Int16Array(CHUNK_SIZE * CHUNK_SIZE);
  for (let z = 0; z < CHUNK_SIZE; z += 1) for (let x = 0; x < CHUNK_SIZE; x += 1) {
    for (let y = WORLD_HEIGHT - 1; y > 0; y -= 1) if (BLOCKS[chunk.get(x, y, z)].solid) { heights[x + z * CHUNK_SIZE] = y; break; }
  }
  for (let y = 0; y < WORLD_HEIGHT; y += 1) for (let z = 0; z < CHUNK_SIZE; z += 1) for (let x = 0; x < CHUNK_SIZE; x += 1) {
    const id = chunk.get(x, y, z);
    if (id === BlockId.Air) continue;
    const bounds = SMALL_BOUNDS[id] ?? FULL_BOUNDS;
    const loweredWater = id === BlockId.Water && sample(x, y + 1, z) !== BlockId.Water;
    const transparent = id === BlockId.Water || id === BlockId.Glass;
    const data = buffers[transparent ? 1 : 0];
    for (let f = 0; f < FACES.length; f += 1) {
      const face = FACES[f]; const neighbor = sample(x + face.dir[0], y + face.dir[1], z + face.dir[2]);
      const axis = face.dir[0] ? 0 : face.dir[1] ? 1 : 2;
      const atBoundary = face.dir[axis] > 0 ? bounds[axis] + bounds[axis + 3] === 1 : bounds[axis] === 0;
      const matchingFace = neighbor === id && (face.dir[axis] > 0 ? bounds[axis] === 0 : bounds[axis] + bounds[axis + 3] === 1);
      const waterEdge = id === BlockId.Water && neighbor === BlockId.Water && f >= 2 && !loweredWater && sample(x + face.dir[0], y + 1, z + face.dir[2]) !== BlockId.Water;
      // Small decorations do not touch their side/top neighbors. Keep those faces.
      if (atBoundary && !(f === 0 && loweredWater) && !waterEdge && (isOpaqueSolid(neighbor) || matchingFace)) continue;
      const base = data.positions.length / 3;
      const tile = id * 3 + (f === 0 ? 0 : f === 1 ? 2 : 1);
      const u0 = (tile % ATLAS_COLUMNS) / ATLAS_COLUMNS + .5 / atlasSize;
      const v0 = 1 - (Math.floor(tile / ATLAS_COLUMNS) + 1) / ATLAS_COLUMNS + .5 / atlasSize;
      const faceShade = FACE_SHADES[f];
      const depth = heights[x + z * CHUNK_SIZE] - y;
      const caveShade = depth > 5 ? Math.max(.35, 1 - depth * .045) : 1;
      for (let i = 0; i < 4; i += 1) {
        const corner = face.corners[i];
        const px = x + bounds[0] + corner[0] * bounds[3];
        let py = y + bounds[1] + corner[1] * bounds[4];
        const pz = z + bounds[2] + corner[2] * bounds[5];
        if (loweredWater && corner[1] === 1) py -= .12;
        if (waterEdge && corner[1] === 0) py += .88;
        data.positions.push(px, py, pz);
        data.normals.push(...face.dir);
        const occlusion = f === 0 && isOpaqueSolid(sample(x + (corner[0] ? 1 : -1), y + 1, z + (corner[2] ? 1 : -1))) ? .78 : 1;
        const light = BLOCKS[id].light ? 1 : faceShade * caveShade * occlusion;
        data.colors.push(light, light, light);
        data.uvs.push(u0 + (i === 1 || i === 2 ? uvSize : 0), v0 + (i >= 2 ? uvSize : 0));
      }
      data.indices.push(base, base + 2, base + 1, base, base + 3, base + 2);
    }
  }
  const group = new THREE.Group(); group.position.set(chunk.cx * CHUNK_SIZE, 0, chunk.cz * CHUNK_SIZE);
  buffers.forEach((data, i) => {
    if (!data.positions.length) return;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(data.positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(data.normals, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(data.colors, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(data.uvs, 2));
    geometry.setIndex(data.indices); geometry.computeBoundingSphere();
    const mesh = new THREE.Mesh(geometry, i ? atlas.transparent : atlas.opaque);
    mesh.castShadow = i === 0; mesh.receiveShadow = true; group.add(mesh);
  });
  chunk.dirty = false; return group;
}
