import { BlockId, type BlockIdValue } from './blocks.ts';
import { fbm2 } from './noise.ts';

export type Biome = 'meadow' | 'redwood' | 'dune' | 'fen' | 'frost';
export interface BiomeDefinition { name: string; surface: BlockIdValue; subsurface: BlockIdValue; treeDensity: number; weather: 'clear' | 'rain' | 'snow'; }
export const BIOMES: Record<Biome, BiomeDefinition> = {
  meadow: { name: 'Sunward Meadows', surface: BlockId.Grass, subsurface: BlockId.Dirt, treeDensity: .013, weather: 'clear' },
  redwood: { name: 'Redwood Reach', surface: BlockId.Grass, subsurface: BlockId.Dirt, treeDensity: .035, weather: 'rain' },
  dune: { name: 'Amber Dunes', surface: BlockId.Sand, subsurface: BlockId.Sand, treeDensity: 0, weather: 'clear' },
  fen: { name: 'Whisperfen', surface: BlockId.Moss, subsurface: BlockId.Clay, treeDensity: .019, weather: 'rain' },
  frost: { name: 'Frostward Peaks', surface: BlockId.Snow, subsurface: BlockId.Dirt, treeDensity: .006, weather: 'snow' },
};
export class BiomeGenerator {
  constructor(private readonly seed: number) {}
  climate(x: number, z: number): { warmth: number; moisture: number } {
    return { warmth: fbm2(x / 180, z / 180, this.seed + 77, 3), moisture: fbm2(x / 155, z / 155, this.seed + 181, 3) };
  }
  at(x: number, z: number): Biome {
    const { warmth, moisture } = this.climate(x, z);
    if (warmth < .3) return 'frost';
    if (moisture > .67 && warmth > .5) return 'fen';
    if (moisture < .32 && warmth > .4) return 'dune';
    if (moisture > .55) return 'redwood';
    return 'meadow';
  }
}
