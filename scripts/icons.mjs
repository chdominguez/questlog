// Renders public/icons/*.png from public/icon.svg. Run: node scripts/icons.mjs
import sharp from "sharp";
import { readFileSync } from "node:fs";

const svg = readFileSync("public/icon.svg");
// Maskable: full-bleed background, glyph shrunk into the 80% safe zone.
const maskable = Buffer.from(svg.toString()
  .replace('rx="112"', 'rx="0"')
  .replace(/<path/, '<g transform="translate(51.2 51.2) scale(.8)"><path').replace(/<\/svg>/, "</g></svg>"));
const square = Buffer.from(svg.toString().replace('rx="112"', 'rx="0"')); // iOS rounds the corners itself
const out = (name, input, size) => sharp(input, { density: 384 }).resize(size, size).png().toFile(`public/icons/${name}.png`);
await Promise.all([
  out("apple-touch-icon", square, 180), out("icon-192", svg, 192), out("icon-512", svg, 512), out("icon-512-maskable", maskable, 512),
]);
