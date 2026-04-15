#!/usr/bin/env node
/**
 * verify-icon.js — Check app icon meets App Store requirements
 * Verifies: 1024x1024, PNG, no alpha channel (RGB not RGBA)
 * If alpha exists, creates a flattened version at assets/icon-appstore.png
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const ICON_PATH = path.join(__dirname, '..', 'assets', 'icon.png');
const OUTPUT_PATH = path.join(__dirname, '..', 'assets', 'icon-appstore.png');

async function main() {
  console.log('=== App Icon Verification ===\n');

  // Check file exists
  if (!fs.existsSync(ICON_PATH)) {
    console.log('FAIL: assets/icon.png does not exist');
    process.exit(1);
  }
  console.log('PASS: assets/icon.png exists');

  const metadata = await sharp(ICON_PATH).metadata();

  // Check dimensions
  if (metadata.width === 1024 && metadata.height === 1024) {
    console.log(`PASS: Dimensions are ${metadata.width}x${metadata.height}`);
  } else {
    console.log(`FAIL: Dimensions are ${metadata.width}x${metadata.height} (need 1024x1024)`);
  }

  // Check format
  if (metadata.format === 'png') {
    console.log('PASS: Format is PNG');
  } else {
    console.log(`FAIL: Format is ${metadata.format} (need PNG)`);
  }

  // Check alpha channel
  const hasAlpha = metadata.hasAlpha;
  if (!hasAlpha) {
    console.log('PASS: No alpha channel (RGB)');
  } else {
    console.log('WARN: Has alpha channel (RGBA) — App Store requires RGB');
    console.log('      Creating flattened version...');

    await sharp(ICON_PATH)
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .png()
      .toFile(OUTPUT_PATH);

    const newMeta = await sharp(OUTPUT_PATH).metadata();
    console.log(`      Created assets/icon-appstore.png (${newMeta.width}x${newMeta.height}, hasAlpha: ${newMeta.hasAlpha})`);
    console.log('      Update app.json icon field to "./assets/icon-appstore.png" before submitting');
  }

  console.log('\n=== Done ===');
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
