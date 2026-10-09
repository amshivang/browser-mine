import type { ItemStack } from '../inventory/items.ts';
import { sanitizeItemStack } from '../inventory/Inventory.ts';
import type { BlockChange } from '../world/World.ts';
import { BLOCKS, WORLD_HEIGHT, type BlockIdValue } from '../world/blocks.ts';
import { CREATURES, type EntitySave } from '../entities/EntityManager.ts';

export interface SettingsData {
  renderDistance: number; loadingDistance: number; fov: number; sensitivity: number; masterVolume: number; musicVolume: number; soundVolume: number;
  graphics: 'low' | 'balanced' | 'high'; viewBobbing: boolean; invertMouse: boolean; shadows: boolean; debug: boolean; dayLength: number; bindings: Record<string, string>;
}
export const DEFAULT_SETTINGS: SettingsData = {
  renderDistance: 3, loadingDistance: 4, fov: 72, sensitivity: .0022, masterVolume: .55, musicVolume: .25, soundVolume: .8,
  graphics: 'balanced', viewBobbing: true, invertMouse: false, shadows: true, debug: false, dayLength: 600,
  bindings: { forward: 'KeyW', backward: 'KeyS', left: 'KeyA', right: 'KeyD', jump: 'Space', sprint: 'ShiftLeft', crouch: 'ControlLeft', inventory: 'KeyE', eat: 'KeyF', drop: 'KeyQ' },
};
export interface PlayerSave { position: [number, number, number]; yaw: number; pitch: number; health: number; hunger: number; inventory: Array<ItemStack | null>; selected: number; }
export interface WorldSave {
  id: string; name: string; seed: string; lastPlayed: number; time: number; player: PlayerSave; changes: BlockChange[];
  containers?: Array<[string, Array<ItemStack | null>]>; entities?: EntitySave; spawn?: [number, number, number];
}
const INDEX_KEY = 'browser-mine-world-index';
const SETTINGS_KEY = 'browser-mine-settings';
const WORLD_BOUND = 30_000_000;
const MAX_CHANGES = 1_000_000;
const MAX_CONTAINERS = 4096;
const MAX_WORLDS = 1000;
type WorldMetadata = Pick<WorldSave, 'id' | 'name' | 'seed' | 'lastPlayed'>;

function isRecord(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function field(value: Record<string, unknown>, key: string): unknown { return Object.prototype.hasOwnProperty.call(value, key) ? value[key] : undefined; }
function boundedNumber(value: unknown, min: number, max: number, fallback: number, integer = false): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, integer ? Math.floor(value) : value));
}
function validId(id: unknown): id is string { return typeof id === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(id); }
function validBinding(code: unknown): code is string {
  return typeof code === 'string' && !['Escape', 'Tab', 'Enter', 'F3', 'F5'].includes(code) && !/^(Digit|Numpad)[1-9]$/.test(code)
    && /^(Key[A-Z]|Digit[0-9]|Numpad([0-9]|Add|Subtract|Multiply|Divide|Decimal|Enter|Equal|Comma)|F([1-9]|1[0-9]|2[0-4])|(Shift|Control|Alt|Meta)(Left|Right)|Arrow(Up|Down|Left|Right)|Space|Backspace|Delete|Insert|Home|End|PageUp|PageDown|CapsLock|NumLock|ScrollLock|Pause|PrintScreen|Backquote|Minus|Equal|BracketLeft|BracketRight|Backslash|IntlBackslash|IntlRo|IntlYen|Semicolon|Quote|Comma|Period|Slash|ContextMenu)$/.test(code);
}

function sanitizeSettings(value: unknown): SettingsData {
  const input = isRecord(value) ? value : {};
  const number = (key: keyof SettingsData, min: number, max: number, integer = false) => boundedNumber(field(input, key), min, max, DEFAULT_SETTINGS[key] as number, integer);
  const boolean = (key: keyof SettingsData) => typeof field(input, key) === 'boolean' ? field(input, key) as boolean : DEFAULT_SETTINGS[key] as boolean;
  const source = field(input, 'bindings');
  let bindings = { ...DEFAULT_SETTINGS.bindings };
  if (isRecord(source)) for (const action of Object.keys(bindings)) {
    const code = field(source, action);
    if (validBinding(code)) bindings[action] = code;
  }
  if (new Set(Object.values(bindings)).size !== Object.keys(bindings).length) bindings = { ...DEFAULT_SETTINGS.bindings };
  const graphics = field(input, 'graphics');
  return {
    renderDistance: number('renderDistance', 2, 6, true), loadingDistance: number('loadingDistance', 2, 8, true),
    fov: number('fov', 50, 100), sensitivity: number('sensitivity', .0005, .006),
    masterVolume: number('masterVolume', 0, 1), musicVolume: number('musicVolume', 0, 1), soundVolume: number('soundVolume', 0, 1),
    dayLength: number('dayLength', 120, 1200), graphics: graphics === 'low' || graphics === 'balanced' || graphics === 'high' ? graphics : DEFAULT_SETTINGS.graphics,
    viewBobbing: boolean('viewBobbing'), invertMouse: boolean('invertMouse'), shadows: boolean('shadows'), debug: boolean('debug'), bindings,
  };
}

