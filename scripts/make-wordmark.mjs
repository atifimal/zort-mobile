// Builds the ZORT! wordmark shown at the top of the home screen from zort.ing's header logo
// (the ZORT! part of the ZORT!.ING mark in index.html), one PNG per theme: only the drop
// shadow changes colour between them, as on the site.
// Usage: npm run wordmark  (node scripts/make-wordmark.mjs <zort.ing index.html> <output assets dir>)
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Resvg } from '@resvg/resvg-js';

const [source, outDir] = process.argv.slice(2);
const html = readFileSync(source, 'utf8');

const pathData = (cls) => {
  const match = html.match(new RegExp(`<path class="${cls}"[^>]*\\sd="([^"]+)"`));
  if (!match) throw new Error(`.${cls} not found in ${source}`);
  return match[1];
};
const rotate = html.match(/<g transform="(rotate\([^)]*\))">/)?.[1];
if (!rotate) throw new Error(`Wordmark rotation not found in ${source}`);

const zort = pathData('logo-zort');
const mark = (shadow) => `<g transform="${rotate}">
  <path fill="${shadow}" transform="translate(1.5 2)" d="${zort}"/>
  <path fill="#ffd43b" stroke="#e8590c" stroke-width="3" stroke-linejoin="round" paint-order="stroke" d="${zort}"/>
</g>`;

// Bounding box of the drawn mark (stroke included), so the PNG is cropped to it with a small margin
const probe = new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="-20 -40 100 60">${mark('#000')}</svg>`);
const box = probe.getBBox();
const pad = 2;
const x = box.x - pad;
const y = box.y - pad;
const w = box.width + pad * 2;
const h = box.height + pad * 2;

// Wide enough to stay sharp at 3x on the home screen
const WIDTH = 720;

for (const [name, shadow] of [
  ['wordmark-light.png', '#9a3412'],
  ['wordmark-dark.png', '#431407'],
]) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${w} ${h}">${mark(shadow)}</svg>`;
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: WIDTH } }).render().asPng();
  writeFileSync(join(outDir, name), png);
  console.log(name, `${WIDTH}×${Math.round((WIDTH * h) / w)}`);
}
