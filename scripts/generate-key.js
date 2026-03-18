/**
 * Clarifactu – License Key Generator
 * Run with: node scripts/generate-key.js [count]
 */
const crypto = require('crypto');

const LICENSE_SECRET = 'clrf-license-secret-k9x2q7w4m1';
const CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/I/1

function randomGroup() {
  let s = '';
  for (let i = 0; i < 5; i++) {
    s += CHARSET[crypto.randomInt(CHARSET.length)];
  }
  return s;
}

function generateKey() {
  const g1 = randomGroup();
  const g2 = randomGroup();
  const g3 = randomGroup();
  const g4 = randomGroup();
  const body = `${g1}-${g2}-${g3}-${g4}`;
  const check = crypto.createHmac('sha256', LICENSE_SECRET)
    .update(body)
    .digest('hex')
    .toUpperCase()
    .substring(0, 5);
  return `${body}-${check}`;
}

const count = parseInt(process.argv[2]) || 1;
console.log(`\nGenerando ${count} clave${count !== 1 ? 's' : ''} de licencia:\n`);
for (let i = 0; i < count; i++) {
  console.log('  ' + generateKey());
}
console.log('');