function metadata(value: unknown): WorldMetadata | undefined {
  if (!isRecord(value)) return undefined;
  const id = field(value, 'id'), name = field(value, 'name'), seed = field(value, 'seed');
  if (!validId(id) || typeof name !== 'string' || !name.trim() || name.length > 128 || typeof seed !== 'string' || seed.length > 256) return undefined;
  return { id, name, seed, lastPlayed: boundedNumber(field(value, 'lastPlayed'), 0, 8.64e15, 0, true) };
}
function position(value: unknown): [number, number, number] | undefined {
  if (!Array.isArray(value) || value.length !== 3 || !value.every((coordinate) => typeof coordinate === 'number' && Number.isFinite(coordinate) && Math.abs(coordinate) <= WORLD_BOUND)) return undefined;
  if (value[1] < -64 || value[1] > WORLD_HEIGHT + 256) return undefined;
  return [value[0], value[1], value[2]];
}
function blockPosition(x: unknown, y: unknown, z: unknown): boolean {
  return typeof x === 'number' && Number.isSafeInteger(x) && Math.abs(x) <= WORLD_BOUND
    && typeof z === 'number' && Number.isSafeInteger(z) && Math.abs(z) <= WORLD_BOUND
    && typeof y === 'number' && Number.isInteger(y) && y >= 1 && y < WORLD_HEIGHT;
}
function stacks(value: unknown, size: number): Array<ItemStack | null> {
  return Array.from({ length: size }, (_, index) => sanitizeItemStack(Array.isArray(value) ? value[index] : null));
}

function sanitizeEntities(value: unknown): EntitySave | undefined {
  if (!isRecord(value)) return undefined;
  const entities: EntitySave = { drops: [], creatures: [] };
  const drops = field(value, 'drops'), creatures = field(value, 'creatures');
  if (Array.isArray(drops)) for (const entry of drops.slice(0, 128)) {
    if (!isRecord(entry)) continue;
    const stack = sanitizeItemStack(entry), p = position(field(entry, 'position')), life = field(entry, 'life');
    if (!stack || !p || typeof life !== 'number' || !Number.isFinite(life) || life <= 0) continue;
    entities.drops.push({ ...stack, position: p, life: Math.min(life, 300) });
  }
  if (Array.isArray(creatures)) for (const entry of creatures.slice(0, 14)) {
    if (!isRecord(entry)) continue;
    const kind = field(entry, 'kind'), p = position(field(entry, 'position')), health = field(entry, 'health');
    if (typeof kind !== 'string' || !Object.prototype.hasOwnProperty.call(CREATURES, kind) || !p || typeof health !== 'number' || !Number.isFinite(health) || health <= 0) continue;
    const creatureKind = kind as keyof typeof CREATURES;
    entities.creatures.push({ kind: creatureKind, position: p, health: Math.min(health, CREATURES[creatureKind].health) });
  }
  return entities;
}

