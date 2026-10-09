import './styles.css';
import '@fontsource/barlow-condensed/400.css';
import '@fontsource/barlow-condensed/600.css';
import '@fontsource/barlow-condensed/700.css';
import '@fontsource/dm-mono/400.css';
import { Game } from './game/Game.ts';

const root = document.getElementById('app');
if (!root) throw new Error('Missing application root.');
try {
  const game = new Game(root);
  if (import.meta.env.DEV && new URLSearchParams(location.search).has('qa')) (window as unknown as { __game: Game }).__game = game;
} catch (error) {
  root.innerHTML = `<div class="screen"><div class="menu-card"><h2 class="subhead">Unable to start Browser Mine</h2><p class="tagline">A modern desktop browser with hardware-accelerated WebGL and Web Workers is required. Enable graphics acceleration and reload.</p><p class="world-meta" id="startup-error"></p></div></div>`;
  const detail = root.querySelector('#startup-error'); if (detail) detail.textContent = String(error); console.error(error);
}
