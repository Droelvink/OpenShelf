import { createServer } from 'net';
import { spawn } from 'child_process';
import { writeFileSync, rmSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

function getFreePort() {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
    srv.on('error', reject);
  });
}

const port = await getFreePort();
console.log(`Dev server port: ${port}`);

const configPath = join(__dirname, '.dev-config.tmp.json');
writeFileSync(
  configPath,
  JSON.stringify({
    build: {
      devUrl: `http://localhost:${port}`,
      beforeDevCommand: `ng serve --port ${port}`,
    },
  })
);

const isWindows = process.platform === 'win32';
const proc = spawn(isWindows ? 'npx.cmd' : 'npx', ['tauri', 'dev', '--config', configPath], {
  stdio: 'inherit',
});

proc.on('exit', (code) => {
  try {
    rmSync(configPath);
  } catch {}
  process.exit(code ?? 0);
});
