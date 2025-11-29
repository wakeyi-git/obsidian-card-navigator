#!/usr/bin/env node
/**
 * CSS Build Script for Card Navigator
 *
 * Modes:
 *   - production: Merge critical CSS + minify + generate feature CSS modules
 *   - development: Merge critical CSS only (with comments)
 *   - analyze: Show size breakdown by section
 *   - features: Generate TypeScript module with feature CSS
 *
 * Usage:
 *   node scripts/build-css.js [production|development|analyze|features]
 */

const fs = require('fs');
const path = require('path');

const mode = process.argv[2] || 'development';
const rootDir = path.join(__dirname, '..');
const stylesDir = path.join(rootDir, 'src', 'styles');
const criticalDir = path.join(stylesDir, 'critical');
const featuresDir = path.join(stylesDir, 'features');
const outputFile = path.join(rootDir, 'styles.css');
const backupFile = path.join(rootDir, 'styles.dev.css');
const featureModuleFile = path.join(stylesDir, 'featureStyles.generated.ts');

// Critical CSS files (loaded on startup)
const criticalFiles = [
    'variables.css',
    'container.css',
    'toolbar.css',
    'cards.css',
    'search.css'
];

// Feature CSS files (lazy loaded)
const featureFiles = [
    'settings.css',
    'presets.css',
    'modals.css',
    'selection.css',
    'dragdrop.css',
    'filter.css',
    'grouping.css',
    'contextmenu.css',
    'hoveractions.css',
    'multisort.css',
    'matrix.css'
];

// Mapping from file to module name
const fileToModule = {
    'settings.css': 'settings',
    'presets.css': 'presets',
    'modals.css': 'modals',
    'selection.css': 'selection',
    'dragdrop.css': 'dragdrop',
    'filter.css': 'filter',
    'grouping.css': 'grouping',
    'contextmenu.css': 'contextmenu',
    'hoveractions.css': 'hoveractions',
    'multisort.css': 'multisort',
    'matrix.css': 'matrix'
};

console.log(`CSS Build: ${mode.toUpperCase()} mode\n`);

/**
 * Read and concatenate CSS files
 */
function readCSSFiles(directory, files) {
    let css = '';
    for (const file of files) {
        const filePath = path.join(directory, file);
        if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, 'utf8');
            css += `/* === ${file} === */\n${content}\n\n`;
        } else {
            console.warn(`  Warning: ${file} not found in ${directory}`);
        }
    }
    return css;
}

/**
 * Read a single CSS file
 */
function readCSSFile(directory, file) {
    const filePath = path.join(directory, file);
    if (fs.existsSync(filePath)) {
        return fs.readFileSync(filePath, 'utf8');
    }
    return '';
}

/**
 * Read the original styles.css (features not yet migrated)
 */
function readLegacyCSS() {
    const legacyFile = fs.existsSync(backupFile) ? backupFile : outputFile;
    if (fs.existsSync(legacyFile)) {
        return fs.readFileSync(legacyFile, 'utf8');
    }
    return '';
}

/**
 * Extract non-critical sections from legacy CSS
 */
function extractNonCriticalCSS(legacyCSS) {
    // Find where critical CSS ends (after search styles)
    const searchEnd = legacyCSS.indexOf('/* 자동완성 제안 항목');
    if (searchEnd === -1) {
        const altMarker = legacyCSS.indexOf('.filter-modal-backdrop');
        if (altMarker !== -1) {
            return legacyCSS.substring(altMarker);
        }
        return '';
    }
    return legacyCSS.substring(searchEnd);
}

/**
 * Minify CSS for production
 */
function minifyCSS(css) {
    // Remove comments
    css = css.replace(/\/\*[\s\S]*?\*\//g, '');
    // Remove excessive whitespace
    css = css.replace(/  +/g, ' ');
    css = css.replace(/\s*{\s*/g, '{');
    css = css.replace(/\s*}\s*/g, '}');
    css = css.replace(/\s*:\s*/g, ':');
    css = css.replace(/\s*;\s*/g, ';');
    css = css.replace(/\s*,\s*/g, ',');
    // Remove newlines and tabs
    css = css.replace(/[\r\n\t]+/g, '');
    // Remove trailing semicolons before }
    css = css.replace(/;}/g, '}');
    // Remove empty rules
    css = css.replace(/[^{}]+{\s*}/g, '');
    // Clean up double semicolons
    css = css.replace(/;;+/g, ';');
    return css;
}

/**
 * Escape CSS content for JavaScript string
 */
function escapeForJS(css) {
    return css
        .replace(/\\/g, '\\\\')
        .replace(/`/g, '\\`')
        .replace(/\$/g, '\\$');
}

/**
 * Generate TypeScript module with feature CSS
 */
function generateFeatureModule(minified = false) {
    console.log('Generating feature CSS TypeScript module...\n');

    const modules = {};
    let totalSize = 0;

    for (const file of featureFiles) {
        const moduleName = fileToModule[file];
        if (!moduleName) continue;

        let css = readCSSFile(featuresDir, file);
        if (!css) {
            console.warn(`  Warning: ${file} not found`);
            modules[moduleName] = '';
            continue;
        }

        if (minified) {
            css = minifyCSS(css);
        }

        const size = Buffer.byteLength(css, 'utf8');
        totalSize += size;
        console.log(`  ${file.padEnd(20)} ${(size / 1024).toFixed(2)} KB`);

        modules[moduleName] = css;
    }

    // Generate TypeScript file
    const tsContent = `/**
 * Auto-generated Feature CSS Module
 * Generated by: scripts/build-css.js
 * Do not edit manually!
 *
 * Total size: ${(totalSize / 1024).toFixed(2)} KB
 */

import { StyleLoader, FeatureStyleModule } from './StyleLoader';

const FEATURE_CSS: Record<FeatureStyleModule, string> = {
${Object.entries(modules).map(([name, css]) =>
    `    ${name}: \`${escapeForJS(css)}\``
).join(',\n')}
};

