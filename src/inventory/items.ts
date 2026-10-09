export interface ItemDefinition {
  id: string;
  name: string;
  color: string;
  maxStack: number;
  kind: 'block' | 'tool' | 'food' | 'material' | 'weapon';
  blockId?: number;
  tool?: { kind: 'pickaxe' | 'axe' | 'shovel' | 'sword'; tier: number; speed: number; durability: number; damage?: number };
  food?: number;
}

export const ITEMS: Record<string, ItemDefinition> = {
  dirt: { id: 'dirt', name: 'Earth', color: '#8a6045', maxStack: 64, kind: 'block', blockId: 2 },
  stone: { id: 'stone', name: 'Slate', color: '#68747a', maxStack: 64, kind: 'block', blockId: 3 },
  sand: { id: 'sand', name: 'Pale Sand', color: '#d1b274', maxStack: 64, kind: 'block', blockId: 4 },
  gravel: { id: 'gravel', name: 'Gravel', color: '#8c8e86', maxStack: 64, kind: 'block', blockId: 5 },
  wood: { id: 'wood', name: 'Redwood', color: '#83543b', maxStack: 64, kind: 'block', blockId: 6 },
  leaves: { id: 'leaves', name: 'Canopy', color: '#3f8060', maxStack: 64, kind: 'block', blockId: 7 },
  coal: { id: 'coal', name: 'Coal', color: '#303b43', maxStack: 64, kind: 'material' },
  iron: { id: 'iron', name: 'Iron', color: '#b46b55', maxStack: 64, kind: 'material' },
  copper: { id: 'copper', name: 'Copper', color: '#b87957', maxStack: 64, kind: 'material' },
  lumenite: { id: 'lumenite', name: 'Lumenite', color: '#7dc9d0', maxStack: 32, kind: 'material' },
  plank: { id: 'plank', name: 'Cut Redwood', color: '#b2764d', maxStack: 64, kind: 'block', blockId: 15 },
  glass: { id: 'glass', name: 'Clearglass', color: '#9ad7d6', maxStack: 64, kind: 'block', blockId: 16 },
  snow: { id: 'snow', name: 'Blue Snow', color: '#cfe5e9', maxStack: 64, kind: 'block', blockId: 17 },
  moss: { id: 'moss', name: 'Moss', color: '#53825b', maxStack: 64, kind: 'block', blockId: 18 },
  clay: { id: 'clay', name: 'River Clay', color: '#9a7770', maxStack: 64, kind: 'material' },
  torch: { id: 'torch', name: 'Glowreed', color: '#e8b866', maxStack: 32, kind: 'block', blockId: 14 },
  berries: { id: 'berries', name: 'Sun Berries', color: '#d75e79', maxStack: 32, kind: 'food', food: 4 },
  bread: { id: 'bread', name: 'Trail Loaf', color: '#d49a57', maxStack: 16, kind: 'food', food: 7 },
  wooden_pickaxe: { id: 'wooden_pickaxe', name: 'Redwood Pick', color: '#ba8653', maxStack: 1, kind: 'tool', tool: { kind: 'pickaxe', tier: 0, speed: 3.2, durability: 80 } },
  stone_pickaxe: { id: 'stone_pickaxe', name: 'Slate Pick', color: '#84939a', maxStack: 1, kind: 'tool', tool: { kind: 'pickaxe', tier: 1, speed: 5.2, durability: 160 } },
  iron_pickaxe: { id: 'iron_pickaxe', name: 'Iron Pick', color: '#ddb0a4', maxStack: 1, kind: 'tool', tool: { kind: 'pickaxe', tier: 2, speed: 7.8, durability: 290 } },
  wooden_axe: { id: 'wooden_axe', name: 'Redwood Axe', color: '#ba8653', maxStack: 1, kind: 'tool', tool: { kind: 'axe', tier: 0, speed: 4.1, durability: 80 } },
  stone_axe: { id: 'stone_axe', name: 'Slate Axe', color: '#84939a', maxStack: 1, kind: 'tool', tool: { kind: 'axe', tier: 1, speed: 6, durability: 160 } },
  shovel: { id: 'shovel', name: 'Field Shovel', color: '#b8c5ba', maxStack: 1, kind: 'tool', tool: { kind: 'shovel', tier: 1, speed: 6.5, durability: 150 } },
  iron_sword: { id: 'iron_sword', name: 'Iron Saber', color: '#d6e8e2', maxStack: 1, kind: 'weapon', tool: { kind: 'sword', tier: 2, speed: 1, durability: 220, damage: 7 } },
  iron_axe: { id: 'iron_axe', name: 'Iron Axe', color: '#ddb0a4', maxStack: 1, kind: 'tool', tool: { kind: 'axe', tier: 2, speed: 8, durability: 290, damage: 5 } },
  wooden_sword: { id: 'wooden_sword', name: 'Redwood Saber', color: '#ba8653', maxStack: 1, kind: 'weapon', tool: { kind: 'sword', tier: 0, speed: 1, durability: 80, damage: 4 } },
  stone_sword: { id: 'stone_sword', name: 'Slate Saber', color: '#84939a', maxStack: 1, kind: 'weapon', tool: { kind: 'sword', tier: 1, speed: 1, durability: 160, damage: 5 } },
  chest: { id: 'chest', name: 'Trail Cache', color: '#c59155', maxStack: 16, kind: 'block', blockId: 20 },
  lantern: { id: 'lantern', name: 'Copper Beacon', color: '#e6d69b', maxStack: 32, kind: 'block', blockId: 24 },
  mushroom: { id: 'mushroom', name: 'Duskcap', color: '#b48ac2', maxStack: 32, kind: 'food', food: 3 },
};

