import { readdirSync, readFileSync, writeFileSync, statSync } from 'fs';
import { join } from 'path';

const ROOT = 'src';

const exts = new Set(['.ts', '.tsx', '.js', '.jsx']);
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) walk(p);
    else {
      const m = p.match(/\.(tsx?|jsx?)$/);
      if (!m) continue;
      let text = readFileSync(p, 'utf8');
      const before = text;
      // normalize to alias and PascalCase
      text = text.replace(/from\s+['"][^'"]*components\/related-search['"]/g, "from '@/components/RelatedSearch'");
      text = text.replace(/from\s+['"][^'"]*components\/RelatedSearch['"]/g, "from '@/components/RelatedSearch'");
      if (text !== before) {
        writeFileSync(p, text);
        console.log('Rewired:', p);
      }
    }
  }
}
walk(ROOT);
console.log('Done.');