function sanitizeWorld(value: unknown): WorldSave {
  const info = metadata(value);
  if (!info || !isRecord(value)) throw new Error('The saved world contains invalid identity data.');
  const player = field(value, 'player'), changes = field(value, 'changes');
  if (!isRecord(player) || !Array.isArray(changes) || !Array.isArray(field(player, 'inventory'))) throw new Error('The saved world contains invalid player or block data.');
  const p = position(field(player, 'position'));
  if (!p) throw new Error('The saved world contains an invalid player position.');
  if (changes.length > MAX_CHANGES) throw new Error('The world exceeds the supported block-change limit.');
  const edits = new Map<string, BlockChange>();
  for (const change of changes) {
    if (!isRecord(change)) continue;
    const x = field(change, 'x'), y = field(change, 'y'), z = field(change, 'z'), id = field(change, 'id');
    if (!blockPosition(x, y, z) || typeof id !== 'number' || !Number.isInteger(id) || !Object.prototype.hasOwnProperty.call(BLOCKS, id)) continue;
    edits.set(`${x},${y},${z}`, { x: x as number, y: y as number, z: z as number, id: id as BlockIdValue });
  }
  const containerData = field(value, 'containers');
  if (Array.isArray(containerData) && containerData.length > MAX_CONTAINERS) throw new Error('The world exceeds the supported container limit.');
  const containers = new Map<string, Array<ItemStack | null>>();
  if (Array.isArray(containerData)) for (const entry of containerData) {
    if (!Array.isArray(entry) || entry.length !== 2 || typeof entry[0] !== 'string' || entry[0].length > 64 || !Array.isArray(entry[1]) || !/^-?\d+,-?\d+,-?\d+$/.test(entry[0])) continue;
    const [x, y, z] = entry[0].split(',').map(Number);
    if (!blockPosition(x, y, z)) continue;
    const key = `${x},${y},${z}`;
    // A deleted/replaced cache must not retain an inaccessible inventory.
    const edit = edits.get(key);
    if (edit && edit.id !== 20) continue;
    containers.set(key, stacks(entry[1], 27));
  }
  const yaw = field(player, 'yaw');
  return {
    ...info, time: boundedNumber(field(value, 'time'), 0, 1200, 160),
    player: {
      position: p, yaw: typeof yaw === 'number' && Number.isFinite(yaw) ? yaw % (Math.PI * 2) : 0,
      pitch: boundedNumber(field(player, 'pitch'), -Math.PI / 2 + .015, Math.PI / 2 - .015, 0),
      health: boundedNumber(field(player, 'health'), 0, 100, 100), hunger: boundedNumber(field(player, 'hunger'), 0, 100, 100),
      inventory: stacks(field(player, 'inventory'), 45), selected: boundedNumber(field(player, 'selected'), 0, 8, 0, true),
    },
    changes: [...edits.values()], containers: Array.isArray(containerData) ? [...containers] : undefined,
    entities: sanitizeEntities(field(value, 'entities')), spawn: position(field(value, 'spawn')),
  };
}

function indexEntry(info: WorldMetadata): WorldSave {
  return { ...info, time: 0, changes: [], player: { position: [0, 64, 0], yaw: 0, pitch: 0, health: 100, hunger: 100, inventory: [], selected: 0 } };
}

export class SaveManager {
  private database?: IDBDatabase;
  private readonly ready: Promise<void>;
  private pending: Promise<void> = Promise.resolve();
  readonly settings: SettingsData;
  fallback = false;

  constructor() {
    let settings: unknown;
    try { settings = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}'); } catch { /* Defaults recover invalid or unavailable settings. */ }
    this.settings = sanitizeSettings(settings);
    this.ready = new Promise((resolve) => {
      let settled = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const fallback = () => { if (settled) return; settled = true; clearTimeout(timer); this.fallback = true; resolve(); };
      try {
        if (!window.indexedDB) { fallback(); return; }
        const request = window.indexedDB.open('browser-mine-save', 1);
        timer = setTimeout(fallback, 5000);
        request.onupgradeneeded = () => {
          try {
            if (settled) { request.transaction?.abort(); return; }
            if (!request.result.objectStoreNames.contains('worlds')) request.result.createObjectStore('worlds', { keyPath: 'id' });
          } catch { fallback(); try { request.transaction?.abort(); } catch { /* Already aborted. */ } }
        };
        request.onsuccess = () => {
          const database = request.result;
          if (settled) { database.close(); return; }
          if (!database.objectStoreNames.contains('worlds')) { database.close(); fallback(); return; }
          settled = true; clearTimeout(timer); this.database = database;
          const close = () => { if (this.database === database) { this.database = undefined; this.fallback = true; } };
          database.onversionchange = () => { database.close(); close(); };
          database.onclose = close;
          resolve();
        };
        request.onerror = fallback;
        request.onblocked = fallback;
      } catch { fallback(); }
    });
  }