export interface ItemStack { id: string; count: number; durability?: number; }

export interface Recipe { id: string; name: string; ingredients: Array<{ id: string; count: number }>; output: ItemStack; }

export const RECIPES: Recipe[] = [
  { id: 'planks', name: 'Cut Redwood ×4', ingredients: [{ id: 'wood', count: 1 }], output: { id: 'plank', count: 4 } },
  { id: 'wooden_pickaxe', name: 'Redwood Pick', ingredients: [{ id: 'plank', count: 3 }, { id: 'wood', count: 2 }], output: { id: 'wooden_pickaxe', count: 1 } },
  { id: 'stone_pickaxe', name: 'Slate Pick', ingredients: [{ id: 'stone', count: 3 }, { id: 'wood', count: 2 }], output: { id: 'stone_pickaxe', count: 1 } },
  { id: 'iron_pickaxe', name: 'Iron Pick', ingredients: [{ id: 'iron', count: 3 }, { id: 'wood', count: 2 }], output: { id: 'iron_pickaxe', count: 1 } },
  { id: 'wooden_axe', name: 'Redwood Axe', ingredients: [{ id: 'plank', count: 3 }, { id: 'wood', count: 2 }], output: { id: 'wooden_axe', count: 1 } },
  { id: 'stone_axe', name: 'Slate Axe', ingredients: [{ id: 'stone', count: 3 }, { id: 'wood', count: 2 }], output: { id: 'stone_axe', count: 1 } },
  { id: 'shovel', name: 'Field Shovel', ingredients: [{ id: 'stone', count: 1 }, { id: 'wood', count: 2 }], output: { id: 'shovel', count: 1 } },
  { id: 'iron_sword', name: 'Iron Saber', ingredients: [{ id: 'iron', count: 2 }, { id: 'wood', count: 1 }], output: { id: 'iron_sword', count: 1 } },
  { id: 'torch', name: 'Glowreed ×4', ingredients: [{ id: 'coal', count: 1 }, { id: 'wood', count: 1 }], output: { id: 'torch', count: 4 } },
  { id: 'glass', name: 'Clearglass', ingredients: [{ id: 'sand', count: 4 }], output: { id: 'glass', count: 4 } },
  { id: 'bread', name: 'Trail Loaf', ingredients: [{ id: 'berries', count: 3 }], output: { id: 'bread', count: 1 } },
  { id: 'chest', name: 'Trail Cache', ingredients: [{ id: 'plank', count: 8 }], output: { id: 'chest', count: 1 } },
  { id: 'lantern', name: 'Copper Beacon', ingredients: [{ id: 'copper', count: 3 }, { id: 'coal', count: 1 }], output: { id: 'lantern', count: 1 } },
  { id: 'iron_axe', name: 'Iron Axe', ingredients: [{ id: 'iron', count: 3 }, { id: 'wood', count: 2 }], output: { id: 'iron_axe', count: 1 } },
  { id: 'wooden_sword', name: 'Redwood Saber', ingredients: [{ id: 'plank', count: 2 }, { id: 'wood', count: 1 }], output: { id: 'wooden_sword', count: 1 } },
  { id: 'stone_sword', name: 'Slate Saber', ingredients: [{ id: 'stone', count: 2 }, { id: 'wood', count: 1 }], output: { id: 'stone_sword', count: 1 } },
];
