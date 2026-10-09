import * as THREE from 'three';
import { BLOCKS, BlockId } from './blocks.ts';
import { hash3 } from './noise.ts';

export const ATLAS_COLUMNS = 16;
export const TILE_SIZE = 16;

export class TextureAtlas {
  readonly texture: THREE.CanvasTexture;
  readonly opaque: THREE.MeshLambertMaterial;
  readonly transparent: THREE.MeshLambertMaterial;

  constructor() {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = ATLAS_COLUMNS * TILE_SIZE;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas textures are unavailable.');
    for (const block of Object.values(BLOCKS)) {
      if (!block.id) continue;
      for (let face = 0; face < 3; face += 1) {
        const tile = block.id * 3 + face;
        const ox = (tile % ATLAS_COLUMNS) * TILE_SIZE;
        const oy = Math.floor(tile / ATLAS_COLUMNS) * TILE_SIZE;
        for (let y = 0; y < TILE_SIZE; y += 1) for (let x = 0; x < TILE_SIZE; x += 1) {
          let color = new THREE.Color(block.color);
          const random = hash3(x, y, face, block.id * 99);
          let variation = (random - .5) * .13;
          if ([BlockId.CoalOre, BlockId.IronOre, BlockId.CopperOre, BlockId.Lumenite].includes(block.id as 9)) {
            color.set(random > .73 ? block.color : 0x68747a);
          }
          if (block.id === BlockId.Grass) {
            if (face === 2 || face === 1 && y > 3 + Math.floor(hash3(x, 0, 0, 42) * 3)) color.set(0x8a6045);
          }
          if (block.id === BlockId.Wood) {
            variation += face === 1 ? (x % 4 === 0 ? -.13 : .04) : (Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5)) % 3 < 1 ? -.13 : .04);
          }
          if (block.id === BlockId.Plank && (y % 5 === 0 || x === 2 && y < 5 || x === 11 && y > 5 && y < 10)) variation -= .22;
          if (block.id === BlockId.Stone && ((x + y * 2) % 17 === 0)) variation -= .17;
          if (block.id === BlockId.Leaves && random < .23) variation -= .17;
          if (block.id === BlockId.Water) variation = Math.sin(x * .8 + y * .3) * .028;
          if (block.id === BlockId.Glass) variation = x === 0 || y === 0 || x === 15 || y === 15 || x + y === 10 ? .16 : -.04;
          if (block.id === BlockId.Torch) color.set(y < 6 ? 0xffd987 : 0x9b6846);
          if (block.id === BlockId.Chest) { if (y === 4 || y === 5) color.set(0x624a39); if (x > 6 && x < 10 && y > 3 && y < 9) color.set(0xe1c16f); }
          if (block.id === BlockId.Bush && random > .84) color.set(0xdd767b);
          if (block.id === BlockId.Flower && y > 5) color.set(0x74a45c);
          if (block.id === BlockId.Lantern && x % 7 !== 0 && y % 7 !== 0) color.set(0xffe7a1);
          color.offsetHSL(0, 0, variation);
          context.fillStyle = `#${color.getHexString()}`;
          context.fillRect(ox + x, oy + y, 1, 1);
        }
      }
    }
    this.texture = new THREE.CanvasTexture(canvas);
    this.texture.magFilter = THREE.NearestFilter;
    this.texture.minFilter = THREE.NearestFilter;
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.generateMipmaps = false;
    this.opaque = new THREE.MeshLambertMaterial({ map: this.texture, vertexColors: true });
    this.transparent = new THREE.MeshLambertMaterial({ map: this.texture, vertexColors: true, transparent: true, opacity: .68, depthWrite: false });
  }

  dispose(): void { this.texture.dispose(); this.opaque.dispose(); this.transparent.dispose(); }
}
