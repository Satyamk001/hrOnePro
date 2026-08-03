/**
 * Zips the extension/ folder into public/attendance-extension.zip
 * Run with: node scripts/zip-extension.mjs
 */
import { createWriteStream, readdirSync, readFileSync, mkdirSync, existsSync } from 'fs';
import { join, relative } from 'path';
import { Buffer } from 'buffer';

const EXTENSION_DIR = 'extension';
const OUTPUT = join('public', 'attendance-extension.zip');

// Minimal ZIP file creator (no external dependencies)
class ZipWriter {
  constructor() {
    this.files = [];
    this.offset = 0;
  }

  addFile(name, data) {
    this.files.push({ name, data: Buffer.from(data), offset: this.offset });
    // local file header: 30 + name length + data length
    this.offset += 30 + Buffer.byteLength(name) + data.length;
  }

  toBuffer() {
    const parts = [];
    const centralDir = [];

    for (const file of this.files) {
      const nameBytes = Buffer.from(file.name);
      // Local file header
      const local = Buffer.alloc(30);
      local.writeUInt32LE(0x04034b50, 0); // signature
      local.writeUInt16LE(20, 4); // version needed
      local.writeUInt16LE(0, 6); // flags
      local.writeUInt16LE(0, 8); // compression (store)
      local.writeUInt16LE(0, 10); // mod time
      local.writeUInt16LE(0, 12); // mod date
      local.writeUInt32LE(crc32(file.data), 14); // crc32
      local.writeUInt32LE(file.data.length, 18); // compressed size
      local.writeUInt32LE(file.data.length, 22); // uncompressed size
      local.writeUInt16LE(nameBytes.length, 26); // name length
      local.writeUInt16LE(0, 28); // extra length
      parts.push(local, nameBytes, file.data);

      // Central directory entry
      const central = Buffer.alloc(46);
      central.writeUInt32LE(0x02014b50, 0);
      central.writeUInt16LE(20, 4);
      central.writeUInt16LE(20, 6);
      central.writeUInt16LE(0, 8);
      central.writeUInt16LE(0, 10);
      central.writeUInt16LE(0, 12);
      central.writeUInt16LE(0, 14);
      central.writeUInt32LE(crc32(file.data), 16);
      central.writeUInt32LE(file.data.length, 20);
      central.writeUInt32LE(file.data.length, 24);
      central.writeUInt16LE(nameBytes.length, 28);
      central.writeUInt16LE(0, 30);
      central.writeUInt16LE(0, 32);
      central.writeUInt16LE(0, 34);
      central.writeUInt16LE(0, 36);
      central.writeUInt32LE(0, 38);
      central.writeUInt32LE(file.offset, 42);
      centralDir.push(central, nameBytes);
    }

    const centralDirBuf = Buffer.concat(centralDir);
    const centralDirOffset = this.offset;

    // End of central directory
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(0, 4);
    end.writeUInt16LE(0, 6);
    end.writeUInt16LE(this.files.length, 8);
    end.writeUInt16LE(this.files.length, 10);
    end.writeUInt32LE(centralDirBuf.length, 12);
    end.writeUInt32LE(centralDirOffset, 16);
    end.writeUInt16LE(0, 20);

    return Buffer.concat([...parts, centralDirBuf, end]);
  }
}

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function getFiles(dir) {
  const results = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...getFiles(full));
    } else {
      results.push(full);
    }
  }
  return results;
}

// Ensure public/ exists
if (!existsSync('public')) mkdirSync('public');

const zip = new ZipWriter();
const files = getFiles(EXTENSION_DIR);

for (const file of files) {
  const name = relative(EXTENSION_DIR, file).replace(/\\/g, '/');
  const data = readFileSync(file);
  zip.addFile(name, data);
}

const { writeFileSync } = await import('fs');
writeFileSync(OUTPUT, zip.toBuffer());
console.log(`✓ Created ${OUTPUT} (${files.length} files)`);
