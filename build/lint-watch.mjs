import chokidar from 'chokidar';
import { spawn } from 'child_process';

let running = false;

function runLint() {
  if (running) return;
  running = true;

  console.log('\n🔍 Running linters...');

  const lint = spawn('npm', ['run', 'lint'], { shell: true });

  lint.stdout.on('data', (data) => {
    process.stdout.write(data);
  });

  lint.stderr.on('data', (data) => {
    process.stderr.write(data);
  });

  lint.on('close', (code) => {
    if (code === 0) {
      console.log('\n✅ All checks passed\n');
    } else {
      console.log('\n❌ Linting failed\n');
    }
    running = false;
  });
}

console.log('👀 Watching for changes...');

const watcher = chokidar.watch(['.'], {
  ignored: /(^|[\/\\])(node_modules|out|\.vite|dist|build|\.git)[\/\\]/,
  persistent: true,
  ignoreInitial: true,
  awaitWriteFinish: {
    stabilityThreshold: 100,
    pollInterval: 100
  }
});

watcher.on('change', runLint);
watcher.on('ready', runLint);
