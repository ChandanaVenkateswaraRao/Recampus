const { execSync } = require('child_process');

const port = process.argv[2] || '5000';

const toPidListWindows = (output) => {
  const lines = output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const pids = new Set();

  for (const line of lines) {
    const cols = line.split(/\s+/);
    const isListening = cols.includes('LISTENING');
    const pid = cols[cols.length - 1];
    if (isListening && /^\d+$/.test(pid)) pids.add(Number(pid));
  }

  return [...pids];
};

const freePortWindows = (targetPort) => {
  let output = '';
  try {
    output = execSync(`netstat -ano | findstr :${targetPort}`, { encoding: 'utf8' });
  } catch (_) {
    return;
  }

  const pids = toPidListWindows(output).filter((pid) => pid !== process.pid);
  for (const pid of pids) {
    try {
      execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
      console.log(`[free-port] Killed PID ${pid} on port ${targetPort}`);
    } catch (_) {}
  }
};

const freePortUnix = (targetPort) => {
  let output = '';
  try {
    output = execSync(`lsof -ti tcp:${targetPort}`, { encoding: 'utf8' });
  } catch (_) {
    return;
  }

  const pids = output
    .split(/\r?\n/)
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => Number(value))
    .filter((pid) => Number.isInteger(pid) && pid !== process.pid);

  for (const pid of pids) {
    try {
      process.kill(pid, 'SIGKILL');
      console.log(`[free-port] Killed PID ${pid} on port ${targetPort}`);
    } catch (_) {}
  }
};

if (process.platform === 'win32') {
  freePortWindows(port);
} else {
  freePortUnix(port);
}

console.log(`[free-port] Port ${port} cleanup complete.`);
