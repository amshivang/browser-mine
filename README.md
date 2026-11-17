<div align="center">

  <p>
    <a href="https://github.com/amshivang"><strong>Shivang Shukla (@amshivang)</strong></a> • 
    <a href="https://github.com/amshivang?tab=repositories">Portfolio Repositories</a> • 
    <a href="mailto:linkwithshivang@gmail.com">Contact</a>
  </p>

  # ⛏️ Browser Mine — The Wild Below
  ### Procedural 3D Voxel Survival Sandbox Engine in Browser

  <p>
    <em>A client-side 3D voxel sandbox game engineered with TypeScript, Three.js, and multi-threaded Web Workers, featuring infinite seeded terrain generation, dynamic atmospheric simulation, and zero external dependencies.</em>
  </p>

  <p>
    <a href="https://amshivang.github.io/browser-mine/"><img src="https://img.shields.io/badge/Live%20Demo-GitHub%20Pages-0284C7?style=for-the-badge&logo=githubpages&logoColor=white" alt="Live Demo"/></a>
    <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-5.9-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript"/></a>
    <a href="https://threejs.org/"><img src="https://img.shields.io/badge/Three.js-WebGL%202-000000?style=for-the-badge&logo=three.js&logoColor=white" alt="Three.js"/></a>
    <a href="https://vitejs.dev/"><img src="https://img.shields.io/badge/Vite-7.1-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite"/></a>
    <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-EAB308?style=for-the-badge" alt="License: MIT"/></a>
  </p>

  <p>
    <a href="#-overview">Overview</a> •
    <a href="#-key-features">Key Features</a> •
    <a href="#-architecture--tech-stack">Tech Stack</a> •
    <a href="#-controls--gameplay">Controls</a> •
    <a href="#-quick-start">Quick Start</a> •
    <a href="#-repository-structure">Structure</a> •
    <a href="#-performance--sandboxing">Performance & Sandboxing</a> •
    <a href="#-author--connect">Author</a>
  </p>

</div>

---

## 📌 Overview

**Browser Mine — The Wild Below** is an original, single-player 3D voxel survival sandbox game engineered to run natively in modern web browsers at high frame rates. Built from the ground up without heavy external game engines (such as Unity or Unreal), it harnesses modern web standards including **WebGL 2**, **Web Workers**, **IndexedDB**, and the **Web Audio API**.

Players explore seeded procedurally generated worlds, excavate geological strata, harvest timber and minerals, craft tiered tools with realistic durability decay, erect shelters, manage hunger and vital health bars, and secure surplus goods in persistent caches.

