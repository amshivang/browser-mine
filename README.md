# Browser Mine — The Wild Below

🎮 **Live Demo:** [https://amshivang.github.io/browser-mine/](https://amshivang.github.io/browser-mine/)

An original, single-player voxel survival game that runs in your browser. Explore seeded terrain, mine resources, craft tools, build shelters, manage food and health, and store your supplies in Trail Caches. Terrain is generated in Web Workers and rendered with Three.js. The title illustration and inventory icons are original inline SVG art; fonts are bundled locally.

## Run locally

Use **Node.js 22.12+** (or Node.js 20.19+) and npm. Vite 7 requires a compatible modern Node.js version.

From the project directory:

```sh
npm ci
npm run dev
```

Open **http://127.0.0.1:5174**. The development server uses a strict port: if 5174 is already in use, stop the other server before starting it. `npm install` can also install dependencies; `npm ci` uses the checked-in lockfile.

### Production build and local preview

```sh
npm run build
npm run preview
```

The build is written to `dist/`. Preview normally opens at **http://127.0.0.1:4173**; use the address printed by Vite. To preview at the development address instead:

```sh
npm run preview -- --port 5174 --strictPort
```

Serve the app over HTTP locally or HTTPS when hosted. Opening `index.html` as a `file://` URL does not provide the module/worker environment the game needs.

## Browser requirements

- A recent **desktop browser** with **WebGL 2**, JavaScript modules, and **Web Workers**. Enable graphics/hardware acceleration. Chromium-based browsers are the target of the automated browser tests; other browsers require their own verification.
- A **keyboard and mouse** with pointer-lock support. Click the world or **Resume** to capture the mouse; **Escape** releases it. Touch/gamepad controls are not implemented.
- **IndexedDB and localStorage** for persistent worlds, the world list, and settings. Private browsing, blocked site storage, or a full storage quota can prevent persistence.
- **Web Audio** for sound. Audio begins after a user interaction. Fullscreen depends on browser support and permission.

Rendering performance depends on your graphics hardware and settings. For a slower machine, use **Low** graphics, reduce render/loading distance, and turn off shadows. The responsive menus also fit smaller windows; this does not make gameplay touch-enabled.

## Your first five minutes

1. Choose **Create New World**, name your expedition, and optionally enter a seed. Leaving the seed blank generates one. Identical seeds generate identical base terrain.
2. Your starter hotbar contains a **Redwood Pick (wooden pick)**, **8 Redwood**, **8 Sun Berries**, and **8 Glowreed**. Click the world to look around. Select slot **1**, aim at exposed **Slate**, and hold the left mouse button to mine. Walk close to dropped resources to collect them.
3. Collect **3 Slate**. Open **E** and craft a **Slate Pick** using **3 Slate + 2 Redwood**. Move the pick into the first inventory row (the hotbar), close the pack, and select its numbered slot.
4. Mine iron veins using the **Slate Pick or better**, then craft an **Iron Pick** from **3 Iron + 2 Redwood**. A wooden pick cannot collect iron drops. An Iron Pick can collect **Lumenite**. Watch tool durability and keep materials for replacements.
5. Keep food in your hotbar. Select it and press **F** when hungry. Sunberry Bushes and Sunbells drop berries; Duskcaps are food too. **3 Sun Berries → 1 Trail Loaf**. High hunger helps health recover; sprinting consumes more hunger.
6. Right-click to place blocks and starter Glowreed lights. **1 Coal + 1 Redwood → 4 Glowreed**. Build a shelter and keep a lit route back to the surface.
7. Craft storage: **1 Redwood → 4 Cut Redwood**, then **8 Cut Redwood → 1 Trail Cache (chest)**. Place the cache and right-click it to open. Hold your crouch key while right-clicking to place a block against a chest instead of opening it.

The **Field Guide** is available from the title, pause menu, controls, and field pack. It reflects your current key bindings.

## Default controls

Movement, jump, sprint, crouch, inventory, eat, and drop can be rebound in **Controls**.

| Action | Default control |
| --- | --- |
| Move | W / A / S / D |
| Look | Mouse, after clicking the world |
| Jump / swim upward | Space |
| Sprint | Left Shift |
| Crouch / swim downward | Left Ctrl |
| Mine / attack | Hold left mouse button |
| Place selected block / open placed chest | Right mouse button |
| Place against a chest without opening it | Crouch + right mouse button |
| Select hotbar slot | 1–9 or mouse wheel |
| Open / close field pack or close chest | E |
| Eat selected food | F |
| Drop one item from selected hotbar stack | Q |
| Pause / release mouse | Escape |
| Save world | F5 |
| Toggle debug display | F3 |

### Inventory and crafting

- The first **9 slots** are your hotbar. The remaining slots are the backpack.
- Drag a stack onto another slot, or click a stack and then its destination. Matching material stacks merge where space permits. **Cancel move** clears a pending click-to-move selection.
- **Shift-click** moves a stack between the hotbar and backpack, merging where possible.
- **Right-click** a pack stack to split half into an empty slot. Splitting requires an empty slot.
- Recipes show **owned / required** ingredient counts. Green counts mean enough material; warm-colored counts indicate a shortage. Hover a recipe for its purpose and missing-material details. Click a ready recipe to craft; the output must fit in your pack.
- Tool silhouettes and durability bars distinguish equipment from materials. Hover an inventory slot for its name, use, and remaining durability.
- In a chest, **click or Shift-click** transfers a whole stack between chest and pack. **Right-click** transfers half, or the single item when there is only one. Partial transfers leave the remainder in place when the destination is full.

## Saving and resuming

Use **Save World** in the pause menu or **F5**. The game also attempts periodic autosaves and saves when leaving the world. Choose **Save & Quit**, then **Load World → Play** to return later. World saves include player state, inventory, modified blocks, and chest contents.

Saves are **local to the browser profile and origin** (protocol, hostname, and port). For example, `127.0.0.1:5174`, `localhost:5174`, and `127.0.0.1:4173` have separate storage. Use the same address to find your existing worlds. Clearing site data or deleting a world removes its local save; there is no cloud sync or export/import interface.

If settings cannot be written to localStorage, the UI keeps them active for the current session and shows a toast. Enable site storage to retain them after reload. World-save failures also appear as in-game messages; check the message before assuming progress was persisted.

Death drops your pack at your death location. **Respawn** returns you to the spawn point; recover supplies or rebuild your kit.

## Checks and browser tests

```sh
npm run check        # TypeScript type check
npm run build        # TypeScript check + Vite production build
npx playwright install chromium
```

The Playwright configuration accepts a **`CHROME_PATH`** environment variable. Its fallback executable is a development-machine-specific path, so set this explicitly on another machine. Use the Chromium installed by Playwright:

```sh
CHROME_PATH="$(node -p "require('@playwright/test').chromium.executablePath()")" npm test
```

On Linux, missing browser system libraries can be installed with `npx playwright install --with-deps chromium` (system package installation may require administrator access). You can also set `CHROME_PATH` to the absolute path of an existing compatible Chromium/Chrome executable.

`npm test` runs the browser specs in `tests/`. Playwright starts the dev server at **127.0.0.1:5174**, or reuses an existing server there; make sure it serves this project. The configuration uses software-rendering flags for headless Chromium, one worker, and extended timeouts for world generation. Failure screenshots and other test artifacts go into `test-results/`.

The tests exercise creation/loading, movement, crafting, persistence, and survival interactions. A documented command or feature list is not a claim that the suite passes on every browser or graphics driver; run the checks in your environment.

## Project layout

| Path | Responsibility |
| --- | --- |
| `src/game/` | Main game loop and keyboard/mouse input |
| `src/world/` | Voxel data, generation, meshing, streaming, and block definitions |
| `src/player/` | Movement, survival state, and first-person held tools |
| `src/entities/` | Creatures and dropped items |
| `src/inventory/` | Item definitions, recipes, and inventory operations |
| `src/systems/` | Day/night, weather, particles, and audio |
| `src/persistence/` | Browser-local saves and settings |
| `src/ui/UIManager.ts`, `src/styles.css` | Menus, guide, HUD, inventory, and UI artwork |
| `tests/` | Playwright browser integration tests |
