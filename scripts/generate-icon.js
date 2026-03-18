/**
 * Clarifactu – Icon Generator
 * Run with: npm run icon
 */
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 256, height: 256,
    show: false,
    transparent: true,
    webPreferences: { contextIsolation: false, nodeIntegration: false }
  });

  const html = `<!DOCTYPE html>
<html><body style="margin:0;overflow:hidden;background:transparent;">
<canvas id="c" width="256" height="256"></canvas>
<script>
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

const c = document.getElementById('c');
const ctx = c.getContext('2d');

// Background gradient
const grad = ctx.createLinearGradient(0, 0, 256, 256);
grad.addColorStop(0, '#3b82f6');
grad.addColorStop(1, '#1d4ed8');
ctx.fillStyle = grad;
roundRect(ctx, 0, 0, 256, 256, 52);
ctx.fill();

// Document shadow
ctx.save();
ctx.shadowColor = 'rgba(0,0,0,0.22)';
ctx.shadowBlur = 18;
ctx.shadowOffsetY = 8;

// Document body (white)
const dx = 58, dy = 36, dw = 140, dh = 172, fold = 36;
ctx.fillStyle = '#ffffff';
ctx.beginPath();
ctx.moveTo(dx + 10, dy);
ctx.lineTo(dx + dw - fold, dy);
ctx.lineTo(dx + dw, dy + fold);
ctx.lineTo(dx + dw, dy + dh - 10);
ctx.quadraticCurveTo(dx + dw, dy + dh, dx + dw - 10, dy + dh);
ctx.lineTo(dx + 10, dy + dh);
ctx.quadraticCurveTo(dx, dy + dh, dx, dy + dh - 10);
ctx.lineTo(dx, dy + 10);
ctx.quadraticCurveTo(dx, dy, dx + 10, dy);
ctx.closePath();
ctx.fill();
ctx.restore();

// Fold triangle
ctx.fillStyle = '#dbeafe';
ctx.beginPath();
ctx.moveTo(dx + dw - fold, dy);
ctx.lineTo(dx + dw, dy + fold);
ctx.lineTo(dx + dw - fold, dy + fold);
ctx.closePath();
ctx.fill();

// Blue accent title bar
ctx.fillStyle = '#2563eb';
roundRect(ctx, dx + 18, dy + 46, dw - 54, 11, 3);
ctx.fill();

// Content lines
ctx.fillStyle = '#bfdbfe';
roundRect(ctx, dx + 18, dy + 72, dw - 28, 8, 2);
ctx.fill();
roundRect(ctx, dx + 18, dy + 87, dw - 46, 8, 2);
ctx.fill();
roundRect(ctx, dx + 18, dy + 102, dw - 36, 8, 2);
ctx.fill();

// Divider
ctx.fillStyle = '#dbeafe';
ctx.fillRect(dx + 18, dy + 118, dw - 28, 1.5);

// Total row (dark blue)
ctx.fillStyle = '#1e40af';
roundRect(ctx, dx + 18, dy + 128, dw - 28, 18, 4);
ctx.fill();

// Total row text placeholders
ctx.fillStyle = 'rgba(255,255,255,0.85)';
roundRect(ctx, dx + 24, dy + 134, 36, 6, 2);
ctx.fill();
roundRect(ctx, dx + dw - 56, dy + 134, 32, 6, 2);
ctx.fill();

// Green checkmark badge
ctx.fillStyle = '#10b981';
ctx.beginPath();
ctx.arc(dx + dw + 2, dy + dh + 2, 20, 0, Math.PI * 2);
ctx.fill();

ctx.strokeStyle = '#ffffff';
ctx.lineWidth = 4;
ctx.lineCap = 'round';
ctx.lineJoin = 'round';
ctx.beginPath();
ctx.moveTo(dx + dw - 8, dy + dh + 2);
ctx.lineTo(dx + dw + 1, dy + dh + 11);
ctx.lineTo(dx + dw + 14, dy + dh - 8);
ctx.stroke();
</script>
</body></html>`;

  await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  await new Promise(r => setTimeout(r, 800));

  // Capture at 256x256
  const full = await win.webContents.capturePage({ x: 0, y: 0, width: 256, height: 256 });

  const assetsDir = path.join(__dirname, '..', 'assets');
  if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir);

  // Save reference PNG
  fs.writeFileSync(path.join(assetsDir, 'icon.png'), full.toPNG());
  console.log('✓ assets/icon.png saved');

  // Build multi-size ICO
  const sizes = [256, 128, 64, 48, 32, 16];
  const images = sizes.map(s => ({
    size: s,
    data: s === 256 ? full.toPNG() : full.resize({ width: s, height: s, quality: 'best' }).toPNG()
  }));

  const ico = buildICO(images);
  fs.writeFileSync(path.join(assetsDir, 'icon.ico'), ico);
  console.log('✓ assets/icon.ico saved (' + sizes.join(', ') + 'px)');

  app.quit();
});

function buildICO(images) {
  const count = images.length;
  const headerSize = 6;
  const dirSize = count * 16;
  let offset = headerSize + dirSize;

  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(count, 4);

  const dirs = [], datas = [];
  for (const img of images) {
    const dir = Buffer.alloc(16);
    const s = img.size >= 256 ? 0 : img.size;
    dir.writeUInt8(s, 0);
    dir.writeUInt8(s, 1);
    dir.writeUInt8(0, 2);
    dir.writeUInt8(0, 3);
    dir.writeUInt16LE(1, 4);
    dir.writeUInt16LE(32, 6);
    dir.writeUInt32LE(img.data.length, 8);
    dir.writeUInt32LE(offset, 12);
    dirs.push(dir);
    datas.push(img.data);
    offset += img.data.length;
  }
  return Buffer.concat([header, ...dirs, ...datas]);
}
