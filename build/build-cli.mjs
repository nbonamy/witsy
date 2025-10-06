import { build } from 'esbuild';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

// Read package.json to get version
const packageJson = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf-8'));

// Build CLI as single file
await build({
  entryPoints: [join(rootDir, 'src/cli.ts')],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: join(rootDir, 'dist/cli/cli.js'),
  target: 'node18',
  external: [
    // Electron is provided by the runtime
    'electron',
    // terminal-kit has dynamic requires that can't be bundled
    'terminal-kit',
  ],
  define: {
    '__WITSY_VERSION__': JSON.stringify(packageJson.version),
  },
  // banner: {
  //   js: '#!/usr/bin/env node',
  // },
  minify: false,
  sourcemap: false,
  loader: {
    '.node': 'copy',
  },
  plugins: [{
    name: 'ignore-readme',
    setup(build) {
      // Ignore README files that esbuild tries to parse as JS
      build.onLoad({ filter: /\/README$/ }, () => ({
        contents: '',
        loader: 'js',
      }));
    },
  }],
});

console.log('✓ CLI built successfully as single file');
