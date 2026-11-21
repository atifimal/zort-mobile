// Builds the filled star used on Android for favorites. expo-symbols draws Android icons from
// the outlined Material Symbols font only, so a favorite's star couldn't be filled. The filled
// font has it, but it is 1.4 MB; this keeps just the star glyph (a few KB).
// Usage: npm run star-font
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

import subsetFont from 'subset-font';

const require = createRequire(import.meta.url);
const source = require.resolve('@expo-google-fonts/material-symbols/400Regular_Filled/MaterialSymbols_400Regular_Filled.ttf');
const output = new URL('../assets/fonts/star-filled.ttf', import.meta.url);

// The code point expo-symbols uses for "star" (node_modules/expo-symbols/build/android/symbols.json)
const STAR = String.fromCodePoint(0xe838);

const font = await subsetFont(readFileSync(source), STAR, { targetFormat: 'truetype' });
writeFileSync(output, font);
console.log(`${output.pathname}: ${font.length} bytes`);