  saveSettings(): void {
    const settings = sanitizeSettings(this.settings);
    for (const key of Object.keys(settings) as Array<keyof SettingsData>) (this.settings as unknown as Record<string, unknown>)[key] = settings[key];
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }
  listWorlds(): WorldSave[] {
    try {
      const index: unknown = JSON.parse(localStorage.getItem(INDEX_KEY) ?? '[]');
      if (!Array.isArray(index)) return [];
      const worlds = new Map<string, WorldMetadata>();
      for (const entry of index.slice(0, MAX_WORLDS)) {
        const info = metadata(entry);
        if (info && (!worlds.has(info.id) || worlds.get(info.id)!.lastPlayed < info.lastPlayed)) worlds.set(info.id, info);
      }
      return [...worlds.values()].sort((a, b) => b.lastPlayed - a.lastPlayed).map(indexEntry);
    } catch { return []; }
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.pending.then(operation);
    this.pending = result.then(() => undefined, () => undefined);
    return result;
  }

  private transaction<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>, message: string): Promise<T> {
    return new Promise((resolve, reject) => {
      let transaction: IDBTransaction | undefined;
      let result: T;
      const fail = (cause: unknown) => reject(new Error(message, { cause }));
      try {
        if (!this.database) throw new Error('The save database is closed.');
        transaction = mode === 'readwrite' ? this.database.transaction('worlds', mode, { durability: 'strict' }) : this.database.transaction('worlds', mode);
        transaction.oncomplete = () => resolve(result);
        transaction.onerror = () => fail(transaction?.error);
        transaction.onabort = () => fail(transaction?.error);
        const request = operation(transaction.objectStore('worlds'));
        request.onsuccess = () => { result = request.result; };
        request.onerror = () => fail(request.error);
      } catch (error) {
        try { transaction?.abort(); } catch { /* Already inactive. */ }
        fail(error);
      }
    });
  }

  async save(world: WorldSave): Promise<void> {
    world.lastPlayed = Date.now();
    // Detach containers and entities before waiting for storage: gameplay may still mutate them.
    const snapshot = sanitizeWorld(world);
    await this.ready;
    await this.enqueue(async () => {
      const index = this.listWorlds().filter((entry) => entry.id !== snapshot.id);
      if (index.length >= MAX_WORLDS) throw new Error('The saved-world limit has been reached.');
      index.push(indexEntry(snapshot));
      if (this.database) await this.transaction('readwrite', (store) => store.put(snapshot), 'World save failed. Storage may be full or unavailable.');
      else {
        try { localStorage.setItem(`browser-mine-world-${snapshot.id}`, JSON.stringify(snapshot)); }
        catch (error) { throw new Error('World save failed. Browser storage may be full or unavailable.', { cause: error }); }
      }
      try { localStorage.setItem(INDEX_KEY, JSON.stringify(index.map((entry) => metadata(entry)))); }
      catch (error) { throw new Error('World data was saved, but its world-list entry could not be saved.', { cause: error }); }
    });
  }

  async load(id: string): Promise<WorldSave | undefined> {
    if (!validId(id)) throw new Error('Invalid saved-world ID.');
    await this.ready;
    return this.enqueue(async () => {
      let world: WorldSave | undefined;
      let failure: unknown;
      const validate = (data: unknown) => {
        const saved = sanitizeWorld(data);
        if (saved.id !== id) throw new Error('The saved-world ID does not match its storage entry.');
        return saved;
      };
      if (this.database) {
        const data: unknown = await this.transaction('readonly', (store) => store.get(id), 'Saved world could not be read.');
        if (data !== undefined) { try { world = validate(data); } catch (error) { failure = error; } }
      }
      // An earlier session may have used fallback storage, even if IndexedDB now works.
      try {
        const serialized = localStorage.getItem(`browser-mine-world-${id}`);
        if (serialized !== null) {
          const saved = validate(JSON.parse(serialized));
          if (!world || saved.lastPlayed > world.lastPlayed) world = saved;
        }
      } catch (error) { failure ??= new Error('The saved world is corrupted or browser storage cannot be read.', { cause: error }); }
      if (!world && failure) throw failure;
      return world;
    });
  }

  async delete(id: string): Promise<void> {
    if (!validId(id)) throw new Error('Invalid saved-world ID.');
    await this.ready;
    await this.enqueue(async () => {
      if (this.database) await this.transaction('readwrite', (store) => store.delete(id), 'Unable to delete world.');
      try {
        localStorage.removeItem(`browser-mine-world-${id}`);
        localStorage.setItem(INDEX_KEY, JSON.stringify(this.listWorlds().filter((world) => world.id !== id).map((world) => metadata(world))));
      } catch (error) { throw new Error('Unable to remove the world from browser storage or the world list.', { cause: error }); }
    });
  }
}
