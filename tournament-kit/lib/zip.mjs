// Small deterministic ZIP writer, stored entries, UTF-8 names, no ZIP64.
const table = Uint32Array.from({ length: 256 }, (_, n) => {
  let c = n; for (let i = 0; i < 8; i++) c = c & 1 ? 0xedb88320 ^ c >>> 1 : c >>> 1; return c >>> 0;
});
export function crc32(bytes) { let c = 0xffffffff; for (const b of bytes) c = table[(c ^ b) & 255] ^ c >>> 8; return (c ^ 0xffffffff) >>> 0; }
export function zip(entries) {
  if (entries.length > 65535) throw new Error("Too many ZIP entries");
  const files = [], directory = []; let offset = 0;
  for (const [name, content] of entries.toSorted(([a], [b]) => a.localeCompare(b))) {
    if (name.startsWith("/") || name.includes("\\") || name.split("/").some(p => !p || p === "." || p === "..")) throw new Error("Unsafe archive path");
    const path = Buffer.from(name), bytes = Buffer.from(content), crc = crc32(bytes);
    if (bytes.length > 0xffffffff || path.length > 65535) throw new Error("ZIP entry too large");
    const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x800, 6); local.writeUInt16LE(33, 12);
    local.writeUInt32LE(crc, 14); local.writeUInt32LE(bytes.length, 18); local.writeUInt32LE(bytes.length, 22); local.writeUInt16LE(path.length, 26);
    const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(0x800, 8); central.writeUInt16LE(33, 14);
    central.writeUInt32LE(crc, 16); central.writeUInt32LE(bytes.length, 20); central.writeUInt32LE(bytes.length, 24); central.writeUInt16LE(path.length, 28); central.writeUInt32LE(offset, 42);
    files.push(local, path, bytes); directory.push(central, path); offset += local.length + path.length + bytes.length;
  }
  const central = Buffer.concat(directory), end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(central.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...files, central, end]);
}
