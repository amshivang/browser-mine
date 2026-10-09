import { TerrainGenerator } from './TerrainGenerator.ts';

let generator: TerrainGenerator | undefined;
self.onmessage = (event: MessageEvent<{ seed: string; cx: number; cz: number; epoch: number }>) => {
  const { seed, cx, cz, epoch } = event.data;
  try {
    if (!generator || generator.seed !== seed) generator = new TerrainGenerator(seed);
    const { chunk } = generator.generate(cx, cz);
    self.postMessage({ cx, cz, epoch, blocks: chunk.blocks.buffer }, { transfer: [chunk.blocks.buffer] });
  } catch (error) { self.postMessage({ cx, cz, epoch, error: String(error) }); }
};
