#!/usr/bin/env node

/**
 * Update manifest.json version to match package.json
 * This script runs during npm version command via the "version" hook
 */

const fs = require('fs');
const path = require('path');

// Read package.json
const packagePath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
const version = packageJson.version;

// Update manifest.json
const manifestPath = path.join(__dirname, '..', 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
manifest.version = version;
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, '\t') + '\n');

console.log(`✓ Updated manifest.json to version ${version}`);

// Update versions.json (for Obsidian plugin versioning)
const versionsPath = path.join(__dirname, '..', 'versions.json');
let versions = {};

if (fs.existsSync(versionsPath)) {
	versions = JSON.parse(fs.readFileSync(versionsPath, 'utf8'));
}

// Add new version with minAppVersion from manifest
versions[version] = manifest.minAppVersion;
fs.writeFileSync(versionsPath, JSON.stringify(versions, null, '\t') + '\n');

console.log(`✓ Updated versions.json with version ${version}`);
