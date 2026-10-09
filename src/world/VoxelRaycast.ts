import * as THREE from 'three';
import { BlockId, type BlockIdValue } from './blocks.ts';
import type { World } from './World.ts';

export interface VoxelHit { x: number; y: number; z: number; id: BlockIdValue; normal: THREE.Vector3; }

export function raycastVoxel(world: World, origin: THREE.Vector3, direction: THREE.Vector3, reach = 6): VoxelHit | undefined {
  const cell = [Math.floor(origin.x), Math.floor(origin.y), Math.floor(origin.z)];
  const o = origin.toArray(), d = direction.toArray();
  const sign = d.map((value) => value >= 0 ? 1 : -1);
  const delta = d.map((value) => value === 0 ? Infinity : Math.abs(1 / value));
  const next = d.map((value, axis) => value === 0 ? Infinity : (cell[axis] + (sign[axis] > 0 ? 1 : 0) - o[axis]) / value);
  const normal = new THREE.Vector3(); let distance = 0;
  while (distance <= reach) {
    if (!world.hasChunkAt(cell[0], cell[2])) return undefined;
    const id = world.getBlock(cell[0], cell[1], cell[2]);
    if (id !== BlockId.Air && id !== BlockId.Water) return { x: cell[0], y: cell[1], z: cell[2], id, normal: normal.clone() };
    const axis = next[0] < next[1] ? next[0] < next[2] ? 0 : 2 : next[1] < next[2] ? 1 : 2;
    distance = next[axis]; next[axis] += delta[axis]; cell[axis] += sign[axis]; normal.set(0, 0, 0); normal.setComponent(axis, -sign[axis]);
  }
  return undefined;
}
