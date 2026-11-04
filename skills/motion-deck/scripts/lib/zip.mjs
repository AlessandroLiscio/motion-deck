// Minimal ZIP container (PKZIP 2.0, no ZIP64, no encryption) for the .pptx export, and a reader that checks it back. Node built-ins only.
import { crc32, deflateRawSync, inflateRawSync } from 'node:zlib';

const LOCAL = 0x04034b50;
const CENTRAL = 0x02014b50;
const END = 0x06054b50;
const LIMIT = 0xffffffff; // ZIP64 would be needed above this, or above 65535 entries
export const MAX_ENTRY_BYTES = 1 << 30; // the reader refuses to inflate more than 1 GiB for one entry

function dosTime(date) {
  const d = date.getFullYear() < 1980 ? new Date(1980, 0, 1) : date;
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
    date: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

// entries: [{ name, data: Buffer|string, store?: boolean }]. Calls sink(Buffer) in order, returns the total size.
// store: true writes the bytes as they are (for images that are already compressed); the rest is deflated.
export function writeZip(entries, sink, { now = new Date() } = {}) {
  if (entries.length > 0xffff) throw new Error(`a zip with ${entries.length} entries needs ZIP64, which is not supported`);
  const stamp = dosTime(now);
  const central = [];
  let offset = 0;
  const put = (buf) => { sink(buf); offset += buf.length; };
  const names = new Set();
  for (const e of entries) {
    if (names.has(e.name)) throw new Error(`duplicate zip entry ${e.name}`);
    names.add(e.name);
    const name = Buffer.from(e.name, 'utf8');
    const raw = Buffer.isBuffer(e.data) ? e.data : Buffer.from(e.data, 'utf8');
    const stored = e.store === true || raw.length === 0;
    const body = stored ? raw : deflateRawSync(raw, { level: 9 });
    const crc = crc32(raw);
    if (raw.length > LIMIT || body.length > LIMIT || offset > LIMIT) throw new Error(`${e.name} needs ZIP64, which is not supported`);
    const head = Buffer.alloc(30);
    head.writeUInt32LE(LOCAL, 0);
    head.writeUInt16LE(stored ? 10 : 20, 4); // version needed
    head.writeUInt16LE(0x0800, 6); // names are UTF-8
    head.writeUInt16LE(stored ? 0 : 8, 8);
    head.writeUInt16LE(stamp.time, 10);
    head.writeUInt16LE(stamp.date, 12);
    head.writeUInt32LE(crc, 14);
    head.writeUInt32LE(body.length, 18);
    head.writeUInt32LE(raw.length, 22);
    head.writeUInt16LE(name.length, 26);
    central.push({ name, crc, method: stored ? 0 : 8, csize: body.length, usize: raw.length, offset });
    put(head);
    put(name);
    put(body);
  }
  const start = offset;
  for (const c of central) {
    const rec = Buffer.alloc(46);
    rec.writeUInt32LE(CENTRAL, 0);
    rec.writeUInt16LE(20, 4); // version made by
    rec.writeUInt16LE(c.method === 0 ? 10 : 20, 6);
    rec.writeUInt16LE(0x0800, 8);
    rec.writeUInt16LE(c.method, 10);
    rec.writeUInt16LE(stamp.time, 12);
    rec.writeUInt16LE(stamp.date, 14);
    rec.writeUInt32LE(c.crc, 16);
    rec.writeUInt32LE(c.csize, 20);
    rec.writeUInt32LE(c.usize, 24);
    rec.writeUInt16LE(c.name.length, 28);
    rec.writeUInt32LE(c.offset, 42);
    put(rec);
    put(c.name);
  }
  const size = offset - start;
  if (offset > LIMIT) throw new Error('the zip is over 4 GiB, which needs ZIP64 and is not supported');
  const end = Buffer.alloc(22);
  end.writeUInt32LE(END, 0);
  end.writeUInt16LE(central.length, 8);
  end.writeUInt16LE(central.length, 10);
  end.writeUInt32LE(size, 12);
  end.writeUInt32LE(start, 16);
  put(end);
  return offset;
}

export function zipToBuffer(entries, options) {
  const chunks = [];
  writeZip(entries, (b) => chunks.push(b), options);
  return Buffer.concat(chunks);
}

// Parses a zip held in memory. Returns { entries: [{ name, method, crc, csize, usize, offset }], read(name): Buffer }.
// Throws on a malformed container; read() throws when the CRC or the size does not match.
export function readZip(buf) {
  const tail = Math.max(0, buf.length - 22 - 0xffff);
  let eocd = -1;
  for (let i = buf.length - 22; i >= tail; i--) {
    if (buf.readUInt32LE(i) === END) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('not a zip: no end-of-central-directory record');
  const count = buf.readUInt16LE(eocd + 10);
  const cdSize = buf.readUInt32LE(eocd + 12);
  const cdStart = buf.readUInt32LE(eocd + 16);
  if (cdStart + cdSize > eocd) throw new Error('zip central directory is out of range');
  const entries = [];
  let p = cdStart;
  for (let i = 0; i < count; i++) {
    if (p + 46 > buf.length || buf.readUInt32LE(p) !== CENTRAL) throw new Error(`zip central directory entry ${i} is malformed`);
    const nameLen = buf.readUInt16LE(p + 28);
    const extra = buf.readUInt16LE(p + 30) + buf.readUInt16LE(p + 32);
    const flags = buf.readUInt16LE(p + 8);
    if (flags & 1) throw new Error('encrypted zip entries are not supported');
    entries.push({
      name: buf.toString('utf8', p + 46, p + 46 + nameLen),
      method: buf.readUInt16LE(p + 10), crc: buf.readUInt32LE(p + 16), csize: buf.readUInt32LE(p + 20), usize: buf.readUInt32LE(p + 24), offset: buf.readUInt32LE(p + 42),
    });
    p += 46 + nameLen + extra;
  }
  const byName = new Map(entries.map((e) => [e.name, e]));
  const read = (name) => {
    const e = byName.get(name);
    if (!e) throw new Error(`no zip entry ${name}`);
    if (e.offset + 30 > buf.length || buf.readUInt32LE(e.offset) !== LOCAL) throw new Error(`${name}: local header is malformed`);
    const start = e.offset + 30 + buf.readUInt16LE(e.offset + 26) + buf.readUInt16LE(e.offset + 28);
    if (start + e.csize > eocd) throw new Error(`${name}: data runs past the central directory`);
    if (e.usize > MAX_ENTRY_BYTES) throw new Error(`${name}: ${e.usize} bytes is over the reader's limit`);
    const body = buf.subarray(start, start + e.csize);
    let data;
    if (e.method === 0) data = body;
    else if (e.method === 8) data = inflateRawSync(body, { maxOutputLength: e.usize });
    else throw new Error(`${name}: unsupported compression method ${e.method}`);
    if (data.length !== e.usize) throw new Error(`${name}: size ${data.length} but the directory says ${e.usize}`);
    if (crc32(data) !== e.crc) throw new Error(`${name}: CRC mismatch`);
    return data;
  };
  return { entries, read };
}