🌐 **Play the Live Game:** [https://amshivang.github.io/browser-mine/](https://amshivang.github.io/browser-mine/)

---

## ✨ Key Features

- **🌐 Multi-Threaded Chunk Generation**: Offloads Perlin/Simplex procedural terrain computation to dedicated browser **Web Workers**, preventing UI main thread stutters and maintaining steady 60 FPS rendering.
- **🎲 Deterministic World Seeding**: Identical seed strings generate identical topography, biomes (redwood forests, caves, plains), ore distribution veins, and flora.
- **⚒️ Tiered Tool Progression & Durability**: From wooden picks to slate and iron tools; specific materials (like deep iron and lumenite) require corresponding tool harvest tiers.
- **🌅 Dynamic Day/Night & Weather Simulation**: Atmospheric skybox shifts dynamically from daylight to starry nights with ambient lighting changes, rain systems, and particle effects.
- **💾 Local World Persistence**: Automatically saves world block alterations, player coordinate vectors, inventory contents, and chest caches to browser **IndexedDB** and **localStorage**.
- **🎨 100% Self-Contained Vector Art**: Title typography, UI iconography, and crosshairs are crafted as crisp inline SVG vectors with locally bundled offline fonts.

---

## 🛠️ Architecture & Tech Stack

| Component / Layer | Technology | Version | Architectural Role & Rationale |
| :--- | :--- | :--- | :--- |
| **Language** | TypeScript | `>= 5.9.0` | Strict static typing across ECS architecture, world coordinates, and game state |
| **3D Rendering** | Three.js | `>= 0.180.0` | Scene graph management, frustum culling, shader materials, and WebGL 2 pipelines |
| **Build Tool** | Vite | `>= 7.1.0` | Ultra-fast ES module HMR development server and optimized rollup bundling |
| **Concurrency** | Web Workers API | Native | Asynchronous voxel terrain meshing and noise calculation off main thread |
| **Data Persistence**| IndexedDB / LocalStorage | Native | Zero-backend local storage for multi-world save files and user preferences |
| **Audio Engine** | Web Audio API | Native | Procedural sound generation and spatial distance attenuation |
| **Testing** | Playwright | `>= 1.56.0` | End-to-end headless browser testing across Chromium runtimes |

---

## 🎮 Controls & Gameplay

Movement, sprint, crouch, inventory, consumption, and item dropping can be rebound inside the in-game **Controls** menu.

| Action | Default Key / Input | In-Game Function |
| :--- | :--- | :--- |
| **Move** | <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> | Directional walking / swimming |
| **Look** | Mouse Movement | Pointer-locked first-person camera rotation |
| **Jump / Swim Up** | <kbd>Space</kbd> | Jump or ascend in water |
| **Sprint** | <kbd>Left Shift</kbd> | Accelerates movement speed (consumes hunger) |
| **Crouch / Swim Down** | <kbd>Left Ctrl</kbd> | Sneak without falling off edges / dive in water |
| **Mine / Attack** | <kbd>Left Mouse</kbd> (Hold) | Break targeted blocks or strike entities |
| **Place Block / Open**| <kbd>Right Mouse</kbd> | Place active hotbar block or open chest cache |
| **Crouch Place** | <kbd>Ctrl</kbd> + <kbd>Right Mouse</kbd> | Place block against a chest without opening UI |
| **Hotbar Selection** | <kbd>1</kbd> – <kbd>9</kbd> or Scroll Wheel | Switch active handheld item |
| **Field Pack (Inventory)**| <kbd>E</kbd> | Open / close crafting grid and inventory |
| **Eat Food** | <kbd>F</kbd> | Consume held food item to restore hunger/health |
| **Drop Item** | <kbd>Q</kbd> | Discard single item from selected hotbar slot |
| **Pause / Release Mouse**| <kbd>Escape</kbd> | Pause simulation and unlock mouse cursor |
| **Quick Save** | <kbd>F5</kbd> | Force write game state to local IndexedDB |

---

## 🚀 Quick Start

### Option 1: Play Instantly
Navigate to **[https://amshivang.github.io/browser-mine/](https://amshivang.github.io/browser-mine/)** in any modern desktop browser (Chrome, Edge, Firefox, Brave).

### Option 2: Local Development Setup
Requires **Node.js 20.19+** or **Node.js 22.12+** and npm.

```bash
# 1. Clone repository
git clone https://github.com/amshivang/browser-mine.git
cd browser-mine

# 2. Install dependencies
npm ci

# 3. Start local development server
npm run dev
```

Open `http://127.0.0.1:5174` in your browser.

```bash
# Type check and run automated browser tests
npm run check
npm run test

# Production build and preview
npm run build
npm run preview
```

---

## 📂 Repository Structure

```
browser-mine/
├── .github/
│   └── workflows/
│       └── deploy.yml              # Automated GitHub Pages CI/CD workflow
├── public/
│   └── favicon.svg                 # Application favicon
├── src/
│   ├── entities/
│   │   └── EntityManager.ts        # Entity lifecycle and drops management
│   ├── game/
│   │   ├── Game.ts                 # Main game loop, tick dispatcher & camera
│   │   └── InputManager.ts         # Pointer lock & keyboard event handling
│   ├── inventory/
│   │   ├── Inventory.ts            # Pack state, slot swapping & stack splitting
│   │   └── items.ts                # Item registry, crafting recipes & durability
│   ├── persistence/
│   │   └── SaveManager.ts          # IndexedDB chunk serialization
│   ├── player/
│   │   ├── HandModel.ts            # First-person animated tool rendering
│   │   └── Player.ts               # Player physics, AABB collisions & vitals
│   ├── systems/
│   │   ├── AudioManager.ts         # Procedural sound effect synthesizer
│   │   ├── DayNight.ts             # Sunlight angle, sky shader & lighting transitions
│   │   ├── Particles.ts            # Block breaking and environmental particles
│   │   └── Weather.ts              # Rain simulation and cloud volume rendering
│   ├── ui/
│   │   └── UIManager.ts            # HUD, crafting menu & hotbar DOM controllers
│   ├── world/
│   │   ├── BiomeGenerator.ts       # Simplex noise biomes, caves & ore veins
│   │   ├── blocks.ts               # Block textures, hardness & tool requirements
│   │   ├── Chunk.ts                # 16x16x256 voxel mesh generator
│   │   └── generation.worker.ts    # Background Web Worker thread entry
│   ├── main.ts                     # Application bootstrap
│   └── styles.css                  # HUD styles and responsive overlays
├── index.html                      # HTML entry template
├── package.json                    # Project dependencies and npm scripts
├── playwright.config.ts            # Playwright end-to-end testing configuration
├── tsconfig.json                   # TypeScript compiler configuration
├── vite.config.ts                  # Vite bundler configuration
├── LICENSE                         # MIT License
└── README.md                       # Comprehensive documentation
```

---

## ⚡ Performance & Sandboxing

- **Zero Remote Telemetry**: Runs 100% inside the client sandbox with zero backend reporting or tracking.
- **Worker Isolation**: CPU-intensive voxel generation occurs in an isolated background thread, guaranteeing stutter-free 60 FPS gameplay.
- **Memory Safety**: Chunks outside render distance are culled and garbage collected to prevent memory bloat in extended sessions.

---

## 📜 License

Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for details.

---

## 👤 Author & Connect

<div align="center">
  <p><strong>Shivang Shukla</strong></p>
  <p><em>Cybersecurity & Digital Forensics Scholar @ UPSIFS (Uttar Pradesh State Institute of Forensic Sciences)</em></p>

  <p>
    <a href="https://github.com/amshivang"><img src="https://img.shields.io/badge/GitHub-181717?style=for-the-badge&logo=github&logoColor=white" alt="GitHub"/></a>
    <a href="https://www.linkedin.com/in/amshivang/"><img src="https://img.shields.io/badge/LinkedIn-0077B5?style=for-the-badge&logo=linkedin&logoColor=white" alt="LinkedIn"/></a>
    <a href="mailto:linkwithshivang@gmail.com"><img src="https://img.shields.io/badge/Email-D14836?style=for-the-badge&logo=gmail&logoColor=white" alt="Email"/></a>
  </p>

  <a href="https://buymeacoffee.com/amshivang">
    <img src="https://raw.githubusercontent.com/amshivang/amshivang/main/qr-code.png" alt="Buy Me A Coffee" width="180">
  </a>
  <br>
  <strong><a href="https://buymeacoffee.com/amshivang">☕ Support my open-source work on Buy Me A Coffee!</a></strong>
</div>
