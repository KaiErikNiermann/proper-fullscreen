/* esbuild: TypeScript -> two classic IIFE bundles. Content scripts cannot be ES modules, so the
   bundler (not a globalThis namespace) is what gives us real imports and strict types. */
import { build, context } from 'esbuild';
import { copyFile, mkdir } from 'node:fs/promises';

/** Static popup assets live beside their source but ship from dist/ next to the bundle. */
async function copyAssets() {
  await mkdir('dist', { recursive: true });
  await Promise.all([
    copyFile('src/popup/popup.html', 'dist/popup.html'),
    copyFile('src/popup/popup.css', 'dist/popup.css'),
  ]);
}

const common = {
  bundle: true,
  format: 'iife',
  target: 'firefox115',
  platform: 'browser',
  logLevel: 'info',
  sourcemap: true,
};

const targets = [
  { entryPoints: ['src/content.ts'], outfile: 'dist/content.js', ...common },
  { entryPoints: ['src/popup/popup.ts'], outfile: 'dist/popup.js', ...common },
];

await copyAssets();

if (process.argv.includes('--watch')) {
  for (const t of targets) {
    const ctx = await context(t);
    await ctx.watch();
  }
  console.log('watching…');
} else {
  await Promise.all(targets.map((t) => build(t)));
}
