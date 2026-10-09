import { Inventory } from '../inventory/Inventory.ts';
import { ITEMS, RECIPES } from '../inventory/items.ts';
import type { ItemStack } from '../inventory/items.ts';
import { SaveManager, type SettingsData, type WorldSave } from '../persistence/SaveManager.ts';

export interface UIActions { create(name: string, seed: string): void; load(id: string): void; resume(): void; save(): void; quit(): void; respawn(): void; }

export class UIManager {
  readonly screen: HTMLDivElement;
  readonly panel: HTMLDivElement;
  readonly hud: HTMLDivElement;
  private toastElement: HTMLDivElement;
  private toastTimer = 0;
  private currentInventory?: Inventory;
  private dragSource = -1;
  private settings: SettingsData;
  private hotbarKey = '';
  private hintKey = '';
  private keyCapture?: (event: KeyboardEvent) => void;

  constructor(private readonly root: HTMLElement, private readonly saves: SaveManager, private readonly actions: UIActions) {
    this.settings = saves.settings;
    this.screen = document.createElement('div'); this.screen.className = 'screen'; root.append(this.screen);
    this.panel = document.createElement('div'); this.panel.className = 'panel hidden'; root.append(this.panel);
    this.hud = document.createElement('div'); this.hud.className = 'hud hidden';
    this.hud.innerHTML = `<div class="crosshair" aria-hidden="true"></div><div class="environment"></div><div class="hint"></div><div class="status"><div class="bar health" role="meter" aria-label="Health" aria-valuemin="0" aria-valuemax="100"><i></i><label>HEALTH</label></div><div class="bar hunger" role="meter" aria-label="Hunger" aria-valuemin="0" aria-valuemax="100"><i></i><label>HUNGER</label></div></div><div class="selected-name"></div><div class="hotbar" aria-label="Hotbar · select with 1–9 or mouse wheel"></div><div class="hotbar-help">1–9 SELECT <span>·</span> WHEEL CYCLE</div><div class="mining"><i></i></div><div class="debug"></div>`;
    root.append(this.hud);
    this.toastElement = document.createElement('div'); this.toastElement.className = 'toast'; this.toastElement.setAttribute('role', 'status'); this.toastElement.setAttribute('aria-live', 'polite'); this.toastElement.style.display = 'none'; root.append(this.toastElement);
    // Text fields and settings must not feed gameplay key presses while a panel is open.
    root.addEventListener('keydown', (event) => {
      const inMenu = !this.screen.classList.contains('hidden') || this.isPanelOpen();
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement || event.code === 'Tab' && inMenu || event.target instanceof HTMLButtonElement && ['Space', 'Enter'].includes(event.code)) event.stopPropagation();
    });
    this.mainMenu();
  }

  mainMenu(): void {
    this.closePanel(); this.hud.classList.add('hidden'); this.screen.classList.remove('hidden');
    this.screen.innerHTML = `<div class="menu-card landing-card"><div class="landing-copy"><div class="brand-kicker"><span class="brand-mark" aria-hidden="true">◇</span> An expedition of your own</div><h1 class="brand">BROWSER<br><span>MINE</span></h1><p class="edition">THE WILD BELOW</p><p class="tagline">Follow the canopy. Brave the caves.<br>Build a place to call your own.</p><div class="menu-actions"><button class="primary" data-action="create">Create New World <span aria-hidden="true">↗</span></button><button class="secondary" data-action="worlds">Load World</button><div class="menu-utility"><button class="secondary" data-action="settings">Settings</button><button class="secondary" data-action="controls">Controls</button></div><button class="guide-button" data-action="guide"><span aria-hidden="true">▤</span> Field Guide <span class="button-note">Your first five minutes →</span></button></div><div class="menu-foot"><span>Original voxel survival</span><span>v1.0 · Local saves</span></div></div><div class="landing-art">${this.landscape()}<div class="art-caption"><span class="eyebrow">Above & below</span><h2>A quiet surface.<br>A wild frontier.</h2><p>Seeded landscapes, hidden veins, and a world shaped by your hands.</p><div class="art-tags"><span>EXPLORE</span><span>CRAFT</span><span>SURVIVE</span></div></div></div></div>`;
    this.bindScreen({ create: () => this.createWorld(), worlds: () => this.worldList(), settings: () => this.settingsPanel(false), controls: () => this.controls(false), guide: () => this.guide(false) });
  }

  createWorld(): void {
    this.screen.innerHTML = `<div class="menu-card"><div class="back-row"><h2 class="subhead">New expedition</h2><button class="small-button" data-action="back">← Back</button></div><p class="tagline compact">Every seed opens a different wilderness.</p><form class="world-form"><label class="field">World name<input id="world-name" value="My Wilderness" maxlength="40" autocomplete="off"></label><label class="field">World seed<input id="world-seed" placeholder="Leave empty for a random seed" maxlength="64" autocomplete="off"><small>The same seed recreates the same terrain.</small></label><div class="starter-kit"><div class="eyebrow">Your starter pack</div><div class="starter-items">${['wooden_pickaxe', 'wood', 'berries', 'torch'].map((id) => `<span>${this.itemIcon(id)}<span>${id === 'wooden_pickaxe' ? 'Wooden pick' : `8 ${ITEMS[id].name}`}</span></span>`).join('')}</div></div><p class="onboarding-note"><b>First goal:</b> use your wooden pick to mine Slate. Craft a Slate Pick with <b>3 Slate + 2 Redwood</b>, then mine iron.</p><button type="submit" class="primary full-width">Create & explore</button></form><button class="guide-button full-width" data-action="guide">Read the survival field guide →</button><div class="menu-foot"><span>Keyboard + mouse</span><span>Saved in this browser</span></div></div>`;
    this.bindScreen({ back: () => this.mainMenu(), guide: () => {
      const name = this.screen.querySelector<HTMLInputElement>('#world-name')?.value ?? '';
      const seed = this.screen.querySelector<HTMLInputElement>('#world-seed')?.value ?? '';
      this.guide(false, () => { this.createWorld(); const nameInput = this.screen.querySelector<HTMLInputElement>('#world-name'), seedInput = this.screen.querySelector<HTMLInputElement>('#world-seed'); if (nameInput) nameInput.value = name; if (seedInput) seedInput.value = seed; });
    } });
    const form = this.screen.querySelector<HTMLFormElement>('form');
    if (form) form.onsubmit = (event) => {
      event.preventDefault();
      const name = this.screen.querySelector<HTMLInputElement>('#world-name')?.value.trim() || 'My Wilderness';
      const seed = this.screen.querySelector<HTMLInputElement>('#world-seed')?.value.trim() || Math.random().toString(36).slice(2, 10);
      const button = form.querySelector<HTMLButtonElement>('[type="submit"]'); if (button) button.disabled = true;
      this.actions.create(name, seed);
    };
  }

  worldList(): void {
    const worlds = this.saves.listWorlds();
    this.screen.innerHTML = `<div class="menu-card"><div class="back-row"><h2 class="subhead">Your worlds</h2><button class="small-button" data-action="back">← Back</button></div><p class="world-meta">Local expeditions · ${worlds.length} saved ${worlds.length === 1 ? 'world' : 'worlds'}</p><div class="world-list">${worlds.length ? worlds.map((world) => `<div class="world-row"><div><div class="world-name">${this.escape(world.name)}</div><div class="world-meta">Seed ${this.escape(world.seed)}<br>Last played ${new Date(world.lastPlayed).toLocaleDateString()}</div></div><div class="world-buttons"><button class="primary" data-play="${this.escape(world.id)}">Play</button><button class="danger" data-delete="${this.escape(world.id)}" title="Delete ${this.escape(world.name)}" aria-label="Delete ${this.escape(world.name)}">×</button></div></div>`).join('') : '<div class="empty"><span class="empty-mark" aria-hidden="true">◇</span><b>Your story starts here.</b><p>No expeditions yet. Create your first world.</p></div>'}</div><button class="primary full-width" data-action="create">Create New World</button><p class="storage-note">Worlds belong to this browser profile and address. Clearing site data removes them.</p></div>`;
    this.bindScreen({ back: () => this.mainMenu(), create: () => this.createWorld() });
    this.screen.querySelectorAll<HTMLButtonElement>('[data-play]').forEach((button) => button.onclick = () => this.actions.load(button.dataset.play ?? ''));
    this.screen.querySelectorAll<HTMLButtonElement>('[data-delete]').forEach((button) => button.onclick = () => {
      if (!confirm('Delete this world permanently?')) return;
      button.disabled = true;
      void this.saves.delete(button.dataset.delete ?? '').then(() => this.worldList()).catch(() => { button.disabled = false; this.toast('Could not delete the world. Check browser storage and try again.'); });
    });
  }

  loading(): void {
    this.closePanel(); this.hud.classList.add('hidden'); this.screen.classList.remove('hidden');
    this.screen.innerHTML = `<div class="menu-card loading-card"><div class="brand-kicker">Preparing your wilderness</div><h2 class="subhead">Growing a new world…</h2><p class="tagline compact">Carving valleys · planting canopies · uncovering veins</p><div class="bar loading-bar" role="progressbar" aria-label="Generating nearby terrain" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i id="load-progress" style="width:0%"></i></div><p id="load-detail" class="world-meta">Starting terrain workers</p><div class="loading-tip"><span class="eyebrow">A note for the trail</span><p>Your wooden pick can collect Slate. An iron vein needs a Slate Pick or better to drop iron.</p></div></div>`;
  }
  loadingProgress(count: number, total: number): void {
    const progress = total > 0 ? Math.max(0, Math.min(100, count / total * 100)) : 0;
    const bar = this.screen.querySelector<HTMLElement>('#load-progress'); if (bar) { bar.style.width = `${progress}%`; bar.parentElement?.setAttribute('aria-valuenow', String(Math.round(progress))); }
    const detail = this.screen.querySelector('#load-detail'); if (detail) detail.textContent = `${Math.min(count, total)} / ${total} nearby chunks generated`;
  }
  showGame(): void { this.cancelKeyCapture(); this.dragSource = -1; this.hotbarKey = ''; this.screen.classList.add('hidden'); this.panel.classList.add('hidden'); this.hud.classList.remove('hidden'); }
  isPanelOpen(): boolean { return !this.panel.classList.contains('hidden'); }

  pause(): void {
    this.setPanel(`<div class="brand-kicker">Take a breath</div><div class="back-row"><h2>Expedition paused</h2></div><div class="menu-actions"><button class="primary" data-action="resume">Resume</button><button class="secondary" data-action="save">Save World</button><div class="menu-utility"><button class="secondary" data-action="settings">Settings</button><button class="secondary" data-action="controls">Controls</button></div><button class="secondary" data-action="guide">Field Guide</button><button class="danger" data-action="quit">Save & Quit</button></div><p class="storage-note">Save regularly. Worlds are stored locally in this browser.</p>`);
    this.bindPanel({ resume: () => { this.closePanel(); this.actions.resume(); }, save: () => this.actions.save(), settings: () => this.settingsPanel(true), controls: () => this.controls(true), guide: () => this.guide(true), quit: () => this.actions.quit() });
  }

  death(): void {
    this.setPanel(`<div class="brand-kicker danger-text">The wilderness endures</div><h2 class="death-title">Your expedition ended.</h2><p class="tagline compact">Your pack fell where you did. Return to the surface, gather supplies, and find your way back.</p><button class="primary full-width" data-action="respawn">Respawn</button>`);
    this.bindPanel({ respawn: () => { this.closePanel(); this.actions.respawn(); } });
  }

  inventory(inventory: Inventory): void {
    this.currentInventory = inventory; this.dragSource = -1;
    this.setPanel(`<div class="back-row"><div><div class="eyebrow">Make something of the wilderness</div><h2>Field pack</h2></div><div class="panel-tools"><button class="small-button" data-action="guide">Field Guide</button><button class="small-button" data-action="close">Close · ${this.keyLabel('inventory')}</button></div></div><div class="inventory-layout"><div><div class="section-label">Hotbar · first row · select with 1–9</div><div class="inventory-grid"></div><div class="pack-tools"><span class="move-status" role="status">Click a stack, then a slot to move it.</span><button class="small-button" data-action="cancel-move">Cancel move</button></div><p class="inventory-help">Drag to move · right-click to split in half<br><kbd>SHIFT</kbd> + click moves between hotbar and backpack.</p><div class="progression-note"><span class="eyebrow">The way deeper</span><p><b>Wooden pick → Slate Pick → Iron Pick</b><br>Mine 3 Slate with your starter pick. Keep 2 Redwood for the handle. A Slate Pick collects iron; an Iron Pick collects Lumenite.</p><button class="guide-button" data-action="guide">Survival, food & storage tips →</button></div><p class="inventory-help">In the world: <kbd>${this.keyLabel('drop')}</kbd> drops one selected item · <kbd>${this.keyLabel('eat')}</kbd> eats selected food.</p></div><div><div class="section-label recipe-heading">Crafting <span class="recipe-summary"></span></div><p class="recipe-help">Owned / needed · click a recipe to craft</p><div class="recipes"></div></div></div>`, true);
    this.bindPanel({ close: () => { this.closePanel(); this.actions.resume(); }, guide: () => this.guide(true, () => this.inventory(inventory)), 'cancel-move': () => { this.dragSource = -1; this.renderInventory(); } });
    this.renderInventory();
  }

  container(inventory: Inventory, storage: Array<ItemStack | null>): void {
    this.currentInventory = undefined; this.dragSource = -1;
    const render = () => {
      this.setPanel(`<div class="back-row"><div><div class="eyebrow">A place for your provisions</div><h2>Trail cache</h2></div><button class="small-button" data-action="close">Close · ${this.keyLabel('inventory')}</button></div><p class="inventory-help">Click or <kbd>SHIFT</kbd> + click to transfer a whole stack. Right-click to transfer half.<br>In the world, right-click a chest to open it; hold <kbd>${this.keyLabel('crouch')}</kbd> to place against it.</p><div class="section-label">Cache · ${storage.filter(Boolean).length} / ${storage.length} slots used</div><div class="inventory-grid cache-grid">${storage.map((stack, index) => this.slotHTML(stack, index, false, 'cache')).join('')}</div><div class="section-label">Your pack · click a stack to store it</div><div class="inventory-grid pack-grid">${inventory.slots.map((stack, index) => this.slotHTML(stack, index, index === inventory.selected)).join('')}</div>`, true);
      this.bindPanel({ close: () => { this.closePanel(); this.actions.resume(); } });
      const transfer = (fromCache: boolean, index: number, half: boolean) => {
        const source = fromCache ? storage : inventory.slots;
        const stack = source[index]; if (!stack) return;
        const amount = half ? Math.max(1, Math.floor(stack.count / 2)) : stack.count;
        const remaining = fromCache ? inventory.add(stack.id, amount, stack.durability) : this.addToSlots(storage, stack, amount);
        const moved = amount - remaining;
        stack.count -= moved; if (stack.count <= 0) source[index] = null;
        inventory.onChange?.();
        if (remaining) this.toast(moved ? 'Only part of the stack fits.' : fromCache ? 'Your pack is full.' : 'This cache is full.');
        render();
      };
      for (const [selector, fromCache] of [['.cache-grid .slot', true], ['.pack-grid .slot', false]] as const) {
        this.panel.querySelectorAll<HTMLButtonElement>(selector).forEach((slot) => {
          slot.onclick = () => transfer(fromCache, Number(slot.dataset.slot), false);
          slot.oncontextmenu = (event) => { event.preventDefault(); transfer(fromCache, Number(slot.dataset.slot), true); };
        });
      }
    };
    render();
  }

  private addToSlots(slots: Array<ItemStack | null>, stack: ItemStack, count: number): number {
    const max = ITEMS[stack.id]?.maxStack ?? 64;
    for (const target of slots) {
      if (!count) break;
      if (target?.id === stack.id && target.durability === undefined && stack.durability === undefined) {
        const amount = Math.max(0, Math.min(count, max - target.count)); target.count += amount; count -= amount;
      }
    }
    for (let index = 0; index < slots.length && count; index += 1) if (!slots[index]) { const amount = Math.min(count, max); slots[index] = { ...stack, count: amount }; count -= amount; }
    return count;
  }

  private quickMove(inventory: Inventory, index: number): void {
    const stack = inventory.slots[index]; if (!stack) return;
    const start = index < 9 ? 9 : 0, end = index < 9 ? inventory.slots.length : 9;
    const targetSlots = inventory.slots.slice(start, end);
    const remaining = this.addToSlots(targetSlots, stack, stack.count);
    targetSlots.forEach((target, offset) => { inventory.slots[start + offset] = target; });
    if (remaining === stack.count) this.toast(index < 9 ? 'No room in your backpack.' : 'No room in your hotbar.');
    stack.count = remaining; if (!remaining) inventory.slots[index] = null;
    inventory.onChange?.();
  }

  private renderInventory(): void {
    const inventory = this.currentInventory; if (!inventory) return;
    const grid = this.panel.querySelector('.inventory-grid'); if (!grid) return;
    const focused = document.activeElement instanceof HTMLButtonElement && this.panel.contains(document.activeElement) ? document.activeElement : undefined;
    const focusedSlot = focused?.dataset.slot, focusedRecipe = focused?.dataset.recipe;
    grid.innerHTML = inventory.slots.map((stack, index) => this.slotHTML(stack, index, index === inventory.selected)).join('');
    grid.querySelectorAll<HTMLButtonElement>('.slot').forEach((slot) => {
      const index = Number(slot.dataset.slot); slot.draggable = Boolean(inventory.slots[index]);
      slot.classList.toggle('drag-source', this.dragSource === index);
      slot.ondragstart = (event) => { this.dragSource = index; slot.classList.add('drag-source'); event.dataTransfer?.setData('text/plain', String(index)); if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'; };
      slot.ondragover = (event) => { event.preventDefault(); if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'; };
      slot.ondrop = (event) => { event.preventDefault(); if (this.dragSource >= 0) inventory.swapOrMerge(this.dragSource, index); this.dragSource = -1; this.renderInventory(); };
      slot.ondragend = () => { this.dragSource = -1; this.renderInventory(); };
      slot.onclick = (event) => {
        if (event.shiftKey) { this.dragSource = -1; this.quickMove(inventory, index); }
        else if (this.dragSource < 0) { if (inventory.slots[index]) this.dragSource = index; }
        else { inventory.swapOrMerge(this.dragSource, index); this.dragSource = -1; }
        this.renderInventory();
      };
      slot.oncontextmenu = (event) => {
        event.preventDefault(); this.dragSource = -1;
        const stack = inventory.slots[index];
        if (stack && stack.count >= 2) {
          const empty = inventory.slots.findIndex((item) => !item);
          if (empty >= 0) { const count = Math.floor(stack.count / 2); stack.count -= count; inventory.slots[empty] = { ...stack, count }; inventory.onChange?.(); }
          else this.toast('Free a slot to split this stack.');
        }
        this.renderInventory();
      };
    });
    const status = this.panel.querySelector('.move-status');
    if (status) status.textContent = this.dragSource >= 0 ? `${ITEMS[inventory.slots[this.dragSource]?.id ?? '']?.name ?? 'Stack'} selected. Choose a destination.` : 'Click a stack, then a slot to move it.';
    const cancel = this.panel.querySelector<HTMLButtonElement>('[data-action="cancel-move"]'); if (cancel) cancel.disabled = this.dragSource < 0;
    const recipes = this.panel.querySelector('.recipes');
    if (recipes) {
      recipes.innerHTML = RECIPES.map((recipe) => {
        const ready = recipe.ingredients.every((item) => inventory.count(item.id) >= item.count);
        const missing = recipe.ingredients.filter((item) => inventory.count(item.id) < item.count).map((item) => `${item.count - inventory.count(item.id)} ${ITEMS[item.id].name}`);
        const description = `${recipe.name}. ${this.itemDescription(recipe.output.id)} ${ready ? 'Materials ready. Click to craft; a free output slot may be needed.' : `Still need ${missing.join(', ')}.`}`;
        return `<button class="recipe ${ready ? 'ready' : 'unavailable'}" data-recipe="${recipe.id}" aria-disabled="${!ready}" title="${this.escape(description)}">${this.itemIcon(recipe.output.id)}<span class="recipe-copy"><span class="recipe-name">${this.escape(recipe.name)}</span><span class="recipe-ingredients">${recipe.ingredients.map((item) => `<span class="ingredient ${inventory.count(item.id) >= item.count ? 'enough' : 'missing'}">${ITEMS[item.id].name} <b>${inventory.count(item.id)} / ${item.count}</b></span>`).join('')}</span></span><span class="recipe-state">${ready ? 'CRAFT +' : 'NEED'}</span></button>`;
      }).join('');
      recipes.querySelectorAll<HTMLButtonElement>('[data-recipe]').forEach((button) => button.onclick = () => {
        const recipe = RECIPES.find((item) => item.id === button.dataset.recipe); if (!recipe) return;
        const missing = recipe.ingredients.filter((item) => inventory.count(item.id) < item.count);
        if (missing.length) { this.toast(`Need ${missing.map((item) => `${item.count - inventory.count(item.id)} more ${ITEMS[item.id].name}`).join(' + ')}.`); return; }
        this.dragSource = -1;
        if (inventory.craft(recipe)) this.toast(`Crafted ${recipe.name}`); else this.toast('Make room in your pack for the crafted item.');
        this.renderInventory();
      });
    }
    const summary = this.panel.querySelector('.recipe-summary'); if (summary) summary.textContent = `${RECIPES.filter((recipe) => recipe.ingredients.every((item) => inventory.count(item.id) >= item.count)).length} ready`;
    if (focusedSlot !== undefined) grid.querySelector<HTMLButtonElement>(`[data-slot="${focusedSlot}"]`)?.focus({ preventScroll: true });
    else if (focusedRecipe !== undefined) recipes?.querySelector<HTMLButtonElement>(`[data-recipe="${focusedRecipe}"]`)?.focus({ preventScroll: true });
  }

  guide(inGame: boolean, onBack?: () => void): void {
    const html = `<div class="back-row"><div><div class="brand-kicker">A few notes for the trail</div><h2 class="subhead">Survival field guide</h2></div><button class="small-button" data-action="back">← Back</button></div><p class="tagline compact">Start small. Keep food close. Bring a better pick.</p><ol class="guide-steps"><li><span class="guide-number">01</span><div><h3>Find your footing</h3><p>Click the world to capture your mouse. Move with your bound keys, jump with <kbd>${this.keyLabel('jump')}</kbd>, and hold <kbd>${this.keyLabel('sprint')}</kbd> to sprint. Sprinting uses more food. <kbd>ESC</kbd> releases the mouse and pauses.</p></div></li><li><span class="guide-number">02</span><div><h3>Wooden pick → Slate Pick</h3><p>You begin with a <b>Redwood Pick (wooden pick)</b>, 8 Redwood, 8 Sun Berries, and 8 Glowreed. Select slot <kbd>1</kbd> and hold left mouse on exposed <b>Slate</b>. Walk near dropped items to collect them. Open <kbd>${this.keyLabel('inventory')}</kbd> and craft a <b>Slate Pick: 3 Slate + 2 Redwood</b>. Move it into the hotbar to equip it.</p></div></li><li><span class="guide-number">03</span><div><h3>Slate Pick → Iron Pick</h3><p>Mine iron veins with a <b>Slate Pick or better</b>; a wooden pick breaks the block without dropping iron. Craft an <b>Iron Pick: 3 Iron + 2 Redwood</b>. An Iron Pick can collect Lumenite. Tools wear down, so keep spare wood and materials.</p></div></li><li><span class="guide-number">04</span><div><h3>Food, light & a place to return</h3><p>Select berries, a Duskcap, or a Trail Loaf and press <kbd>${this.keyLabel('eat')}</kbd> when hungry. Gather berries from Sunberry Bushes and Sunbells, or craft a loaf from <b>3 berries</b>. High hunger helps health recover. Right-click to place blocks or Glowreed; craft more light from <b>1 Coal + 1 Redwood → 4 Glowreed</b>. Shelter gives you space from hostile creatures.</p></div></li><li><span class="guide-number">05</span><div><h3>Store your supplies</h3><p>Turn <b>1 Redwood into 4 Cut Redwood</b>; <b>8 Cut Redwood</b> crafts a Trail Cache (chest). Place it, then <b>right-click the chest to open it</b>. Click or <kbd>SHIFT</kbd> + click a stack to transfer it; right-click transfers half. Hold your crouch key <kbd>${this.keyLabel('crouch')}</kbd> while right-clicking to place a block against a chest instead of opening it.</p></div></li></ol><div class="guide-shortcuts"><span><kbd>1–9 / WHEEL</kbd> select hotbar</span><span><kbd>${this.keyLabel('drop')}</kbd> drop one selected item</span><span><kbd>${this.keyLabel('eat')}</kbd> eat selected food</span><span><kbd>SHIFT + CLICK</kbd> quick-move in your pack</span><span><kbd>RMB</kbd> split pack stacks</span><span><kbd>F5</kbd> save world</span></div><p class="storage-note">Death drops your pack. Saves are local to this browser profile and address; use Save World or F5 before leaving.</p>`;
    if (inGame) { this.setPanel(html, true); this.bindPanel({ back: onBack ?? (() => this.pause()) }); }
    else { this.screen.innerHTML = `<div class="menu-card guide-card">${html}</div>`; this.bindScreen({ back: onBack ?? (() => this.mainMenu()) }); }
  }

  controls(inGame: boolean): void {
    const labels: Record<string, string> = { forward: 'Forward', backward: 'Backward', left: 'Left', right: 'Right', jump: 'Jump / swim', sprint: 'Sprint', crouch: 'Crouch / place against chest', inventory: 'Inventory', eat: 'Eat selected food', drop: 'Drop one selected item' };
    const html = `<div class="back-row"><h2 class="subhead">Controls</h2><button class="small-button" data-action="back">← Back</button></div><p class="world-meta">Click a key to rebind it. Escape cancels. Each action needs a unique key.</p><div class="key-list">${Object.entries(labels).map(([action, label]) => `<span>${label}<button class="key-button" data-binding="${action}" aria-label="Rebind ${label}">${this.keyLabel(action)}</button></span>`).join('')}<span>Look <kbd>MOUSE</kbd></span><span>Mine / attack <kbd>HOLD LMB</kbd></span><span>Place / open chest <kbd>RMB</kbd></span><span>Hotbar <kbd>1–9 / WHEEL</kbd></span><span>Quick-move pack stack <kbd>SHIFT + CLICK</kbd></span><span>Split pack / transfer half <kbd>RMB</kbd></span><span>Pause / release mouse <kbd>ESC</kbd></span><span>Debug <kbd>F3</kbd></span><span>Save <kbd>F5</kbd></span></div><p class="storage-note">Click the world or Resume to capture the mouse. Eat and drop apply to the currently selected hotbar slot.</p><button class="secondary full-width" data-action="guide">Open Survival Field Guide</button>`;
    if (inGame) { this.setPanel(html, true); this.bindPanel({ back: () => this.pause(), guide: () => this.guide(true, () => this.controls(true)) }); }
    else { this.screen.innerHTML = `<div class="menu-card controls-card">${html}</div>`; this.bindScreen({ back: () => this.mainMenu(), guide: () => this.guide(false, () => this.controls(false)) }); }
    const target = inGame ? this.panel : this.screen;
    target.querySelectorAll<HTMLButtonElement>('[data-binding]').forEach((button) => button.onclick = () => {
      this.cancelKeyCapture();
      target.querySelectorAll<HTMLButtonElement>('[data-binding]').forEach((key) => { key.textContent = this.keyLabel(key.dataset.binding ?? ''); key.classList.remove('listening'); });
      button.textContent = 'Press key…'; button.classList.add('listening');
      this.keyCapture = (event) => {
        event.preventDefault(); event.stopImmediatePropagation();
        const action = button.dataset.binding ?? '';
        if (event.code !== 'Escape') {
          if (['F3', 'F5', 'Tab', 'Enter'].includes(event.code) || /^(Digit|Numpad)[1-9]$/.test(event.code)) this.toast('That key is reserved. Choose another key.');
          else if (Object.entries(this.settings.bindings).some(([other, code]) => other !== action && code === event.code)) this.toast('That key is already assigned to another action.');
          else { this.settings.bindings[action] = event.code; this.persistSettings(); }
        }
        this.cancelKeyCapture(); this.controls(inGame);
      };
      window.addEventListener('keydown', this.keyCapture, { capture: true });
    });
  }

  settingsPanel(inGame: boolean): void {
    const html = `<div class="back-row"><h2 class="subhead">Settings</h2><button class="small-button" data-action="back">← Back</button></div><p class="world-meta settings-status" data-settings-status>Changes apply immediately and are saved in this browser.</p><div class="settings-grid">${this.range('renderDistance', 'Render distance', 2, 6, 1)}${this.range('loadingDistance', 'Chunk loading distance', 2, 8, 1)}${this.range('fov', 'Field of view', 50, 100, 1)}${this.range('sensitivity', 'Mouse sensitivity', .0005, .006, .0001)}${this.range('masterVolume', 'Master volume', 0, 1, .05)}${this.range('soundVolume', 'Sound volume', 0, 1, .05)}${this.range('musicVolume', 'Music volume', 0, 1, .05)}${this.range('dayLength', 'Day length (seconds)', 120, 1200, 60)}<label class="toggle-row">Graphics quality<select data-setting="graphics"><option value="low" ${this.settings.graphics === 'low' ? 'selected' : ''}>Low</option><option value="balanced" ${this.settings.graphics === 'balanced' ? 'selected' : ''}>Balanced</option><option value="high" ${this.settings.graphics === 'high' ? 'selected' : ''}>High</option></select></label>${this.toggle('viewBobbing', 'View bobbing')}${this.toggle('invertMouse', 'Invert mouse')}${this.toggle('shadows', 'Shadows')}${this.toggle('debug', 'Debug panel')}<button class="secondary" data-action="fullscreen">Toggle Fullscreen</button></div><p class="storage-note">For slower graphics hardware, try Low, a shorter render distance, and shadows off. Keyboard and mouse are required.</p>`;
    const target = inGame ? this.panel : this.screen;
    if (inGame) this.setPanel(html); else target.innerHTML = `<div class="menu-card">${html}</div>`;
    target.querySelectorAll<HTMLInputElement>('input[data-setting]').forEach((input) => input.oninput = () => {
      const value = input.type === 'checkbox' ? input.checked : Number(input.value);
      if (typeof value === 'number' && !Number.isFinite(value)) return;
      const key = input.dataset.setting as keyof SettingsData;
      (this.settings as unknown as Record<string, number | boolean>)[key] = value;
      if (input.nextElementSibling?.classList.contains('range-value')) input.nextElementSibling.textContent = this.settingLabel(key, value);
      this.persistSettings();
    });
    const quality = target.querySelector<HTMLSelectElement>('select[data-setting="graphics"]');
    if (quality) quality.onchange = () => { if (['low', 'balanced', 'high'].includes(quality.value)) { this.settings.graphics = quality.value as SettingsData['graphics']; this.persistSettings(); } };
    const handlers = { back: () => inGame ? this.pause() : this.mainMenu(), fullscreen: () => { void this.toggleFullscreen(); } };
    inGame ? this.bindPanel(handlers) : this.bindScreen(handlers);
  }

  private persistSettings(): void {
    const status = this.root.querySelector('[data-settings-status]');
    try { this.saves.saveSettings(); if (status) status.textContent = 'Settings saved locally. Changes apply immediately.'; }
    catch { if (status) status.textContent = 'Applied for this session. Browser storage is unavailable.'; this.toast('Settings applied for this session. Allow browser storage to keep them after reload.'); }
  }
  private async toggleFullscreen(): Promise<void> {
    try {
      if (document.fullscreenElement) { if (!document.exitFullscreen) throw new Error('Unsupported'); await document.exitFullscreen(); }
      else { if (!this.root.requestFullscreen) throw new Error('Unsupported'); await this.root.requestFullscreen(); }
    } catch { this.toast('Fullscreen is unavailable. Try your browser’s fullscreen shortcut.'); }
  }
  private settingLabel(key: keyof SettingsData, value: number | boolean): string { return ['masterVolume', 'soundVolume', 'musicVolume'].includes(key) ? `${Math.round(Number(value) * 100)}%` : key === 'sensitivity' ? Number(value).toFixed(4) : String(value); }
  private range(key: keyof SettingsData, label: string, min: number, max: number, step: number): string { return `<label class="range-row"><span>${label}</span><input type="range" data-setting="${key}" min="${min}" max="${max}" step="${step}" value="${this.settings[key]}"><span class="range-value">${this.settingLabel(key, this.settings[key] as number)}</span></label>`; }
  private toggle(key: keyof SettingsData, label: string): string { return `<label class="toggle-row">${label}<input type="checkbox" data-setting="${key}" ${this.settings[key] ? 'checked' : ''}></label>`; }
  private keyLabel(action: string): string { return this.escape((this.settings.bindings[action] ?? action).replace(/^Key/, '').replace(/^Digit/, '').replace(/Left$/, '').replace(/Right$/, ' R').replace('Control', 'Ctrl').toUpperCase()); }

  updateHud(inventory: Inventory, health: number, hunger: number, mining: number, debug: string): void {
    const hotbar = this.hud.querySelector('.hotbar');
    const key = `${inventory.selected}-${inventory.hotbar.map((stack) => `${stack?.id}:${stack?.count}:${stack?.durability}`).join(',')}`;
    if (hotbar && key !== this.hotbarKey) { this.hotbarKey = key; hotbar.innerHTML = inventory.hotbar.map((stack, index) => this.slotHTML(stack, index, index === inventory.selected, 'hotbar')).join(''); }
    const hintKey = `${this.keyLabel('inventory')}:${this.keyLabel('eat')}:${this.keyLabel('drop')}`;
    if (this.hintKey !== hintKey) { this.hintKey = hintKey; const hint = this.hud.querySelector('.hint'); if (hint) hint.innerHTML = `<kbd>${this.keyLabel('inventory')}</kbd> PACK & CRAFT <span>·</span> <kbd>${this.keyLabel('eat')}</kbd> EAT <span>·</span> <kbd>${this.keyLabel('drop')}</kbd> DROP <span>·</span> <kbd>ESC</kbd> PAUSE`; }
    const healthBar = this.hud.querySelector<HTMLElement>('.health i'), hungerBar = this.hud.querySelector<HTMLElement>('.hunger i'), miningBar = this.hud.querySelector<HTMLElement>('.mining i');
    if (healthBar) { healthBar.style.width = `${Math.max(0, Math.min(100, health))}%`; healthBar.parentElement?.setAttribute('aria-valuenow', String(Math.ceil(health))); }
    if (hungerBar) { hungerBar.style.width = `${Math.max(0, Math.min(100, hunger))}%`; hungerBar.parentElement?.setAttribute('aria-valuenow', String(Math.ceil(hunger))); }
    if (miningBar) { miningBar.style.width = `${Math.max(0, Math.min(100, mining * 100))}%`; miningBar.parentElement?.classList.toggle('active', mining > 0); }
    const selected = this.hud.querySelector('.selected-name'), stack = inventory.selectedStack;
    if (selected) selected.textContent = stack && ITEMS[stack.id] ? `${inventory.selected + 1} · ${ITEMS[stack.id].name}${stack.durability !== undefined ? ` · ${Math.ceil(stack.durability)} / ${ITEMS[stack.id].tool?.durability ?? '?'} uses` : ITEMS[stack.id].food ? ` · ${this.keyLabel('eat')} to eat` : ''}` : `${inventory.selected + 1} · Empty hands`;
    const debugPanel = this.hud.querySelector<HTMLElement>('.debug'); if (debugPanel) { debugPanel.textContent = debug; debugPanel.style.display = this.settings.debug ? 'block' : 'none'; }
    const healthLabel = this.hud.querySelector('.health label'), hungerLabel = this.hud.querySelector('.hunger label');
    if (healthLabel) healthLabel.textContent = `HEALTH ${Math.ceil(health)} / 100`; if (hungerLabel) hungerLabel.textContent = `HUNGER ${Math.ceil(hunger)} / 100`;
    this.hud.querySelector('.health')?.classList.toggle('critical', health < 30); this.hud.querySelector('.hunger')?.classList.toggle('critical', hunger < 25);
  }
  environment(text: string): void { const label = this.hud.querySelector('.environment'); if (label) label.textContent = text; }

  private slotHTML(stack: ItemStack | null, index: number, selected: boolean, mode: 'inventory' | 'hotbar' | 'cache' = 'inventory'): string {
    const item = stack ? ITEMS[stack.id] : undefined;
    const description = item && stack ? `${item.name} ×${stack.count}${stack.durability !== undefined ? ` · ${Math.ceil(stack.durability)} / ${item.tool?.durability ?? '?'} durability` : ''}. ${this.itemDescription(item.id)}` : 'Empty slot';
    const tag = mode === 'hotbar' ? 'div' : 'button';
    const durability = stack?.durability !== undefined && item?.tool ? Math.max(0, Math.min(100, stack.durability / item.tool.durability * 100)) : undefined;
    return `<${tag} ${tag === 'button' ? 'type="button"' : ''} class="slot ${selected ? 'selected' : ''} ${mode === 'inventory' && index < 9 ? 'hotbar-slot' : ''}" data-slot="${index}" title="${this.escape(description)}" aria-label="Slot ${index + 1}: ${this.escape(description)}${selected ? ', selected' : ''}"><span class="number">${mode !== 'cache' && index < 9 ? index + 1 : ''}</span>${item ? `${this.itemIcon(item.id)}${stack && stack.count > 1 ? `<span class="count">${stack.count}</span>` : ''}${durability !== undefined ? `<span class="durability ${durability < 25 ? 'low' : ''}" aria-hidden="true"><i style="width:${durability}%"></i></span>` : ''}` : '<span class="empty-slot" aria-hidden="true">·</span>'}</${tag}>`;
  }

  private itemDescription(id: string): string {
    const item = ITEMS[id]; if (!item) return '';
    if (item.tool?.kind === 'pickaxe') return item.tool.tier >= 2 ? 'Mines Slate, metal veins, and Lumenite.' : item.tool.tier >= 1 ? 'Mines Slate and iron. Upgrade to iron for Lumenite.' : 'Mines Slate, coal, and copper. Craft a Slate Pick before mining iron.';
    if (item.tool) return item.tool.kind === 'axe' ? 'Cuts wood quickly; wears down with use.' : item.tool.kind === 'shovel' ? 'Digs earth, sand, and gravel quickly.' : `A close-range weapon${item.tool.damage ? ` · ${item.tool.damage} damage` : ''}.`;
    if (item.food) return `Select in the hotbar and press ${this.keyLabel('eat')} when hungry to restore ${item.food * 3} hunger.`;
    if (id === 'chest') return 'Place with right-click; right-click the placed chest to open storage.';
    if (id === 'torch' || id === 'lantern') return 'Place with right-click to light your shelter or route.';
    return item.kind === 'block' ? 'Place with right-click. Also used in matching crafting recipes.' : 'Crafting material. Check recipe ingredient counts.';
  }

  private itemIcon(id: string): string {
    const item = ITEMS[id]; if (!item) return '';
    let shape: string;
    if (item.tool) {
      const handle = '<path d="M10 28 23 10" stroke="#563e2b" stroke-width="5"/><path d="M10 27 22 11" stroke="#c39562" stroke-width="3"/>';
      shape = item.tool.kind === 'pickaxe' ? `${handle}<path d="m9 8 7-4 10 3 5 8-8-4-8-1-6 3Z" fill="currentColor"/><path d="m12 8 5-2 8 3" fill="none" stroke="#ffffff66" stroke-width="2"/>`
        : item.tool.kind === 'axe' ? `${handle}<path d="m18 5 9 2 4 6-3 6-11-7Z" fill="currentColor"/><path d="m28 10 2 3-3 4" fill="none" stroke="#ffffff88" stroke-width="2"/>`
        : item.tool.kind === 'shovel' ? `${handle}<path d="m20 3 9 6-2 8-7 1-5-6Z" fill="currentColor"/><path d="m22 6 4 4-2 5" fill="none" stroke="#ffffff77" stroke-width="2"/>`
        : '<path d="m9 28 5-7" stroke="#bd8f5d" stroke-width="5"/><path d="m13 21 6-10L29 3l-3 12-9 10Z" fill="currentColor"/><path d="m16 22 10-14" stroke="#ffffff77" stroke-width="2"/><path d="m9 17 12 9" stroke="#d1aa66" stroke-width="3"/>';
    } else if (id === 'berries') shape = '<path d="m17 14 2-8 7-2-3 6Z" fill="#84b66b"/><g fill="currentColor" stroke="#722f49" stroke-width="1.5"><circle cx="12" cy="18" r="6"/><circle cx="22" cy="18" r="6"/><circle cx="17" cy="25" r="6"/></g><path d="m10 16 2-2m9 1 2-1m-8 8 2-1" stroke="#ffc5a3" stroke-width="2"/>';
    else if (id === 'bread') shape = '<path d="M4 23c-3-12 8-21 21-15 6 3 7 12 3 17L8 28Z" fill="currentColor" stroke="#875334" stroke-width="2"/><path d="m11 12 2 7m5-9 2 7m5-5 1 6" stroke="#f5d7a0" stroke-width="3"/>';
    else if (id === 'mushroom') shape = '<path d="m14 17-2 12h10l-3-12" fill="#e8d4bc"/><path d="M3 18C4 2 28 1 31 18Z" fill="currentColor" stroke="#674b7a" stroke-width="2"/><path d="m10 12 3-2m8 2 2 2" stroke="#eddbf2" stroke-width="3"/>';
    else if (id === 'torch') shape = '<path d="m14 29 3-17" stroke="#947449" stroke-width="6"/><path d="M17 18c-10-3-5-10-1-16 0 5 10 8 5 14Z" fill="currentColor"/><path d="M17 16c-4-2-1-7 0-9 1 4 5 6 0 9" fill="#fff1bb"/>';
    else if (id === 'lantern') shape = '<path d="M12 8V4h10v4" fill="none" stroke="#ab9065" stroke-width="3"/><path d="m8 10 19 0 2 19H6Z" fill="#5c695a" stroke="#cfac70" stroke-width="2"/><path d="M11 13h13v13H11Z" fill="currentColor"/><path d="M17 13v13" stroke="#fff2c1" stroke-width="2"/>';
    else if (id === 'chest') shape = '<path d="m4 11 12-6 14 5v18H4Z" fill="currentColor"/><path d="m4 11 14 3 12-4M18 14v15M4 19l14 3 12-4" fill="none" stroke="#6b482e" stroke-width="2"/><path d="M16 18h5v7h-5Z" fill="#f3d083"/>';
    else if (id === 'wood') shape = '<path d="m6 8 14-4 8 5v18l-14 4-8-5Z" fill="currentColor"/><path d="m6 8 9 5 13-4-8-5Z" fill="#c19a65"/><path d="m11 8 8-1 4 2-9 2Z" fill="none" stroke="#735139"/><path d="M10 15v10m9-9v11m5-12v10" stroke="#4e392d" stroke-width="2"/>';
    else if (id === 'plank') shape = '<path d="M4 7h26v22H4Z" fill="currentColor"/><path d="M4 14h26M4 22h26M13 7v7m9 0v8M11 22v7" stroke="#714931" stroke-width="2"/><path d="M7 10h9m2 8h9M15 25h10" stroke="#dfb47c"/>';
    else if (id === 'lumenite') shape = '<path d="m17 2 11 10-4 15-13 4-7-15Z" fill="currentColor"/><path d="m17 2-3 14 10 11m-10-11L4 16m10 0 14-4" fill="none" stroke="#d6ffff" stroke-width="2"/>';
    else if (item.kind === 'material') shape = `<path d="m5 13 8-8 12 3 5 11-9 10-15-3Z" fill="currentColor" stroke="#ffffff33"/><path d="m13 5 1 12 11-9m-11 9 7 12m-7-12L5 13" fill="none" stroke="#00000044" stroke-width="2"/><path d="m8 14 3-4m7 1 5 2" stroke="#ffffff55" stroke-width="2"/>`;
    else shape = `<path d="m3 10 13-6 15 6v16l-15 6-13-6Z" fill="currentColor"/><path d="m3 10 13 6 15-6M16 16v16" fill="none" stroke="#00000055" stroke-width="2"/><path d="m7 9 9-3 10 4-10 3Z" fill="#ffffff22"/>${id === 'glass' ? '<path d="m8 16 4 7m7-4 7-4" stroke="#e3ffff" stroke-width="2"/>' : id === 'leaves' || id === 'moss' ? '<path d="m6 12 4-4m9 4 6-3m-4 12 5-5" stroke="#a4c786" stroke-width="3"/>' : '<path d="m7 19 3 2m10 4 4-2" stroke="#ffffff33" stroke-width="2"/>'}`;
    return `<svg class="slot-icon item-icon" viewBox="0 0 34 34" style="color:${item.color}" aria-hidden="true" focusable="false">${shape}</svg>`;
  }

  private landscape(): string {
    return `<svg class="landscape" viewBox="0 0 480 560" role="img" aria-label="Original voxel landscape: redwood trees above a slate cavern with glowing mineral veins"><defs><linearGradient id="wild-sky" x2="0" y2="1"><stop stop-color="#17363c"/><stop offset="1" stop-color="#598b83"/></linearGradient><linearGradient id="wild-earth" x2="0" y2="1"><stop stop-color="#344647"/><stop offset="1" stop-color="#101b25"/></linearGradient></defs><path fill="url(#wild-sky)" d="M0 0h480v560H0Z"/><path fill="#b6d7a3" d="M343 59h47v47h-47Z"/><path fill="#d4e9c0" d="M343 59h47v12h-47Z"/><path fill="#2e5b60" d="M0 209h38v-32h40v-26h38v-37h47v39h34v30h42v-31h36v-23h36v41h40v28h55v-36h39v-27h35v119H0Z"/><path fill="#376d65" d="M0 228h59v-35h30v-26h47v41h33v22h44v-18h39v-25h41v34h45v-18h41v25h40v-37h61v105H0Z"/><path fill="#5c8762" d="M0 270h77v-20h94v17h83v-24h90v17h77v-14h59v57H0Z"/><path fill="#8baa69" d="M0 270h77v-20h94v17h83v-24h90v17h77v-14h59v12h-47v14h-101v-17h-66v24H159v-17H89v20H0Z"/><path fill="url(#wild-earth)" d="M0 294h89v-20h70v17h107v-24h66v17h101v-14h47v290H0Z"/><path fill="#644c3d" d="M0 282h89v-20h70v17h107v-24h66v17h101v-14h47v31h-59v14h-77v-17h-90v24h-83v-17H77v20H0Z"/><g fill="#785a40"><path d="M96 133h13v121H96Zm220-23h14v149h-14ZM391 154h11v96h-11Z"/></g><g fill="#285445"><path d="M53 112h20V86h57v26h22v47h-20v28H71v-28H53Zm224-29h23V58h48v25h23v50h-20v25h-56v-25h-18Zm91 53h16v-19h31v19h18v38h-16v17h-33v-17h-16Z"/></g><g fill="#407959"><path d="M73 86h57v18H73Zm227-28h48v18h-48Zm84 59h31v14h-31Z"/></g><path fill="#0a1520" d="M97 340h36v-20h116v25h39v34h42v80h-33v31H174v-25h-42v-55H97Z"/><path fill="#3b5359" d="M91 340h12v70h35v55h36v13h-48v-56H91Zm42-26h116v12H133Zm155 59h48v86h-12v-74h-36Z"/><g fill="#729095"><path d="M24 335h26v14H24Zm17 108h18v23H41Zm323-110h25v18h-25Zm39 88h28v17h-28Zm-67 80h18v18h-18Z"/></g><g fill="#bb8163"><path d="M52 364h12v12H52Zm16 14h10v10H68Zm-18 13h10v10H50Zm311 10h12v12h-12Zm17-9h10v10h-10Z"/></g><g fill="#77d3ce"><path d="M222 430h10v17h-10Zm14-8h12v23h-12Zm16 12h9v13h-9Z"/></g><path fill="#426a68" d="M174 478h123v12H174Z"/><path fill="#cb9e61" d="M148 351h5v31h-5Z"/><path fill="#ffe0a1" d="M143 341h15v14h-15Z"/><path fill="#b9d894" d="M448 305h5v5h-5ZM33 240h5v5h-5Z"/><path fill="none" stroke="#a4c8b2" stroke-opacity=".12" d="M0 0h480v560H0Z"/></svg>`;
  }

  closePanel(): void { this.cancelKeyCapture(); this.dragSource = -1; this.currentInventory = undefined; this.panel.classList.add('hidden'); }
  toast(message: string): void { this.toastElement.textContent = message; this.toastElement.style.display = 'block'; window.clearTimeout(this.toastTimer); this.toastTimer = window.setTimeout(() => { this.toastElement.style.display = 'none'; }, 4000); }
  damage(): void { this.hud.classList.remove('damage-flash'); void this.hud.offsetWidth; this.hud.classList.add('damage-flash'); }
  error(message: string): void { this.closePanel(); this.hud.classList.add('hidden'); this.screen.classList.remove('hidden'); this.screen.innerHTML = `<div class="menu-card"><div class="brand-kicker danger-text">A bend in the trail</div><h2 class="subhead">Unable to continue</h2><p class="tagline compact">${this.escape(message)}</p><button class="primary full-width" data-action="back">Return to menu</button></div>`; this.bindScreen({ back: () => this.mainMenu() }); }
  private setPanel(html: string, wide = false): void { this.cancelKeyCapture(); this.panel.classList.remove('hidden'); this.panel.classList.toggle('panel-wide', wide); this.panel.innerHTML = html; }
  private cancelKeyCapture(): void { if (this.keyCapture) window.removeEventListener('keydown', this.keyCapture, { capture: true }); this.keyCapture = undefined; }
  private bindScreen(actions: Record<string, () => void>): void { this.cancelKeyCapture(); this.screen.querySelectorAll<HTMLButtonElement>('[data-action]').forEach((button) => button.onclick = actions[button.dataset.action ?? '']); }
  private bindPanel(actions: Record<string, () => void>): void { this.cancelKeyCapture(); this.panel.querySelectorAll<HTMLButtonElement>('[data-action]').forEach((button) => button.onclick = actions[button.dataset.action ?? '']); }
  private escape(value: string): string { return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  formatWorld(world: WorldSave): string { return world.name; }
}
