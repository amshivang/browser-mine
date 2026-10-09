import { ITEMS, type ItemStack } from './items.ts';

const SLOT_COUNT = 45;
const HOTBAR_COUNT = 9;

function isItemId(id: unknown): id is string { return typeof id === 'string' && Object.prototype.hasOwnProperty.call(ITEMS, id); }
function isCount(count: unknown): count is number { return typeof count === 'number' && Number.isSafeInteger(count) && count > 0; }
function isSlot(index: number): boolean { return Number.isInteger(index) && index >= 0 && index < SLOT_COUNT; }

/** Copy only supported stack fields; old tools without durability start at full strength. */
export function sanitizeItemStack(value: unknown): ItemStack | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  if (!Object.prototype.hasOwnProperty.call(item, 'id') || !Object.prototype.hasOwnProperty.call(item, 'count') || !isItemId(item.id) || !isCount(item.count)) return null;
  const definition = ITEMS[item.id];
  const stack: ItemStack = { id: item.id, count: Math.min(item.count, definition.maxStack) };
  if (definition.tool) {
    const durability = Object.prototype.hasOwnProperty.call(item, 'durability') ? item.durability : undefined;
    if (durability === undefined) stack.durability = definition.tool.durability;
    else {
      if (typeof durability !== 'number' || !Number.isFinite(durability) || durability < 1) return null;
      stack.durability = Math.min(Math.floor(durability), definition.tool.durability);
    }
    stack.count = 1;
  }
  return stack;
}

function addToSlots(slots: Array<ItemStack | null>, stack: ItemStack, count: number): number {
  const definition = ITEMS[stack.id];
  // Tools carry individual wear, even when two tools happen to have equal durability.
  if (!definition.tool) for (const slot of slots) {
    if (!count) break;
    if (slot?.id === stack.id) {
      const amount = Math.min(count, definition.maxStack - slot.count);
      slot.count += amount; count -= amount;
    }
  }
  for (let i = 0; i < SLOT_COUNT && count > 0; i += 1) {
    if (!slots[i]) { const amount = Math.min(count, definition.maxStack); slots[i] = { ...stack, count: amount }; count -= amount; }
  }
  return count;
}

function removeFromSlots(slots: Array<ItemStack | null>, id: string, count: number): void {
  for (let i = 0; i < SLOT_COUNT && count > 0; i += 1) {
    const slot = slots[i];
    if (slot?.id !== id) continue;
    const amount = Math.min(slot.count, count); slot.count -= amount; count -= amount;
    if (!slot.count) slots[i] = null;
  }
}

export class Inventory {
  readonly slots: Array<ItemStack | null> = Array.from({ length: SLOT_COUNT }, () => null);
  private selectedIndex = 0;
  onChange?: () => void;

  constructor() {
    this.slots[0] = { id: 'wooden_pickaxe', count: 1, durability: ITEMS.wooden_pickaxe.tool?.durability };
    this.slots[1] = { id: 'wood', count: 8 };
    this.slots[2] = { id: 'berries', count: 8 };
    this.slots[3] = { id: 'torch', count: 8 };
  }

  get selected(): number { return this.selectedIndex; }
  set selected(index: number) { this.selectedIndex = Number.isFinite(index) ? Math.max(0, Math.min(HOTBAR_COUNT - 1, Math.floor(index))) : 0; }
  get hotbar(): Array<ItemStack | null> { return this.slots.slice(0, HOTBAR_COUNT); }
  get selectedStack(): ItemStack | null { return this.slots[this.selected] ?? null; }
  setSelected(index: number): void { this.selected = index; this.onChange?.(); }

  private normalizeSlots(): void {
    this.slots.length = SLOT_COUNT;
    for (let i = 0; i < SLOT_COUNT; i += 1) {
      const current = this.slots[i], stack = sanitizeItemStack(current);
      if (!current || !stack) this.slots[i] = stack;
      else {
        // Preserve references used by the cache transfer UI.
        current.count = stack.count;
        if (stack.durability === undefined) delete current.durability;
        else current.durability = stack.durability;
      }
    }
  }

