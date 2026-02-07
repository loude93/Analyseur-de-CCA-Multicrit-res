import { spawn } from 'child_process';

const procs = [];

const run = (name, cmd, args) => {
  const child = spawn(cmd, args, {
    stdio: 'inherit',
    shell: true,
  });
  procs.push(child);
  child.on('exit', (code) => {
    if (code !== 0) {
      console.error(`[${name}] exited with code ${code}`);
    }
  });
  return child;
};

run('backend', 'node', ['backend/server.js']);
run('frontend', 'vite', ['--host', '0.0.0.0', '--port', '3000']);

const shutdown = () => {
  procs.forEach((p) => {
    if (!p.killed) p.kill('SIGINT');
  });
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

