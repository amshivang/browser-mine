import { test, expect, type Page } from '@playwright/test';

async function create(page: Page): Promise<void> {
  await page.addInitScript(() => { if (!localStorage.getItem('browser-mine-settings')) localStorage.setItem('browser-mine-settings', JSON.stringify({ shadows: false, renderDistance: 2, loadingDistance: 2, graphics: 'low' })); });
  await page.goto('/?qa'); await page.getByRole('button', { name: 'Create New World' }).click(); await page.locator('#world-seed').fill('sunward-2026'); await page.getByRole('button', { name: 'Create & explore' }).click();
  await expect(page.locator('.hud')).toBeVisible({ timeout: 60000 }); await page.locator('.game-canvas').click(); await page.waitForFunction(() => !!document.pointerLockElement);
}
async function aim(page: Page, x: number, y: number, z: number): Promise<void> {
  await page.evaluate(({ x, y, z }) => { const g = (window as any).__game, p = g.player.object.position, dx = x - p.x, dz = z - p.z, dy = y - p.y - g.player.camera.position.y; g.player.yaw = Math.atan2(-dx, -dz); g.player.pitch = Math.atan2(dy, Math.hypot(dx, dz)); }, { x, y, z });
  await page.waitForTimeout(180);
}

test('voxel collision, real mining/placement, pickups, storage, food, combat, water, and respawn', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', (error) => errors.push(error.message)); page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await create(page);
  await page.evaluate(() => {
    const g = (window as any).__game; g.entities.spawnTimer = 99999;
    for (let x = 4; x <= 13; x++) for (let z = 4; z <= 13; z++) { g.world.setBlock(x, 75, z, 3); for (let y = 76; y <= 82; y++) g.world.setBlock(x, y, z, 0); }
    for (let x = 7; x <= 9; x++) for (let y = 76; y <= 80; y++) g.world.setBlock(x, y, 6, 3);
    g.player.setPosition(8.5, 76, 8.5); g.player.velocity.set(0, 0, 0); g.player.yaw = 0; g.player.pitch = 0;
  });
  await page.keyboard.down('KeyW'); await page.waitForTimeout(2000); await page.keyboard.up('KeyW');
  expect(await page.evaluate(() => (window as any).__game.player.object.position.z)).toBeGreaterThanOrEqual(7.29);
  await page.evaluate(() => { const g = (window as any).__game; g.player.setPosition(8.5, 76, 8.5); g.world.setBlock(8, 78, 8, 3); });
  await page.keyboard.press('Space'); await page.waitForTimeout(300);
  expect(await page.evaluate(() => (window as any).__game.player.object.position.y + 1.8)).toBeLessThanOrEqual(78.01);
  await page.evaluate(() => { const g = (window as any).__game; g.world.setBlock(8, 78, 8, 0); g.world.setBlock(8, 76, 10, 6); g.player.setPosition(8.5, 76, 8.5); g.player.velocity.set(0, 0, 0); });
  await aim(page, 8.5, 76.5, 10.5);
  await page.mouse.down(); await expect.poll(() => page.evaluate(() => (window as any).__game.world.getBlock(8, 76, 10)), { timeout: 20000 }).toBe(0); await page.mouse.up();
  await expect.poll(() => page.evaluate(() => (window as any).__game.player.inventory.count('wood')), { timeout: 15000 }).toBe(9);
  expect(await page.evaluate(() => (window as any).__game.player.inventory.slots[0].durability)).toBeLessThan(80);
  await page.keyboard.press('KeyE'); await page.locator('[data-recipe="planks"]').click();
  await page.locator('.inventory-grid .slot[data-slot="4"]').click({ button: 'right' });
  expect(await page.evaluate(() => (window as any).__game.player.inventory.slots[4].count)).toBe(2);
  await page.locator('.inventory-grid .slot[data-slot="5"]').dragTo(page.locator('.inventory-grid .slot[data-slot="4"]'));
  expect(await page.evaluate(() => (window as any).__game.player.inventory.slots[4].count)).toBe(4);
  await page.locator('[data-recipe="wooden_axe"]').click();
  expect(await page.evaluate(() => (window as any).__game.player.inventory.count('wooden_axe'))).toBe(1);
  await page.keyboard.press('KeyE'); await page.waitForFunction(() => !!document.pointerLockElement); await page.keyboard.press('Digit5'); await aim(page, 8.5, 75.9, 10.5);
  await expect.poll(() => page.evaluate(() => { const t = (window as any).__game.target; return t && { x: t.x, y: t.y, z: t.z }; }), { timeout: 10000 }).toEqual({ x: 8, y: 75, z: 10 });
  await page.mouse.down({ button: 'right' }); await page.mouse.up({ button: 'right' });
  await expect.poll(() => page.evaluate(() => (window as any).__game.world.getBlock(8, 76, 10))).toBe(15);
  await page.evaluate(() => { const g = (window as any).__game; g.player.inventory.add('chest', 1); g.world.setBlock(10, 76, 8, 20); });
  await aim(page, 10.5, 76.5, 8.5); await page.mouse.down({ button: 'right' }); await page.mouse.up({ button: 'right' });
  await expect(page.getByRole('heading', { name: 'Trail cache' })).toBeVisible(); await page.locator('.pack-grid .slot[data-slot="1"]').click();
  expect(await page.evaluate(() => (window as any).__game.world.containers.get('10,76,8')[0].id)).toBe('wood');
  await page.keyboard.press('KeyE'); await page.evaluate(() => { (window as any).__game.player.hunger = 35; }); await page.keyboard.press('Digit3'); await page.keyboard.press('KeyF');
  await expect.poll(() => page.evaluate(() => (window as any).__game.player.hunger)).toBeGreaterThan(45);
  await page.evaluate(() => { const g = (window as any).__game; g.player.inventory.add('iron_sword', 1, 220); g.player.inventory.selected = g.player.inventory.slots.findIndex((s: any) => s?.id === 'iron_sword'); g.entities.spawnCreature('brambleback', 8.5, 76, 9.7); });
  await aim(page, 8.5, 76.7, 9.7); await page.mouse.down();
  await expect.poll(() => page.evaluate(() => (window as any).__game.entities.creatures.length), { timeout: 15000 }).toBe(0); await page.mouse.up();
  expect(await page.evaluate(() => (window as any).__game.player.health)).toBeLessThan(100);
  await page.evaluate(() => { const g = (window as any).__game; for (let x = 5; x <= 7; x++) for (let z = 10; z <= 12; z++) for (let y = 76; y <= 78; y++) g.world.setBlock(x, y, z, 8); g.player.setPosition(6.5, 76.4, 11.5); g.player.velocity.set(0, 0, 0); });
  await expect.poll(() => page.evaluate(() => (window as any).__game.player.isInWater())).toBe(true);
  await page.keyboard.down('Space'); await page.waitForTimeout(450); await page.keyboard.up('Space'); expect(await page.evaluate(() => (window as any).__game.player.velocity.y)).toBeGreaterThan(0);
  await page.keyboard.press('F5'); await page.waitForTimeout(600);
  const snapshot = await page.evaluate(async () => { const g = (window as any).__game; return await g.saves.load(g.worldInfo.id); });
  expect(snapshot.changes.some((c: any) => c.x === 8 && c.y === 76 && c.z === 10 && c.id === 15)).toBe(true);
  expect(snapshot.containers[0][1][0].id).toBe('wood');
  await page.evaluate(() => (window as any).__game.player.takeDamage(200)); await expect(page.getByRole('button', { name: 'Respawn', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Respawn', exact: true }).click(); expect(await page.evaluate(() => (window as any).__game.player.health)).toBe(100);
  expect(errors).toEqual([]);
});

test('streaming releases geometry, modified blocks reload, settings/fullscreen and multiple worlds work', async ({ page }) => {
  await create(page);
  const data = await page.evaluate(() => { const g = (window as any).__game; g.world.setBlock(7, 74, 7, 15); return { seed: g.world.seed, original: g.player.object.position.toArray() }; });
  await page.evaluate(() => { const g = (window as any).__game; g.player.setPosition(3208, 80, -3192); g.player.velocity.set(0, 0, 0); });
  await expect.poll(() => page.evaluate(() => (window as any).__game.world.chunks.has('200,-200')), { timeout: 60000 }).toBe(true);
  await page.waitForTimeout(2500);
  expect(await page.evaluate(() => (window as any).__game.world.chunks.size)).toBeLessThanOrEqual(50);
  expect(await page.evaluate(() => (window as any).__game.renderer.info.memory.geometries)).toBeLessThan(160);
  await page.evaluate((position) => { const g = (window as any).__game; g.player.setPosition(...position); g.player.velocity.set(0, 0, 0); }, data.original);
  await expect.poll(() => page.evaluate(() => (window as any).__game.world.getBlock(7, 74, 7)), { timeout: 60000 }).toBe(15);
  await page.keyboard.press('Escape'); await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.locator('[data-setting="fov"]').fill('90'); await page.locator('[data-setting="fov"]').dispatchEvent('input');
  await page.getByRole('button', { name: 'Toggle Fullscreen' }).click(); await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(true);
  await page.getByRole('button', { name: 'Toggle Fullscreen' }).click();
  await page.getByRole('button', { name: '← Back' }).click(); await page.getByRole('button', { name: 'Save & Quit' }).click();
  await page.reload(); await page.getByRole('button', { name: 'Settings', exact: true }).click(); expect(await page.locator('[data-setting="fov"]').inputValue()).toBe('90');
  await page.getByRole('button', { name: '← Back' }).click(); await page.getByRole('button', { name: 'Load World' }).click(); await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.locator('.hud')).toBeVisible({ timeout: 60000 });
  const restored = await page.evaluate(async () => { const g = (window as any).__game; const saved = await g.saves.load(g.worldInfo.id); return { block: g.world.getBlock(7, 74, 7), loaded: g.world.hasChunkAt(7, 7), modification: g.world.modifications.get('7,74,7'), changes: saved.changes.filter((c: any) => c.x === 7 && c.y === 74 && c.z === 7), position: g.player.object.position.toArray() }; });
  expect(restored, JSON.stringify(restored)).toMatchObject({ block: 15, loaded: true, modification: 15 });
  await page.keyboard.press('Escape'); await page.getByRole('button', { name: 'Save & Quit' }).click(); await page.getByRole('button', { name: 'Create New World' }).click();
  await page.locator('#world-name').fill('Second World'); await page.locator('#world-seed').fill('second-world'); await page.getByRole('button', { name: 'Create & explore' }).click(); await expect(page.locator('.hud')).toBeVisible({ timeout: 60000 });
  await page.keyboard.press('Escape'); await page.getByRole('button', { name: 'Save & Quit' }).click(); await page.getByRole('button', { name: 'Load World' }).click(); expect(await page.locator('.world-row').count()).toBe(2);
  page.once('dialog', (dialog) => dialog.accept()); await page.locator('[data-delete]').first().click(); await expect(page.locator('.world-row')).toHaveCount(1);
});
