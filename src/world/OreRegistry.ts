import { BlockId, type BlockIdValue } from './blocks.ts';

export interface OreRule { block: BlockIdValue; minDepth: number; maxDepth: number; threshold: number; }
export const ORE_RULES: OreRule[] = [
  { block: BlockId.CoalOre, minDepth: 8, maxDepth: 64, threshold: .952 },
  { block: BlockId.CopperOre, minDepth: 12, maxDepth: 50, threshold: .968 },
  { block: BlockId.IronOre, minDepth: 5, maxDepth: 38, threshold: .982 },
  { block: BlockId.Lumenite, minDepth: 4, maxDepth: 22, threshold: .994 },
];
