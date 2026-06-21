import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '../public');

const BG = '#171614';
const GREEN = '#1D9E75';
const WHITE = '#faf9f6';

function iconSvg(size, maskable = false) {
  const pad = maskable ? size * 0.1 : size * 0.07;
  const fontSize = size * 0.52;
  const radius = maskable ? size * 0.22 : size * 0.2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${radius}" fill="${BG}"/>
  <text
    x="${size / 2}" y="${size / 2 + fontSize * 0.36}"
    font-family="PingFang SC, Noto Sans SC, STSong, serif"
    font-size="${fontSize}"
    font-weight="500"
    fill="${WHITE}"
    text-anchor="middle"
    dominant-baseline="auto"
  >汉</text>
  <rect x="${pad}" y="${size - pad - size * 0.045}" width="${size - pad * 2}" height="${size * 0.045}" rx="${size * 0.02}" fill="${GREEN}"/>
</svg>`;
}

async function generate(svg, outFile) {
  await sharp(Buffer.from(svg)).png().toFile(outFile);
  console.log('wrote', outFile);
}

await generate(iconSvg(192),        path.join(publicDir, 'icon-192.png'));
await generate(iconSvg(512),        path.join(publicDir, 'icon-512.png'));
await generate(iconSvg(512, true),  path.join(publicDir, 'icon-maskable.png'));
