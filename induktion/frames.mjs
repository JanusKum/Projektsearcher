// Resumable frame render: node frames.mjs <from> <to>  → out/frames/f_0000.jpg … (frames already on disk are skipped)
// Run from $LIB. Used instead of core/render/video.mjs on machines without a GPU, where a full render outlasts a session's time limit.
import fs from 'fs'; import path from 'path';
const LIB = process.env.LIB; const HERE = path.dirname(new URL(import.meta.url).pathname);
const { openDemo, closeServer } = await import(LIB + '/core/render/page.mjs');
const [a, b] = process.argv.slice(2).map(Number), FPS = 24;
const dir = path.join(HERE, 'out', 'frames'); fs.mkdirSync(dir, { recursive: true });
const todo = []; for (let i = a; i < b; i++) if (!fs.existsSync(path.join(dir, `f_${String(i).padStart(4, '0')}.jpg`))) todo.push(i);
if (!todo.length) { console.log('nothing to do', a, b); process.exit(0); }
const { browser, page } = await openDemo(HERE, { w: 1080, h: 1920 });
for (const i of todo) {
  const t0 = Date.now(), f = path.join(dir, `f_${String(i).padStart(4, '0')}.jpg`);
  await page.evaluate(t => window.render(t), i / FPS);
  const buf = await page.screenshot({ type: 'jpeg', quality: 95, timeout: 300000 });
  fs.writeFileSync(f + '.part', buf); fs.renameSync(f + '.part', f);
  console.log(i, Date.now() - t0 + 'ms');
}
await browser.close(); closeServer();
