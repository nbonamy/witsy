import type { ForgeConfig } from "@electron-forge/shared-types";
import { MakerSquirrel } from "@electron-forge/maker-squirrel";
import { MakerZIP } from "@electron-forge/maker-zip";
import { MakerDMG } from "@electron-forge/maker-dmg";
import { MakerPKG } from "@electron-forge/maker-pkg";
import { MakerDeb } from "@electron-forge/maker-deb";
import { MakerRpm } from "@electron-forge/maker-rpm";
import { VitePlugin } from "@electron-forge/plugin-vite";
import { FusesPlugin } from "@electron-forge/plugin-fuses";
import { FuseV1Options, FuseVersion } from "@electron/fuses";
import { execSync } from "child_process";
import prePackage from "./prepackage.js";
import fs from "fs";
import path from "path";

import dotenv from "dotenv";
dotenv.config();

// osx special configuration
let osxPackagerConfig = {};
const isDarwin = process.platform == "darwin";
const isMas = isDarwin && process.argv.includes("mas");
const dmgOptions = {
  icon: "./assets/icon.icns",
  background: "./assets/dmg_background.png",
  additionalDMGOptions: {
    window: {
      size: { width: 658, height: 492 },
      position: { x: 500, y: 400 },
    },
  },
};

if (isDarwin) {
  if (!isMas) {
    osxPackagerConfig = {
      osxSign: {
        identity: process.env.IDENTIFY_DARWIN_CODE,
        provisioningProfile: "./build/Witsy_Darwin.provisionprofile",
        optionsForFile: () => {
          return {
            hardenedRuntime: true,
            entitlements: "./build/Entitlements.darwin.plist",
          };
        },
      },
      osxNotarize: {
        appleId: process.env.APPLE_ID,
        appleIdPassword: process.env.APPLE_PASSWORD,
        teamId: process.env.APPLE_TEAM_ID,
      },
    };
  } else {
    osxPackagerConfig = {
      osxUniversal: {},
      osxSign: {
        identity: process.env.IDENTITY_MAS_CODE,
        provisioningProfile: "./build/Witsy_MAS.provisionprofile",
        optionsForFile: (filePath: string) => {
          let entitlements = "./build/Entitlements.mas.child.plist";
          if (filePath.endsWith("Witsy.app")) {
            entitlements = "./build/Entitlements.mas.main.plist";
          }
          return {
            hardenedRuntime: true,
            entitlements: entitlements,
          };
        },
      },
    };
  }
}

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    icon: "assets/icon",
    executableName: process.platform == "linux" ? "witsy" : "Witsy",
    appBundleId: "com.nabocorp.witsy",
    extendInfo: "./build/Info.plist",
    buildVersion: `${process.env.BUILD_NUMBER}`,
    extraResource: [
      "assets/bulbTemplate.png",
      "assets/bulbTemplate@2x.png",
      "assets/bulbUpdateTemplate.png",
      "assets/bulbUpdateTemplate@2x.png",
      //...(fs.existsSync('./gdrive.json') ? ['gdrive.json'] : []),
    ],
    ...osxPackagerConfig,
    afterCopy: [
      // sign native modules
      (buildPath, electronVersion, platform, arch, callback) => {
        try {
          // we sign libnut on mas but feature is disabled anyway
          if (platform === "darwin" || platform === "mas") {
            const binaries = [
              "node_modules/@nut-tree-fork/libnut-darwin/build/Release/libnut.node",
            ];

            binaries.forEach((binary) => {
              const binaryPath = path.join(buildPath, binary);
              const identify = isMas
                ? process.env.IDENTITY_MAS_CODE
                : process.env.IDENTIFY_DARWIN_CODE;
              if (fs.existsSync(binaryPath)) {
                console.log(`Signing binary: ${binaryPath}`);
                execSync(
                  `codesign --deep --force --verbose --sign "${identify}" "${binaryPath}"`,
                  {
                    stdio: "inherit",
                  }
                );
              } else {
                console.error(`Binary not found: ${binaryPath}`);
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
  makers: [
    /* xplat  */ new MakerZIP({}, ["linux", "win32", "darwin"]),
    /* darwin */ ...(isDarwin
      ? [
          new MakerDMG(
            {
              ...dmgOptions,
              appPath: "./Witsy.app", // Add this line, replace 'Witsy' with your app's name
            },
            ["darwin"]
          ),
          new MakerPKG({ identity: process.env.IDENTITY_MAS_PKG }, ["mas"]),
        ]
      : []),
    /* win32  */ new MakerSquirrel({}),
    /* linux  */ new MakerRpm({}),
    new MakerDeb({}),
  ],
  plugins: [
    new VitePlugin({
      // `build` can specify multiple entry builds, which can be Main process, Preload scripts, Worker process, etc.
      // If you are familiar with Vite configuration, it will look really familiar.
      build: [
        {
          // `entry` is just an alias for `build.lib.entry` in the corresponding file of `config`.
          entry: "src/main.ts",
          config: "vite.main.config.ts",
        },
        {
          entry: "src/preload.ts",
          config: "vite.preload.config.ts",
        },
      ],
      renderer: [
        {
          name: "main_window",
          config: "vite.renderer.config.ts",
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
      prePackage(platform, arch);
    },
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    packageAfterPrune: async (
      forgeConfig,
      buildPath,
      electronVersion,
      platform,
      arch
    ) => {
      const unlink = (bin: string) => {
        const binPath = path.join(buildPath, bin);
        if (fs.existsSync(binPath)) {
          fs.unlinkSync(binPath);
        }
      };
      unlink(
        "node_modules/@iktakahiro/markdown-it-katex/node_modules/.bin/katex"
      );
      unlink("node_modules/officeparser/node_modules/.bin/rimraf");
      unlink("node_modules/@langchain/core/node_modules/.bin/uuid");
      unlink("node_modules/portfinder/node_modules/.bin/mkdirp");
      unlink("node_modules/clipboardy/node_modules/.bin/semver");
      unlink("node_modules/clipboardy/node_modules/.bin/which");
      unlink("node_modules/execa/node_modules/.bin/semver");
      unlink("node_modules/execa/node_modules/.bin/which");
    },
  },
};

export default config;
