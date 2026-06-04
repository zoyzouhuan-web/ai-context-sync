import esbuild from 'esbuild';
import { argv } from 'process';

const watch = argv.includes('--watch');

const context = await esbuild.context({
  entryPoints: ['src/main.ts'],
  bundle: true,
  external: ['obsidian', 'electron', '@codemirror/*', '@lezer/*'],
  format: 'cjs',
  platform: 'browser',
  target: 'ES2018',
  logLevel: 'info',
  sourcemap: 'inline',
  outfile: 'main.js',
});

if (watch) {
  await context.watch();
  console.log('Watching...');
} else {
  await context.rebuild();
  await context.dispose();
}
