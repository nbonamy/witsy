import fs from 'fs';
import path from 'path';

/**
 * Remove non-matching platform binaries from onnxruntime-node
 */
export function purgeOnnxRuntime(buildPath: string, platform: string, arch: string): void {
  const onnxRuntimePath = path.join(buildPath, 'node_modules', 'onnxruntime-node', 'bin', 'napi-v3');

  if (!fs.existsSync(onnxRuntimePath)) {
    return;
  }

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

  for (const dir of dirsToRemove) {
    const fullPath = path.join(onnxRuntimePath, dir);
    if (fs.existsSync(fullPath)) {
      console.log(`🗑️  Removing onnxruntime: ${dir}`);
      fs.rmSync(fullPath, { recursive: true, force: true });
    }
  }
}

/**
 * Remove platform-specific @nut-tree-fork/libnut packages
 */
export function purgeLibnut(buildPath: string, platform: string): void {
  const libnutPath = path.join(buildPath, 'node_modules', '@nut-tree-fork');

  if (!fs.existsSync(libnutPath)) {
    return;
  }

  const libnutPackagesToRemove: string[] = [];

  if (platform === 'win32') {
    libnutPackagesToRemove.push('libnut-darwin', 'libnut-linux');
  } else if (platform === 'darwin') {
    libnutPackagesToRemove.push('libnut-win32', 'libnut-linux');
  } else if (platform === 'linux') {
    libnutPackagesToRemove.push('libnut-darwin', 'libnut-win32');
  }

  for (const pkg of libnutPackagesToRemove) {
    const pkgPath = path.join(libnutPath, pkg);
    if (fs.existsSync(pkgPath)) {
      const pkgPlatform = pkg.replace('libnut-', '');
      console.log(`🗑️  Removing libnut: ${pkgPlatform}`);
      fs.rmSync(pkgPath, { recursive: true, force: true });
    }
  }
}

/**
 * Remove autolib prebuilds for other platforms
 */
export function purgeAutolib(buildPath: string, platform: string, arch: string): void {
  const autolibPath = path.join(buildPath, 'node_modules', 'autolib', 'prebuilds');

  if (!fs.existsSync(autolibPath)) {
    return;
  }

  const allAutolibPrebuilds = ['darwin-arm64', 'darwin-x64', 'linux-arm64', 'linux-x64', 'win32-arm64', 'win32-x64'];
  const currentPlatformArch = `${platform}-${arch}`;
  const autolibDirsToRemove = allAutolibPrebuilds.filter(dir => dir !== currentPlatformArch);

  for (const dir of autolibDirsToRemove) {
    const fullPath = path.join(autolibPath, dir);
    if (fs.existsSync(fullPath)) {
      console.log(`🗑️  Removing autolib: ${dir}`);
      fs.rmSync(fullPath, { recursive: true, force: true });
    }
  }
}
