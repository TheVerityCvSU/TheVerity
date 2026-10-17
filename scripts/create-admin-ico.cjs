const fs = require('fs');
const path = require('path');

function createIcoFromPngs(pngFiles, outputPath) {
  const pngBuffers = pngFiles.map(file => {
    const buffer = fs.readFileSync(file.path);
    return {
      width: file.width,
      height: file.height,
      buffer
    };
  });

  const count = pngBuffers.length;
  const headerSize = 6;
  const dirEntrySize = 16;
  const totalHeaderSize = headerSize + count * dirEntrySize;

  let currentOffset = totalHeaderSize;
  const dirEntries = [];

  for (const item of pngBuffers) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(item.width >= 256 ? 0 : item.width, 0);   // width (0 = 256)
    entry.writeUInt8(item.height >= 256 ? 0 : item.height, 1); // height (0 = 256)
    entry.writeUInt8(0, 2);                                   // color count (0 = >= 8bpp)
    entry.writeUInt8(0, 3);                                   // reserved
    entry.writeUInt16LE(1, 4);                                // color planes
    entry.writeUInt16LE(32, 6);                               // bits per pixel
    entry.writeUInt32LE(item.buffer.length, 8);               // image data size
    entry.writeUInt32LE(currentOffset, 12);                   // offset
    dirEntries.push(entry);
    currentOffset += item.buffer.length;
  }

  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);     // reserved (must be 0)
  header.writeUInt16LE(1, 2);     // resource type: 1 = ICO
  header.writeUInt16LE(count, 4); // number of images

  const finalBuffer = Buffer.concat([
    header,
    ...dirEntries,
    ...pngBuffers.map(p => p.buffer)
  ]);

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, finalBuffer);
  console.log(`Created Admin ICO: ${outputPath} (${finalBuffer.length} bytes, ${count} frames)`);
}

const assetsDir = path.join(__dirname, '..', 'electron', 'assets');

const iconSizes = [
  { width: 256, height: 256, path: path.join(assetsDir, 'icon-admin-256.png') },
  { width: 128, height: 128, path: path.join(assetsDir, 'icon-admin-128.png') },
  { width: 64, height: 64, path: path.join(assetsDir, 'icon-admin-64.png') },
  { width: 48, height: 48, path: path.join(assetsDir, 'icon-admin-48.png') },
  { width: 32, height: 32, path: path.join(assetsDir, 'icon-admin-32.png') },
  { width: 16, height: 16, path: path.join(assetsDir, 'icon-admin-16.png') },
];

createIcoFromPngs(iconSizes, path.join(assetsDir, 'icon-admin.ico'));
