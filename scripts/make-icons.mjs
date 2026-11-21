// Builds the Zort app icons from zort.ing's logo (public/favicon.svg).
// Usage: npm run icons  (node scripts/make-icons.mjs <favicon.svg> <output assets dir>)
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Resvg } from '@resvg/resvg-js';

const [source, outDir] = process.argv.slice(2);
const raw = readFileSync(source, 'utf8');
const inner = raw.slice(raw.indexOf('>') + 1, raw.lastIndexOf('</svg>'));

// Single-colour version for Android's themed icons: no drop shadow, only the outline, so the
// letters stay readable as shapes cut out of it
const monoInner = inner
  .replace(/<path fill="#9a3412"[^>]*\/>/g, '')
  .replace(/fill="#ffd43b"/g, 'fill="none"')
  .replace(/stroke="#e8590c"/g, 'stroke="#000000"');

const BG = '#f6f8fa';
const SIZE = 1024;

// Bounding box of the drawn logo inside its 64×64 box, so it can be centred exactly
const bbox = new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${inner}</svg>`).getBBox();
const cx = bbox.x + bbox.width / 2;
const cy = bbox.y + bbox.height / 2;
const longest = Math.max(bbox.width, bbox.height);

function render(name, { logo = inner, width, background, size = SIZE }) {
  const scale = (width * size) / longest;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    ${background ? `<rect width="${size}" height="${size}" fill="${background}"/>` : ''}
    <g transform="translate(${size / 2} ${size / 2}) scale(${scale}) translate(${-cx} ${-cy})">${logo}</g>
  </svg>`;
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng();
  writeFileSync(join(outDir, name), png);
  console.log(name);
}

// iOS / legacy icon: full-bleed square, the system rounds the corners
render('icon.png', { width: 0.7, background: BG });
// Android adaptive icon: the logo must stay inside the central safe zone (66% circle)
render('android-icon-foreground.png', { width: 0.46 });
render('android-icon-monochrome.png', { logo: monoInner, width: 0.46 });
render('android-icon-background.png', { width: 0, logo: '', background: BG });
render('splash-icon.png', { width: 0.9 });
// Header logo inside the app
render('logo.png', { width: 1, size: 512 });
