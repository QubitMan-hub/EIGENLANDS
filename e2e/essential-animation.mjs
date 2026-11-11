// Real movement/combat input, then deterministic source-clip inspection on the actual playable character.
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
const base = process.argv[2] ?? 'http://127.0.0.1:5240/',
  out = process.argv[3] ?? '/tmp/eigenlands-essential-playtest';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME ?? '/usr/bin/chromium',
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const errors = [],
  poses = [];
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', (e) => {
    errors.push(e.message);
    console.error(e.stack);
  });
  await page.goto(`${base}?dev=1&hour=12`);
  await page.fill('#name', 'Essential');
  await page.click('#btn-guest');
  await page.waitForFunction(() => window.__eigen?.state().voxel?.humanoids?.length > 0, null, { timeout: 90000 });
  const own = () =>
    page.evaluate(() => {
      const g = window.__eigen.game;
      return g.voxel.actors.get(g.myId).rig.animator.diagnostics();
    });
  const initial = await own();
  assert.equal(initial.bones, 25);
  assert.equal(initial.source, 'essential-fbx');
  await page.keyboard.down('KeyS');
  await page.waitForFunction(
    () => {
      const g = window.__eigen.game;
      return g.voxel.actors.get(g.myId)?.rig?.animator.diagnostics().clip === 'Run';
    },
    null,
    { timeout: 15000 },
  );
  await page.screenshot({ path: `${out}/live-run.png` });
  await page.keyboard.up('KeyS');
  await page.waitForFunction(
    () => {
      const g = window.__eigen.game;
      return g.voxel.actors.get(g.myId)?.rig?.animator.diagnostics().clip === 'Idle';
    },
    null,
    { timeout: 15000 },
  );
  await page.keyboard.press('Digit0');
  await page.keyboard.press('KeyJ');
  await page.waitForFunction(
    () => {
      const g = window.__eigen.game;
      return g.voxel.actors.get(g.myId)?.rig?.animator.diagnostics().clip === 'Attack';
    },
    null,
    { timeout: 15000 },
  );
  await page.screenshot({ path: `${out}/live-attack.png` });
  await page.keyboard.press('KeyI');
  await page.waitForSelector('.portrait-box img');
  await page.screenshot({ path: `${out}/inventory.png` });
  await page.keyboard.press('Escape');
  await page.evaluate(() => {
    const g = window.__eigen.game;
    g.scale = 5;
  });
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.__eigen.game.app.ticker.stop());
  for (const [name, time] of [
    ['Idle', 0.65],
    ['Run', 0.2],
    ['Attack', 0.36],
    ['Hit', 0.3],
    ['Death', 2.299],
  ]) {
    const pose = await page.evaluate(
      ([name, time]) => {
        const g = window.__eigen.game,
          v = g.voxel,
          rig = v.actors.get(g.myId).rig;
        rig.sample(name, time);
        v.renderer.render(v.scene, v.camera);
        return {
          ...rig.animator.diagnostics(),
          skinned: rig.body.isSkinnedMesh,
          bones: rig.body.skeleton.bones.length,
          vertices: rig.body.geometry.getAttribute('position').count,
          weaponParent: rig.gear.parent.name,
          orthographic: v.camera.isOrthographicCamera,
        };
      },
      [name, time],
    );
    assert.equal(pose.clip, name);
    assert.equal(pose.bones, 25);
    assert.equal(pose.skinned, true);
    assert.equal(pose.orthographic, true);
    assert.equal(pose.weaponParent, 'RightHand');
    poses.push(pose);
    await page.screenshot({ path: `${out}/${name.toLowerCase()}.png` });
  }
  assert.deepEqual(errors, []);
  writeFileSync(
    `${out}/results.json`,
    JSON.stringify({ initial, liveInputs: ['Run', 'Attack'], poses, errors }, null, 2),
  );
  console.log(
    'PASS: supplied 25-joint body, live run/attack, all five original clips, equipment sockets and isometric camera',
  );
} finally {
  await browser.close();
}
