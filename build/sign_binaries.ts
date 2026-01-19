import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

/**
 * Sign macOS native binaries using Apple code signing certificate
 *
 * This function signs .node binaries during the afterCopy phase.
 *
 * @param buildPath - The path to the packaged Electron app
 */
export function signDarwinBinaries(buildPath: string, arch: string): void {
  const identify = process.env.IDENTIFY_DARWIN_CODE;

  if (!identify) {
    console.log('⚠️  IDENTIFY_DARWIN_CODE not set, skipping macOS signing in afterCopy');
    return;
  }

  console.log('🔐 Signing macOS binaries in afterCopy...');

  const binaries = [
    'node_modules/@nut-tree-fork/libnut-darwin/build/Release/libnut.node',
    `node_modules/autolib/prebuilds/darwin-${arch}/autolib.node`,
  ];

  binaries.forEach((binary) => {
    const binaryPath = path.join(buildPath, binary);

    if (fs.existsSync(binaryPath)) {
      console.log(`  🔏 Signing: ${binary}`);

      execSync(`codesign --deep --force --verbose --sign "${identify}" "${binaryPath}"`, {
        stdio: 'inherit',
      });

      console.log(`  ✅ Signed: ${binary}`);
    } else {
      throw new Error(`❌ Binary not found for signing: ${binaryPath}`);
    }
  });

  // Sign extraResource binaries (they're in Resources/, not Resources/app/)
  const extraBinaries = [
    '../assets/apple-speechanalyzer-cli',
  ];

  extraBinaries.forEach((binary) => {
    const binaryPath = path.join(buildPath, binary);
    const identify = process.env.IDENTIFY_DARWIN_CODE;
    if (fs.existsSync(binaryPath)) {
      execSync(`codesign --deep --force --verbose --sign "${identify}" "${binaryPath}"`, {
        stdio: 'inherit',
      });
    } else {
      console.warn(`⚠️  Extra binary not found for signing (will be signed later): ${binaryPath}`);
    }
  });

  console.log(`✅ Signed ${binaries.length + extraBinaries.length} macOS binaries`);
}

/**
 * Sign Windows executables and DLLs using DigiCert cloud-based EV certificate
 *
 * This function signs binaries during the afterCopy phase, which means:
 * - Files are signed BEFORE the ZIP is created
 * - Files are signed BEFORE the Squirrel installer is created
 * - All distributed formats (ZIP and installer) contain properly signed binaries
 *
 * Based on actual ZIP contents from v0.8.2 release, the following files need signing:
 * - Main EXE: Witsy.exe
 * - Chromium DLLs: d3dcompiler_47.dll, ffmpeg.dll, libEGL.dll, libGLESv2.dll, vk_swiftshader.dll, vulkan-1.dll
 * - Native modules: libnut.node, autolib.node (multiple copies), onnxruntime_binding.node
 *
 * NOTE: Only signs x64 builds. ARM64 builds run on ubuntu-latest which doesn't have
 * access to signtool.exe or Windows certificate store.
 *
 * @param buildPath - The path to the packaged Electron app
 * @param arch - The architecture being built (x64, arm64, etc.)
 */
export function signWindowsBinaries(buildPath: string, arch: string): void {
  // Skip ARM64 - those builds run on ubuntu-latest without Windows signing tools
  if (arch === 'arm64') {
    console.log('⚠️  Skipping Windows signing for arm64 (requires windows arm64 runner)');
    return;
  }

  const certHash = process.env.SM_CODE_SIGNING_CERT_SHA1_HASH;

  if (!certHash) {
    console.log('⚠️  SM_CODE_SIGNING_CERT_SHA1_HASH not set, skipping Windows signing in afterCopy');
    return;
  }

  console.log('🔐 Signing Windows binaries in afterCopy...');

  // Files to sign (relative to buildPath)
  // NOTE: afterCopy runs BEFORE ASAR packaging, so paths are at root, not in resources/
  const filesToSign = [
    // Main executable (Electron binary)
    'Witsy.exe',

    // Chromium DLLs (Electron framework files)
    'd3dcompiler_47.dll',
    'ffmpeg.dll',
    'libEGL.dll',
    'libGLESv2.dll',
    'vk_swiftshader.dll',
    'vulkan-1.dll',

    // Native node modules (will be moved to app.asar.unpacked after ASAR packaging)
    'node_modules/@nut-tree-fork/libnut-win32/build/Release/libnut.node',
    'node_modules/autolib/build/Release/autolib.node',
    'node_modules/autolib/prebuilds/win32-x64/autolib.node',
    'node_modules/onnxruntime-node/bin/napi-v3/win32/x64/onnxruntime_binding.node',
  ];

  // Find autolib ABI-versioned binary dynamically (e.g., win32-x64-139)
  const autolibBinPath = path.join(buildPath, 'node_modules/autolib/bin');
  if (fs.existsSync(autolibBinPath)) {
    const autolibDirs = fs.readdirSync(autolibBinPath);
    const abiDir = autolibDirs.find(dir => dir.startsWith(`win32-x64-`));
    if (abiDir) {
      filesToSign.push(`node_modules/autolib/bin/${abiDir}/autolib.node`);
    }
  }

  let signedCount = 0;
  let skippedCount = 0;

  filesToSign.forEach((file) => {
    const filePath = path.join(buildPath, file);

    if (fs.existsSync(filePath)) {
      try {
        console.log(`  🔏 Signing: ${file}`);

        execSync(
          `signtool.exe sign /sha1 ${certHash} /tr http://timestamp.digicert.com /td SHA256 /fd SHA256 "${filePath}"`,
          {
            stdio: 'inherit', // Show signtool output for debugging
          }
        );

        signedCount++;
        console.log(`  ✅ Signed: ${file}`);
      } catch (error: any) {
        console.error(`  ❌ Failed to sign ${file}:`, error.message);
        throw error;
      }
    } else {
      console.log(`  ⏭️  Skipped (not found): ${file}`);
      skippedCount++;
    }
  });

  console.log(`✅ Signed ${signedCount} Windows binaries (${skippedCount} skipped - not found yet)`);
}
