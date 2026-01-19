import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerDMG, MakerDMGConfig } from '@electron-forge/maker-dmg';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { VitePlugin } from '@electron-forge/plugin-vite';
import type { ForgeConfig } from '@electron-forge/shared-types';
import { FuseV1Options, FuseVersion } from '@electron/fuses';
import { execSync } from 'child_process';
import prePackage from './build/prepackage';
import { purgeAutolib, purgeLibnut, purgeOnnxRuntime } from './build/purge_native';
import { signDarwinBinaries } from './build/sign_binaries';

import dotenv from 'dotenv';
dotenv.config();

// osx special configuration
let osxPackagerConfig = {}
const isDarwin = process.platform == 'darwin';
const dmgOptions: MakerDMGConfig = {
  //appPath: 'actually_not_used',
  icon: './assets/icon.icns',
  background: './assets/dmg_background.png',
  additionalDMGOptions: {
    window: {
      size: { width: 658, height: 492 },
      position: { x: 500, y: 400 },
    }
  }
}

if (isDarwin) {
  osxPackagerConfig = {
    osxSign: {
      identity: process.env.IDENTIFY_DARWIN_CODE,
      provisioningProfile: './build/Witsy_Darwin.provisionprofile',
      optionsForFile: () => { return {
        hardenedRuntime: true,
        entitlements: './build/Entitlements.darwin.plist'
      }; },
    },
    osxNotarize: {
      appleId: process.env.APPLE_ID,
      appleIdPassword: process.env.APPLE_PASSWORD,
      teamId: process.env.APPLE_TEAM_ID
    }
  }
}

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,

    /*
     * electron-forge 7.9.0 fix but increases image size significantly
     */
    // ignore: (file: string): boolean => {
    //   if (!file) return false;
    //   if (file.startsWith('/node_modules')) return false;
    //   if (!file.startsWith('/.vite')) return true;
    //   return false;
    // },

    icon: 'assets/icon',
    executableName: process.platform == 'linux' ? 'witsy' : 'Witsy',
    appBundleId: 'com.nabocorp.witsy',
    extendInfo: './build/Info.plist',
    buildVersion: `${process.env.BUILD_NUMBER}`,
    extraResource: [
      'assets/trayTemplate.png',
      'assets/trayTemplate@2x.png',
      'assets/trayUpdateTemplate.png',
      'assets/trayUpdateTemplate@2x.png',
      'assets/trayWhite.png',
      'assets/trayWhite@2x.png',
      'assets/trayUpdateWhite.png',
      'assets/trayUpdateWhite@2x.png',
      'assets/icon.ico',
      'assets/gladia.png',
      'assets/speechmatics.png',
      'assets/apple-speechanalyzer-cli',
      'dist/cli',
    ] as any,
    ...(process.env.TEST ? {} : osxPackagerConfig),
    afterCopy: [
      (buildPath: string, _electronVersion: string, platform: string, arch: string, callback: (error?: Error) => void) => {
        try {
          // Sign macOS native binaries
          if (platform === 'darwin') {
            signDarwinBinaries(buildPath, arch);
          }

          // Sign Windows binaries (for ZIP distribution)
          // NOT STABLE YET
          // if (platform === 'win32') {
          //   signWindowsBinaries(buildPath, arch);
          // }

          callback();
        } catch (error: any) {
          callback(error);
        }
      },
    ],
  },
  rebuildConfig: {
    // Skip autolib - it has prebuilds for all platforms and cross-compilation
    // from Linux fails because binding.gyp conditions use HOST OS, not target
    ignoreModules: ['autolib'],
  },
  makers: process.env.TEST ? [ new MakerZIP() ] : [
    /* xplat  */ new MakerZIP({}, ['linux', 'win32', 'darwin']),
    /* darwin */ new MakerDMG(dmgOptions, ['darwin']),
    /* win32  */ new MakerSquirrel({
      ...(process.env.SM_CODE_SIGNING_CERT_SHA1_HASH ? {
        signWithParams: `/sha1 ${process.env.SM_CODE_SIGNING_CERT_SHA1_HASH} /tr http://timestamp.digicert.com /td SHA256 /fd SHA256`
      } : {})
    }),
    /* linux  */ new MakerRpm({}), new MakerDeb({})
  ],
  plugins: [
    new AutoUnpackNativesPlugin({}),
    new VitePlugin({
      // `build` can specify multiple entry builds, which can be Main process, Preload scripts, Worker process, etc.
      // If you are familiar with Vite configuration, it will look really familiar.
      build: [
        {
          // `entry` is just an alias for `build.lib.entry` in the corresponding file of `config`.
          entry: 'src/main.ts',
          config: 'vite.main.config.ts',
        },
        {
          entry: 'src/preload.ts',
          config: 'vite.preload.config.ts',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.ts',
        },
      ],
    }),
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: true,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: true,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: false,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
  hooks: {
    prePackage: async (_forgeConfig, platform, arch) => {
      // Build CLI before packaging
      execSync('npm run build:cli', { stdio: 'inherit' })
      prePackage(platform, arch)
    },
    
    /*
     * electron-forge 7.9.0 fix to include native dependencies
     */
    // packageAfterCopy: async (forgeConfig, buildPath, electronVersion, platform) => {
    //   // https://www.danielcorin.com/posts/2024/challenges-building-an-electron-app/#using-sqlite-extensions
    //   const requiredNativePackages = [ `@nut-tree-fork/libnut-${platform}`, 'autolib', ];
    //   const sourceNodeModulesPath = path.resolve('.', 'node_modules');
    //   const destNodeModulesPath = path.resolve(buildPath, 'node_modules');
    //   await Promise.all(
    //     requiredNativePackages.map(async (packageName) => {
    //       const sourcePath = path.join(sourceNodeModulesPath, packageName);
    //       const destPath = path.join(destNodeModulesPath, packageName);
    //       await fs.promises.mkdir(path.dirname(destPath), { recursive: true });
    //       await fs.promises.cp(sourcePath, destPath, {
    //         recursive: true,
    //         preserveTimestamps: true,
    //       });
    //     })
    //   );
    // },
    
    /*
     * this was needed to fix issues with binaries provided by dependencies
     */
    // packageAfterPrune: async () => {
    //   const unlink = (bin: string) => {
    //     const binPath = path.join(buildPath, bin);
    //     if (fs.existsSync(binPath)) {
    //       fs.unlinkSync(binPath);
    //     }
    //   }
    //   unlink('node_modules/@iktakahiro/markdown-it-katex/node_modules/.bin/katex')
    //   unlink('node_modules/officeparser/node_modules/.bin/rimraf')
    //   unlink('node_modules/@langchain/core/node_modules/.bin/uuid')
    //   unlink('node_modules/portfinder/node_modules/.bin/mkdirp')
    //   unlink('node_modules/clipboardy/node_modules/.bin/semver')
    //   unlink('node_modules/clipboardy/node_modules/.bin/which')
    //   unlink('node_modules/execa/node_modules/.bin/semver')
    //   unlink('node_modules/execa/node_modules/.bin/which')
    // }
    
    /*
     * Remove non-matching architecture binaries from onnxruntime-node
     */
    packageAfterPrune: async (_forgeConfig, buildPath, _electronVersion, platform, arch) => {
      console.log(`🧹 Cleaning up platform-specific binaries for ${platform}-${arch}`);

      purgeOnnxRuntime(buildPath, platform, arch);
      purgeLibnut(buildPath, platform);
      purgeAutolib(buildPath, platform, arch);

      console.log(`✅ Cleanup complete`);

    }
  
  //   /*
  //    * Remove unnecessary files from node_modules to reduce bundle size
  //    */
  //   packageAfterPrune: async (forgeConfig, buildPath, electronVersion, platform, arch) => {
  //     console.log(`\n🧹 Starting comprehensive node_modules cleanup for ${platform}-${arch}\n`);

  //     const nodeModulesPath = path.join(buildPath, 'node_modules');
  //     let totalSaved = 0;

  //     // Helper to get directory size
  //     const getDirSize = (dirPath: string): number => {
  //       if (!fs.existsSync(dirPath)) return 0;
  //       let size = 0;
  //       try {
  //         const items = fs.readdirSync(dirPath, { withFileTypes: true });
  //         for (const item of items) {
  //           const itemPath = path.join(dirPath, item.name);
  //           if (item.isDirectory()) {
  //             size += getDirSize(itemPath);
  //           } else {
  //             const stats = fs.statSync(itemPath);
  //             size += stats.size;
  //           }
  //         }
  //       } catch {
  //         // Skip if permission denied or other errors
  //       }
  //       return size;
  //     };

  //     // Helper to remove and track savings
  //     const removeAndTrack = (filePath: string): void => {
  //       if (fs.existsSync(filePath)) {
  //         const size = fs.statSync(filePath).isDirectory() ? getDirSize(filePath) : fs.statSync(filePath).size;
  //         fs.rmSync(filePath, { recursive: true, force: true });
  //         totalSaved += size;
  //       }
  //     };

  //     // 1. Remove onnxruntime-node platform-specific binaries
  //     console.log('📦 Cleaning onnxruntime-node binaries...');
  //     const onnxRuntimePath = path.join(nodeModulesPath, 'onnxruntime-node', 'bin', 'napi-v3');
  //     if (fs.existsSync(onnxRuntimePath)) {
  //       const platformDirsToRemove: string[] = [];
  //       if (platform === 'linux' && arch === 'x64') {
  //         platformDirsToRemove.push('linux/arm64', 'darwin', 'win32');
  //       } else if (platform === 'linux' && arch === 'arm64') {
  //         platformDirsToRemove.push('linux/x64', 'darwin', 'win32');
  //       } else if (platform === 'darwin' && arch === 'x64') {
  //         platformDirsToRemove.push('linux', 'darwin/arm64', 'win32');
  //       } else if (platform === 'darwin' && arch === 'arm64') {
  //         platformDirsToRemove.push('linux', 'darwin/x64', 'win32');
  //       } else if (platform === 'win32' && arch === 'x64') {
  //         platformDirsToRemove.push('linux', 'darwin', 'win32/arm64');
  //       }
  //       platformDirsToRemove.forEach(dir => {
  //         removeAndTrack(path.join(onnxRuntimePath, dir));
  //       });
  //     }

  //     // 2. Remove onnxruntime-web redundant WASM files (keep only the most compatible one)
  //     console.log('📦 Cleaning onnxruntime-web WASM variants...');
  //     const onnxWebPath = path.join(nodeModulesPath, 'onnxruntime-web', 'dist');
  //     if (fs.existsSync(onnxWebPath)) {
  //       // Keep only the JSEP WASM (most capable), remove others
  //       const wasmFiles = [
  //         'ort-wasm-simd-threaded.wasm',  // Remove: 11M (we keep JSEP version)
  //         'ort-wasm-simd.wasm',
  //         'ort-wasm-threaded.wasm',
  //         'ort-wasm.wasm',
  //       ];
  //       wasmFiles.forEach(file => {
  //         removeAndTrack(path.join(onnxWebPath, file));
  //       });

  //       // Remove WebGL variants (we use WebGPU/WASM)
  //       ['ort.webgl.js', 'ort.webgl.mjs'].forEach(file => {
  //         removeAndTrack(path.join(onnxWebPath, file));
  //       });
  //     }

  //     // 3. Remove all source maps (.map files)
  //     console.log('🗺️  Removing source maps...');
  //     const removeMapFiles = (dir: string) => {
  //       if (!fs.existsSync(dir)) return;
  //       try {
  //         const items = fs.readdirSync(dir, { withFileTypes: true });
  //         for (const item of items) {
  //           const itemPath = path.join(dir, item.name);
  //           if (item.isDirectory()) {
  //             removeMapFiles(itemPath);
  //           } else if (item.name.endsWith('.map')) {
  //             removeAndTrack(itemPath);
  //           }
  //         }
  //       } catch {
  //         // Skip on error
  //       }
  //     };
  //     removeMapFiles(nodeModulesPath);

  //     // 4. Remove documentation and test directories
  //     console.log('📚 Removing docs and tests...');
  //     const docsAndTestDirs = ['docs', 'doc', 'examples', 'example', 'test', 'tests', '__tests__', 'spec'];
  //     const walkAndRemoveDirs = (dir: string, dirsToRemove: string[]) => {
  //       if (!fs.existsSync(dir)) return;
  //       try {
  //         const items = fs.readdirSync(dir, { withFileTypes: true });
  //         for (const item of items) {
  //           if (item.isDirectory()) {
  //             const itemPath = path.join(dir, item.name);
  //             if (dirsToRemove.includes(item.name.toLowerCase())) {
  //               removeAndTrack(itemPath);
  //             } else if (item.name !== 'node_modules') { // Don't recurse into nested node_modules
  //               walkAndRemoveDirs(itemPath, dirsToRemove);
  //             }
  //           }
  //         }
  //       } catch {
  //         // Skip on error
  //       }
  //     };
  //     walkAndRemoveDirs(nodeModulesPath, docsAndTestDirs);

  //     // 5. Remove TypeScript source files where compiled .js exists
  //     console.log('📝 Removing redundant TypeScript sources...');
  //     const removeTsWithJs = (dir: string) => {
  //       if (!fs.existsSync(dir)) return;
  //       try {
  //         const items = fs.readdirSync(dir, { withFileTypes: true });
  //         for (const item of items) {
  //           const itemPath = path.join(dir, item.name);
  //           if (item.isDirectory() && item.name !== 'node_modules') {
  //             removeTsWithJs(itemPath);
  //           } else if (item.name.endsWith('.ts') && !item.name.endsWith('.d.ts')) {
  //             // Check if corresponding .js exists
  //             const jsPath = itemPath.replace(/\.ts$/, '.js');
  //             if (fs.existsSync(jsPath)) {
  //               removeAndTrack(itemPath);
  //             }
  //           }
  //         }
  //       } catch {
  //         // Skip on error
  //       }
  //     };
  //     removeTsWithJs(nodeModulesPath);

  //     // Report savings
  //     const savedMB = (totalSaved / 1024 / 1024).toFixed(2);
  //     console.log(`\n✅ Cleanup complete! Saved ${savedMB} MB\n`);
  //   }
  
  }
};

export default config;
