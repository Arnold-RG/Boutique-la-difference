'use strict';

const { hashPassword } = require('./passwords');

function readSecret(prompt) {
  return new Promise((resolve, reject) => {
    const stdin = process.stdin;
    const stdout = process.stderr;
    stdout.write(prompt);
    if (!stdin.isTTY) {
      let data = '';
      stdin.setEncoding('utf8');
      stdin.on('data', (chunk) => { data += chunk; });
      stdin.on('end', () => resolve(data.replace(/\r?\n$/, '')));
      return;
    }
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    let buf = '';
    const onData = (chunk) => {
      for (const ch of chunk) {
        if (ch === '\u0003') {
          stdin.setRawMode(false);
          stdout.write('\n');
          process.exit(1);
        }
        if (ch === '\r' || ch === '\n') {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.removeListener('data', onData);
          stdout.write('\n');
          resolve(buf);
          return;
        }
        if (ch === '\u007f' || ch === '\b') {
          buf = buf.slice(0, -1);
          continue;
        }
        buf += ch;
      }
    };
    stdin.on('data', onData);
    stdin.on('error', reject);
  });
}

async function main() {
  const password = await readSecret('New admin password (it will not be shown): ');
  if (!password || password.length < 12) {
    process.stderr.write('Use at least 12 characters.\n');
    process.exit(1);
  }
  const again = await readSecret('Type it again: ');
  if (again !== password) {
    process.stderr.write('The two entries did not match.\n');
    process.exit(1);
  }
  const hash = await hashPassword(password);
  process.stderr.write('Put this line in ADMIN_PASSWORD_HASH. Do not commit it.\n');
  process.stdout.write(hash + '\n');
}

main().catch((err) => {
  process.stderr.write(String(err && err.message ? err.message : err) + '\n');
  process.exit(1);
});
