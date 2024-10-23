
import fs from 'fs';

// find packages recursively in the given path
async function *listPackages(path) {
  const entries = await fs.promises.readdir(path, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = `${path}/${entry.name}`;
    if (entry.isDirectory()) {
      for await (const pkg of listPackages(fullPath)) {
        yield pkg;
      }
    } else if (entry.isFile()) {
      if (['RELEASES'].includes(entry.name) | ['zip', 'dmg', 'exe', 'deb', 'rpm', 'nupkg'].includes(fullPath.split('.').pop())) {
        yield fullPath;
      }
    }
  }
}

// get all packages
const pkgs = []
for await (const pkg of listPackages('./out/make')) {
  pkgs.push(pkg);
}

// output in one line
console.log(pkgs.join(' '));
