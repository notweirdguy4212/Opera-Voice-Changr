const encoder = new TextEncoder();
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n += 1) {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  crcTable[n] = c >>> 0;
}
const crc32 = (bytes) => {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
};
const u16 = (view, offset, value) => view.setUint16(offset, value, true);
const u32 = (view, offset, value) => view.setUint32(offset, value >>> 0, true);
const concat = (parts) => {
  const size = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(size); let offset = 0;
  for (const part of parts) { out.set(part, offset); offset += part.length; }
  return out;
};

/** Creates a standards-compliant, uncompressed ZIP archive (UTF-8 filenames). */
export async function createZipStore(files) {
  const local = []; const central = []; let offset = 0;
  for (const file of files) {
    const name = encoder.encode(file.name);
    const data = file.data instanceof Uint8Array ? file.data : new Uint8Array(await file.data.arrayBuffer());
    const crc = crc32(data);
    const header = new Uint8Array(30 + name.length); const view = new DataView(header.buffer);
    u32(view, 0, 0x04034b50); u16(view, 4, 20); u16(view, 6, 0x0800); u16(view, 8, 0);
    u16(view, 10, 0); u16(view, 12, 0); u32(view, 14, crc); u32(view, 18, data.length); u32(view, 22, data.length);
    u16(view, 26, name.length); u16(view, 28, 0); header.set(name, 30);
    local.push(header, data);
    const entry = new Uint8Array(46 + name.length); const centralView = new DataView(entry.buffer);
    u32(centralView, 0, 0x02014b50); u16(centralView, 4, 20); u16(centralView, 6, 20);
    u16(centralView, 8, 0x0800); u16(centralView, 10, 0); u16(centralView, 12, 0); u16(centralView, 14, 0);
    u32(centralView, 16, crc); u32(centralView, 20, data.length); u32(centralView, 24, data.length);
    u16(centralView, 28, name.length); u16(centralView, 30, 0); u16(centralView, 32, 0);
    u16(centralView, 34, 0); u16(centralView, 36, 0); u32(centralView, 38, 0); u32(centralView, 42, offset);
    entry.set(name, 46); central.push(entry);
    offset += header.length + data.length;
  }
  const centralBytes = concat(central); const end = new Uint8Array(22); const endView = new DataView(end.buffer);
  u32(endView, 0, 0x06054b50); u16(endView, 4, 0); u16(endView, 6, 0);
  u16(endView, 8, files.length); u16(endView, 10, files.length); u32(endView, 12, centralBytes.length);
  u32(endView, 16, offset); u16(endView, 20, 0);
  return new Blob([concat([...local, centralBytes, end])], { type: 'application/zip' });
}
