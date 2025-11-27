#!/usr/bin/env node
/**
 * CSS Minification Script for Card Navigator
 *
 * Production build:
 *   - Removes all comments
 *   - Removes unnecessary whitespace
 *   - Collapses multiple blank lines
 *   - Preserves functional CSS
 *
 * Development build:
 *   - Only normalizes whitespace
 *   - Keeps comments for debugging
 *
 * Usage:
 *   node scripts/minify-css.js [production]
 */

const fs = require('fs');
const path = require('path');

const isProduction = process.argv[2] === 'production';
const inputFile = path.join(__dirname, '..', 'styles.css');
const outputFile = path.join(__dirname, '..', 'styles.css');
const backupFile = path.join(__dirname, '..', 'styles.dev.css');

console.log(`CSS Processing: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'} mode`);

// Read original CSS
let css = fs.readFileSync(inputFile, 'utf8');
const originalSize = Buffer.byteLength(css, 'utf8');

if (isProduction) {
    // Backup original for development
    if (!fs.existsSync(backupFile)) {
        fs.writeFileSync(backupFile, css);
        console.log(`  Backup created: styles.dev.css`);
    }

    // Step 1: Remove multi-line comments (/* ... */)
    // Preserve IE hacks and license comments if needed
    css = css.replace(/\/\*[\s\S]*?\*\//g, '');

    // Step 2: Remove single-line comments that might be on their own line
    // (CSS doesn't have // comments, but some preprocessors do)

    // Step 3: Remove excessive whitespace
    // - Multiple spaces to single space
    css = css.replace(/  +/g, ' ');

    // - Remove spaces around { } : ; ,
    css = css.replace(/\s*{\s*/g, '{');
    css = css.replace(/\s*}\s*/g, '}');
    css = css.replace(/\s*:\s*/g, ':');
    css = css.replace(/\s*;\s*/g, ';');
    css = css.replace(/\s*,\s*/g, ',');

    // Step 4: Remove newlines and tabs
    css = css.replace(/[\r\n\t]+/g, '');

    // Step 5: Remove trailing semicolons before }
    css = css.replace(/;}/g, '}');

    // Step 6: Remove empty rules
    css = css.replace(/[^{}]+{\s*}/g, '');

    // Step 7: Clean up any double semicolons
    css = css.replace(/;;+/g, ';');

    // Step 8: Add newlines after } for some readability
    // (Optional - comment out for maximum compression)
    // css = css.replace(/}/g, '}\n');

} else {
    // Development: Just normalize whitespace

    // Step 1: Normalize line endings
    css = css.replace(/\r\n/g, '\n');

    // Step 2: Remove trailing whitespace on each line
    css = css.replace(/[ \t]+$/gm, '');

    // Step 3: Collapse 3+ blank lines to 2
    css = css.replace(/\n{3,}/g, '\n\n');

    // Step 4: Ensure file ends with single newline
    css = css.replace(/\n*$/, '\n');
}

// Write processed CSS
fs.writeFileSync(outputFile, css);

const finalSize = Buffer.byteLength(css, 'utf8');
const savings = originalSize - finalSize;
const percentage = ((savings / originalSize) * 100).toFixed(1);

console.log(`  Original: ${(originalSize / 1024).toFixed(1)} KB`);
console.log(`  Final:    ${(finalSize / 1024).toFixed(1)} KB`);
console.log(`  Saved:    ${(savings / 1024).toFixed(1)} KB (${percentage}%)`);
