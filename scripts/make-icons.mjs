// Generates original NightLens icons (crescent + lens ring) as PNGs with no dependencies.
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};

function render(size) {
  const px = Buffer.alloc(size * size * 4);
  const SS = 4; // supersampling
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let r = 0, g = 0, b = 0, a = 0;
    for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
      const u = (x + (sx + 0.5) / SS) / size - 0.5;
      const v = (y + (sy + 0.5) / SS) / size - 0.5;
      let col = null;
      const inRound = Math.max(Math.abs(u), Math.abs(v)) < 0.5 && Math.hypot(Math.max(Math.abs(u) - 0.3, 0), Math.max(Math.abs(v) - 0.3, 0)) < 0.2;
      if (inRound) {
        col = [27, 29, 33];
        const d = Math.hypot(u, v);
        const moon = d < 0.3 && Math.hypot(u - 0.13, v + 0.08) > 0.24;
        const ring = d > 0.36 && d < 0.41;
        if (moon || ring) col = [122, 183, 255];
      }
      if (col) { r += col[0]; g += col[1]; b += col[2]; a += 255; }
    }
    const n = SS * SS, i = (y * size + x) * 4;
    const cov = a / 255;
    px[i] = cov ? r / cov : 0; px[i + 1] = cov ? g / cov : 0; px[i + 2] = cov ? b / cov : 0; px[i + 3] = a / n;
  }
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) { raw[y * (size * 4 + 1)] = 0; px.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

export function makeIcons(outDir) {
  mkdirSync(outDir, { recursive: true });
  for (const s of [16, 48, 128]) writeFileSync(`${outDir}/icon-${s}.png`, render(s));
}
if (import.meta.url === `file://${process.argv[1]}`) makeIcons(process.argv[2] ?? 'dist/icons');
