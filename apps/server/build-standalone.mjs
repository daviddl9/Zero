/**
 * esbuild script for standalone server.
 *
 * Bundles most code into a single CJS file but keeps node_modules external
 * EXCEPT packages with ESM/CJS interop issues that break at runtime.
 */
import { build } from 'esbuild';
import { readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf8'));
const allDeps = [
  ...Object.keys(pkg.dependencies || {}),
  ...Object.keys(pkg.devDependencies || {}),
];

// Packages to bundle (NOT externalize) due to ESM/CJS interop issues:
// - mimetext: has "type":"module" in package.json but CJS dist uses require()
// - @barkleapp/css-sanitizer: no default export, breaks ESM import interop
const FORCE_BUNDLE = new Set(['mimetext', '@barkleapp/css-sanitizer']);

const external = allDeps.filter((d) => !FORCE_BUNDLE.has(d));

await build({
  entryPoints: ['src/standalone.ts'],
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  outfile: 'dist/standalone.cjs',
  external,
});

console.log('Built dist/standalone.cjs');
