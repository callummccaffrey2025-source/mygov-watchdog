import { readFileSync, writeFileSync } from 'fs';

const file = 'src/app/page.tsx';
let s = readFileSync(file, 'utf8');

const before = s;
s = s.replace(/href="#mps"/g, 'href="/mps"')
     .replace(/href="#bills"/g, 'href="/bills"')
     .replace(/href="#pricing"/g, 'href="/pricing"')
     .replace(/href="#join"/g, 'href="/join"');

if (s !== before) {
  writeFileSync(file, s);
  console.log('Patched link anchors → real routes in src/app/page.tsx');
} else {
  console.log('No anchor links found to patch (already correct).');
}
