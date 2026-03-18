/**
 * Clarifactu – Convert existing assets/icon.png to multi-size assets/icon.ico
 * Run with: electron scripts/png-to-ico.js
 */
const { app, nativeImage } = require('electron');
const fs = require('fs');
const path = require('path');

app.whenReady().then(() => {
  const pngPath = path.join(__dirname, '..', 'assets', 'icon.png');
  const icoPath = path.join(__dirname, '..', 'assets', 'icon.ico');

  const source = nativeImage.createFromPath(pngPath);
  if (source.isEmpty()) {
    console.error('ERROR: could not load', pngPath);
    app.quit();
    return;
  }

  const sizes = [256, 128, 64, 48, 32, 16];
  const images = sizes.map(s => ({
    size: s,
    data: source.resize({ width: s, height: s, quality: 'best' }).toPNG()
  }));

  const ico = buildICO(images);
  fs.writeFileSync(icoPath, ico);
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
