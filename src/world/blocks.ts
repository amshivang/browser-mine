export type ToolKind = 'pickaxe' | 'axe' | 'shovel' | 'sword' | 'hand';

export const CHUNK_SIZE = 16;
export const WORLD_HEIGHT = 96;
export const SEA_LEVEL = 29;

export const BlockId = {
  Air: 0,
  Grass: 1,
  Dirt: 2,
  Stone: 3,
  Sand: 4,
  Gravel: 5,
  Wood: 6,
  Leaves: 7,
  Water: 8,
  CoalOre: 9,
  IronOre: 10,
  CopperOre: 11,
  Lumenite: 12,
  Bedrock: 13,
  Torch: 14,
  Plank: 15,
  Glass: 16,
  Snow: 17,
  Moss: 18,
  Clay: 19,
  Chest: 20,
  Tuft: 21,
  Flower: 22,
  Mushroom: 23,
  Lantern: 24,
  Bush: 25,
} as const;

export type BlockIdValue = (typeof BlockId)[keyof typeof BlockId];

export interface BlockDefinition {
  id: BlockIdValue;
  name: string;
  color: number;
  solid: boolean;
  transparent?: boolean;
  hardness: number;
  drops: string | null;
  tool?: ToolKind;
  minTier?: number;
  light?: number;
}

export const BLOCKS: Record<number, BlockDefinition> = {
  [BlockId.Air]: { id: BlockId.Air, name: 'Air', color: 0, solid: false, transparent: true, hardness: 0, drops: null },
  [BlockId.Grass]: { id: BlockId.Grass, name: 'Verdant Turf', color: 0x719b54, solid: true, hardness: 0.7, drops: 'dirt', tool: 'shovel' },
  [BlockId.Dirt]: { id: BlockId.Dirt, name: 'Earth', color: 0x8a6045, solid: true, hardness: 0.65, drops: 'dirt', tool: 'shovel' },
  [BlockId.Stone]: { id: BlockId.Stone, name: 'Slate', color: 0x68747a, solid: true, hardness: 2.4, drops: 'stone', tool: 'pickaxe', minTier: 0 },
  [BlockId.Sand]: { id: BlockId.Sand, name: 'Pale Sand', color: 0xd1b274, solid: true, hardness: 0.6, drops: 'sand', tool: 'shovel' },
  [BlockId.Gravel]: { id: BlockId.Gravel, name: 'Gravel', color: 0x8c8e86, solid: true, hardness: 0.8, drops: 'gravel', tool: 'shovel' },
  [BlockId.Wood]: { id: BlockId.Wood, name: 'Redwood', color: 0x83543b, solid: true, hardness: 1.4, drops: 'wood', tool: 'axe' },
  [BlockId.Leaves]: { id: BlockId.Leaves, name: 'Canopy', color: 0x3f8060, solid: true, transparent: true, hardness: 0.35, drops: 'leaves', tool: 'axe' },
  [BlockId.Water]: { id: BlockId.Water, name: 'Water', color: 0x3f9db4, solid: false, transparent: true, hardness: Infinity, drops: null },
  [BlockId.CoalOre]: { id: BlockId.CoalOre, name: 'Coal Vein', color: 0x303b43, solid: true, hardness: 3, drops: 'coal', tool: 'pickaxe', minTier: 0 },
  [BlockId.IronOre]: { id: BlockId.IronOre, name: 'Iron Vein', color: 0xb46b55, solid: true, hardness: 3.6, drops: 'iron', tool: 'pickaxe', minTier: 1 },
  [BlockId.CopperOre]: { id: BlockId.CopperOre, name: 'Copper Vein', color: 0xb87957, solid: true, hardness: 3.3, drops: 'copper', tool: 'pickaxe', minTier: 0 },
  [BlockId.Lumenite]: { id: BlockId.Lumenite, name: 'Lumenite', color: 0x7dc9d0, solid: true, hardness: 4.4, drops: 'lumenite', tool: 'pickaxe', minTier: 2 },
  [BlockId.Bedrock]: { id: BlockId.Bedrock, name: 'Deepstone', color: 0x242d35, solid: true, hardness: Infinity, drops: null },
  [BlockId.Torch]: { id: BlockId.Torch, name: 'Glowreed', color: 0xe8b866, solid: false, transparent: true, hardness: 0.2, drops: 'torch', light: 12 },
  [BlockId.Plank]: { id: BlockId.Plank, name: 'Cut Redwood', color: 0xb2764d, solid: true, hardness: 1.2, drops: 'plank', tool: 'axe' },
  [BlockId.Glass]: { id: BlockId.Glass, name: 'Clearglass', color: 0x9ad7d6, solid: true, transparent: true, hardness: 0.3, drops: 'glass' },
  [BlockId.Snow]: { id: BlockId.Snow, name: 'Blue Snow', color: 0xcfe5e9, solid: true, hardness: 0.5, drops: 'snow', tool: 'shovel' },
  [BlockId.Moss]: { id: BlockId.Moss, name: 'Moss', color: 0x53825b, solid: true, hardness: 0.55, drops: 'moss', tool: 'shovel' },
  [BlockId.Clay]: { id: BlockId.Clay, name: 'River Clay', color: 0x9a7770, solid: true, hardness: 0.7, drops: 'clay', tool: 'shovel' },
  [BlockId.Chest]: { id: BlockId.Chest, name: 'Trail Cache', color: 0xc59155, solid: true, hardness: 1.5, drops: 'chest', tool: 'axe' },
  [BlockId.Tuft]: { id: BlockId.Tuft, name: 'Sedge', color: 0x8cad5c, solid: false, transparent: true, hardness: .15, drops: null },
  [BlockId.Flower]: { id: BlockId.Flower, name: 'Sunbells', color: 0xedba69, solid: false, transparent: true, hardness: .15, drops: 'berries' },
  [BlockId.Mushroom]: { id: BlockId.Mushroom, name: 'Duskcap', color: 0xb48ac2, solid: false, transparent: true, hardness: .15, drops: 'mushroom' },
  [BlockId.Lantern]: { id: BlockId.Lantern, name: 'Copper Beacon', color: 0xe6d69b, solid: true, hardness: .7, drops: 'lantern', light: 16 },
  [BlockId.Bush]: { id: BlockId.Bush, name: 'Sunberry Bush', color: 0x628956, solid: false, transparent: true, hardness: .35, drops: 'berries' },
};

export function isOpaqueSolid(id: number): boolean {
  const block = BLOCKS[id] ?? BLOCKS[BlockId.Air];
  return block.solid && !block.transparent;
}

export function isSolid(id: number): boolean {
  return (BLOCKS[id] ?? BLOCKS[BlockId.Air]).solid;
}

export function isVisible(id: number): boolean {
  return id !== BlockId.Air;
}
