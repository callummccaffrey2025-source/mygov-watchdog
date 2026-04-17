import { readFileSync, writeFileSync, existsSync } from "fs";

const p = "src/app/layout.tsx";
if (!existsSync(p)) {
  console.log("warn: src/app/layout.tsx not found (skipped)");
  process.exit(0);
}
let s = readFileSync(p, "utf8");

// Ensure globals.css import uses @ alias
if (!s.includes('import "@/styles/globals.css"')) {
  // Try replacing any existing globals import
  const replaced = s.replace(/import\s+["']\.{1,2}\/.*globals\.css["'];?/, 'import "@/styles/globals.css";');
  if (replaced !== s) {
    s = replaced;
  } else if (!/import\s+["']@\/styles\/globals\.css["'];?/.test(s)) {
    // Inject after existing imports, or at the very top
    const m = s.match(/^(import .+\n)+/);
    if (m) s = s.replace(m[0], m[0] + 'import "@/styles/globals.css";\n');
    else s = 'import "@/styles/globals.css";\n' + s;
  }
}

// Ensure <main> has our container classes
if (!/max-w-6xl/.test(s)) {
  s = s.replace(
    /<main[^>]*>([\s\S]*?)<\/main>/,
    '<main className="mx-auto max-w-6xl px-4 py-8">$1</main>'
  );
}

writeFileSync(p, s);
console.log("patched:", p);