  add(id: string, count: number, durability?: number): number {
    if (!isCount(count)) return Number.isFinite(count) && count > 0 ? count : 0;
    const stack = sanitizeItemStack({ id, count: 1, durability });
    if (!stack) return count;
    this.normalizeSlots();
    const leftover = addToSlots(this.slots, stack, count);
    if (leftover < count) this.onChange?.();
    return leftover;
  }

  remove(id: string, count: number): boolean {
    if (!isItemId(id) || !isCount(count)) return false;
    if (this.count(id) < count) return false;
    this.normalizeSlots();
    removeFromSlots(this.slots, id, count);
    this.onChange?.();
    return true;
  }

  count(id: string): number {
    if (!isItemId(id)) return 0;
    return this.serialize().reduce((sum, slot) => sum + (slot?.id === id ? slot.count : 0), 0);
  }

  damageSelected(amount = 1): void {
    if (!isCount(amount)) return;
    this.normalizeSlots();
    const stack = this.selectedStack;
    if (!stack || stack.durability === undefined) return;
    stack.durability -= amount;
    if (stack.durability <= 0) this.slots[this.selected] = null;
    this.onChange?.();
  }

  swapOrMerge(from: number, to: number): void {
    if (!isSlot(from) || !isSlot(to) || from === to) return;
    this.normalizeSlots();
    const a = this.slots[from]; const b = this.slots[to];
    if (!a && !b) return;
    if (a && b && a.id === b.id && !ITEMS[a.id].tool) {
      const max = ITEMS[a.id].maxStack;
      const move = Math.min(a.count, max - b.count);
      if (!move) return;
      b.count += move; a.count -= move;
      if (!a.count) this.slots[from] = null;
    } else { this.slots[from] = b; this.slots[to] = a; }
    this.onChange?.();
  }

  craft(recipe: { ingredients: Array<{ id: string; count: number }>; output: ItemStack }): boolean {
    if (!recipe || !Array.isArray(recipe.ingredients) || !recipe.ingredients.length || recipe.ingredients.length > SLOT_COUNT || !recipe.output || !isCount(recipe.output.count)) return false;
    const output = sanitizeItemStack({ id: recipe.output.id, count: 1, durability: recipe.output.durability });
    if (!output || recipe.output.count > ITEMS[output.id].maxStack * SLOT_COUNT) return false;
    const required = new Map<string, number>();
    for (const ingredient of recipe.ingredients) {
      if (!ingredient || !isItemId(ingredient.id) || !isCount(ingredient.count)) return false;
      const total = (required.get(ingredient.id) ?? 0) + ingredient.count;
      if (!Number.isSafeInteger(total) || total > ITEMS[ingredient.id].maxStack * SLOT_COUNT) return false;
      required.set(ingredient.id, total);
    }
    // Simulate both consumption and output placement; observers see only a committed craft.
    const next = this.serialize();
    for (const [id, count] of required) {
      if (next.reduce((sum, slot) => sum + (slot?.id === id ? slot.count : 0), 0) < count) return false;
      removeFromSlots(next, id, count);
    }
    if (addToSlots(next, output, recipe.output.count) > 0) return false;
    this.slots.length = SLOT_COUNT;
    for (let i = 0; i < SLOT_COUNT; i += 1) this.slots[i] = next[i];
    this.onChange?.();
    return true;
  }

  serialize(): Array<ItemStack | null> { return Array.from({ length: SLOT_COUNT }, (_, index) => sanitizeItemStack(this.slots[index])); }
  load(items: Array<ItemStack | null>): void {
    const next = Array.from({ length: SLOT_COUNT }, (_, index) => sanitizeItemStack(Array.isArray(items) ? items[index] : null));
    this.slots.length = SLOT_COUNT;
    for (let i = 0; i < SLOT_COUNT; i += 1) this.slots[i] = next[i];
    this.onChange?.();
  }
}
