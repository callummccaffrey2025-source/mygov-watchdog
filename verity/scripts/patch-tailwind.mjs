import { readFileSync, writeFileSync, existsSync } from "fs";
const p = "tailwind.config.js";
if (!existsSync(p)) process.exit(0);
let s = readFileSync(p, "utf8");
s = s.replace(
  /content:\s*\[[^\]]*\]/m,
  'content: ["./src/app/**/*.{js,ts,jsx,tsx,mdx}","./src/components/**/*.{js,ts,jsx,tsx,mdx}","./src/**/*.{js,ts,jsx,tsx,mdx}"]'
);
writeFileSync(p, s);
console.log("patched:", p);
