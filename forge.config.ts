import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerDMG, MakerDMGConfig } from '@electron-forge/maker-dmg';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives';
import type { ForgeConfig } from '@electron-forge/shared-types';
import { FuseV1Options, FuseVersion } from '@electron/fuses';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

import prePackage from './build/prepackage';

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
    ],
    ...(process.env.TEST ? {} : osxPackagerConfig),
    afterCopy: [
      (buildPath: string, electronVersion: string, platform: string, arch: string, callback: (error?: Error) => void) => {
        try {
          if (platform === 'darwin') {
            const binaries = [
              'node_modules/@nut-tree-fork/libnut-darwin/build/Release/libnut.node',
              'node_modules/autolib/build/Release/autolib.node',
            ];

            binaries.forEach((binary) => {
              const binaryPath = path.join(buildPath, binary);
              const identify = process.env.IDENTIFY_DARWIN_CODE;
              if (fs.existsSync(binaryPath)) {
                execSync(`codesign --deep --force --verbose --sign "${identify}" "${binaryPath}"`, {
                  stdio: 'inherit',
                });
              } else {
                throw new Error(`❌ Binary not found for signing: ${binaryPath}`);
              }
            });
          }

          callback();
        } catch (error) {
          callback(error);
        }
      },
    ],
  },
  rebuildConfig: {},
  makers: process.env.TEST ? [ new MakerZIP() ] : [
    /* xplat  */ new MakerZIP({}, ['linux', 'win32', 'darwin']),
    /* darwin */ new MakerDMG(dmgOptions, ['darwin']),
    /* win32  */ new MakerSquirrel({}),
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
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: true,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: false,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
  hooks: {
    prePackage: async (forgeConfig, platform, arch) => {
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
    packageAfterPrune: async (forgeConfig, buildPath, electronVersion, platform, arch) => {
      console.log(`🧹 Cleaning up onnxruntime-node binaries for ${platform}-${arch}`);

      const onnxRuntimePath = path.join(buildPath, 'node_modules', 'onnxruntime-node', 'bin', 'napi-v3');

      if (!fs.existsSync(onnxRuntimePath)) {
        console.log(`⚠️  onnxruntime-node path not found: ${onnxRuntimePath}`);
        return;
      }

      // Define directories to remove based on platform and arch
      const dirsToRemove: string[] = [];

      if (platform === 'linux' && arch === 'x64') {
        dirsToRemove.push('linux/arm64', 'darwin', 'win32');
      } else if (platform === 'linux' && arch === 'arm64') {
        dirsToRemove.push('linux/x64', 'darwin', 'win32');
      } else if (platform === 'darwin' && arch === 'x64') {
        dirsToRemove.push('linux', 'darwin/arm64', 'win32');
      } else if (platform === 'darwin' && arch === 'arm64') {
        dirsToRemove.push('linux', 'darwin/x64', 'win32');
      } else if (platform === 'win32' && arch === 'x64') {
        dirsToRemove.push('linux', 'darwin', 'win32/arm64');
      }

      // Remove the directories
      for (const dir of dirsToRemove) {
        const fullPath = path.join(onnxRuntimePath, dir);
        if (fs.existsSync(fullPath)) {
          console.log(`🗑️  Removing: ${dir}`);
          fs.rmSync(fullPath, { recursive: true, force: true });
        }
      }

      console.log(`✅ Cleanup complete`);
    }
  }
};

export default config;