/**
 * Register all feature CSS modules with StyleLoader
 */
export function registerFeatureStyles(): void {
    StyleLoader.registerAllModuleCSS(FEATURE_CSS);
}

/**
 * Get CSS content for a specific feature module
 */
export function getFeatureCSS(module: FeatureStyleModule): string {
    return FEATURE_CSS[module] || '';
}

export { FEATURE_CSS };
`;

    fs.writeFileSync(featureModuleFile, tsContent);
    console.log(`\nGenerated: ${path.relative(rootDir, featureModuleFile)}`);
    console.log(`Total feature CSS: ${(totalSize / 1024).toFixed(2)} KB`);
}

/**
 * Analyze CSS size breakdown
 */
function analyzeCSS() {
    console.log('CSS Size Analysis:\n');

    let totalCritical = 0;
    console.log('Critical CSS:');
    for (const file of criticalFiles) {
        const filePath = path.join(criticalDir, file);
        if (fs.existsSync(filePath)) {
            const size = fs.statSync(filePath).size;
            totalCritical += size;
            console.log(`  ${file.padEnd(20)} ${(size / 1024).toFixed(2)} KB`);
        }
    }
    console.log(`  ${'TOTAL'.padEnd(20)} ${(totalCritical / 1024).toFixed(2)} KB\n`);

    let totalFeatures = 0;
    console.log('Feature CSS (lazy loadable):');
    for (const file of featureFiles) {
        const filePath = path.join(featuresDir, file);
        if (fs.existsSync(filePath)) {
            const size = fs.statSync(filePath).size;
            totalFeatures += size;
            console.log(`  ${file.padEnd(20)} ${(size / 1024).toFixed(2)} KB`);
        }
    }
    console.log(`  ${'TOTAL'.padEnd(20)} ${(totalFeatures / 1024).toFixed(2)} KB\n`);

    // Legacy file analysis
    const legacyCSS = readLegacyCSS();
    const legacySize = Buffer.byteLength(legacyCSS, 'utf8');
    console.log(`Legacy CSS (styles.dev.css): ${(legacySize / 1024).toFixed(2)} KB`);

    const nonCritical = extractNonCriticalCSS(legacyCSS);
    const nonCriticalSize = Buffer.byteLength(nonCritical, 'utf8');
    console.log(`Non-critical (legacy):       ${(nonCriticalSize / 1024).toFixed(2)} KB`);

    console.log('\n=== Summary ===');
    console.log(`Critical CSS:     ${(totalCritical / 1024).toFixed(2)} KB (initial load)`);
    console.log(`Feature CSS:      ${(totalFeatures / 1024).toFixed(2)} KB (lazy load)`);
    console.log(`Legacy remaining: ${(nonCriticalSize / 1024).toFixed(2)} KB (to migrate)`);

    if (legacySize > 0) {
        const migrated = totalCritical + totalFeatures;
        console.log(`\nMigration progress: ${((migrated / legacySize) * 100).toFixed(1)}%`);
        console.log(`Potential reduction: ${((1 - totalCritical / legacySize) * 100).toFixed(1)}% initial load`);
    }
}

/**
 * Build CSS
 */
function buildCSS() {
    // Backup original if not exists
    if (!fs.existsSync(backupFile) && fs.existsSync(outputFile)) {
        fs.copyFileSync(outputFile, backupFile);
        console.log(`  Backup created: styles.dev.css`);
    }

    // Read critical CSS
    console.log('Reading critical CSS files...');
    let criticalCSS = readCSSFiles(criticalDir, criticalFiles);
    const criticalSize = Buffer.byteLength(criticalCSS, 'utf8');
    console.log(`  Critical CSS: ${(criticalSize / 1024).toFixed(2)} KB`);

    // Read non-critical CSS from legacy file
    console.log('Reading non-critical CSS (legacy)...');
    const legacyCSS = readLegacyCSS();
    const nonCriticalCSS = extractNonCriticalCSS(legacyCSS);
    const nonCriticalSize = Buffer.byteLength(nonCriticalCSS, 'utf8');
    console.log(`  Non-critical CSS: ${(nonCriticalSize / 1024).toFixed(2)} KB`);

    // Combine
    let finalCSS = criticalCSS + '\n' + nonCriticalCSS;

    // Minify for production
    if (mode === 'production') {
        console.log('Minifying...');
        finalCSS = minifyCSS(finalCSS);

        // Also generate feature module
        console.log('\n');
        generateFeatureModule(true);
    }

    // Write output
    fs.writeFileSync(outputFile, finalCSS);

    const finalSize = Buffer.byteLength(finalCSS, 'utf8');
    const originalSize = Buffer.byteLength(legacyCSS, 'utf8');
    const savings = originalSize - finalSize;

    console.log('\nResult:');
    console.log(`  Original: ${(originalSize / 1024).toFixed(2)} KB`);
    console.log(`  Final:    ${(finalSize / 1024).toFixed(2)} KB`);
    if (savings > 0) {
        console.log(`  Saved:    ${(savings / 1024).toFixed(2)} KB (${((savings / originalSize) * 100).toFixed(1)}%)`);
    }
}

// Main
switch (mode) {
    case 'analyze':
        analyzeCSS();
        break;
    case 'features':
        generateFeatureModule(false);
        break;
    case 'production':
    case 'development':
    default:
        buildCSS();
        break;
}
