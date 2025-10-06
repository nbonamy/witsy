import { build } from 'esbuild';
import { readFileSync, cpSync, mkdirSync } from 'fs';
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

// Copy terminal-kit and its dependencies to dist/cli/node_modules
const distCli = join(rootDir, 'dist/cli');
const distNodeModules = join(distCli, 'node_modules');
mkdirSync(distNodeModules, { recursive: true });

// Copy terminal-kit
const terminalKitSrc = join(rootDir, 'node_modules/terminal-kit');
const terminalKitDest = join(distNodeModules, 'terminal-kit');
cpSync(terminalKitSrc, terminalKitDest, { recursive: true });
console.log('✓ Copied terminal-kit to dist/cli/node_modules');

// Read terminal-kit's dependencies from package.json
const terminalKitPackageJson = JSON.parse(
  readFileSync(join(terminalKitSrc, 'package.json'), 'utf-8')
);
const deps = Object.keys(terminalKitPackageJson.dependencies || {});

// Copy terminal-kit dependencies
for (const dep of deps) {
  const depSrc = join(rootDir, 'node_modules', dep);
  const depDest = join(distNodeModules, dep);
  try {
    cpSync(depSrc, depDest, { recursive: true });
    console.log(`✓ Copied ${dep} to dist/cli/node_modules`);
  } catch (err) {
    console.warn(`⚠ Could not copy ${dep}: ${err.message}`);
  }
}

// Copy bin scripts to dist/cli/bin
const distBin = join(distCli, 'bin');
mkdirSync(distBin, { recursive: true });

const witsyScript = join(rootDir, 'bin/witsy');
const witsyCmd = join(rootDir, 'bin/witsy.cmd');
const witsyPs1 = join(rootDir, 'bin/witsy.ps1');
cpSync(witsyScript, join(distBin, 'witsy'), { recursive: false });
cpSync(witsyCmd, join(distBin, 'witsy.cmd'), { recursive: false });
cpSync(witsyPs1, join(distBin, 'witsy.ps1'), { recursive: false });
console.log('✓ Copied bin scripts to dist/cli/bin');
