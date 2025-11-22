#!/usr/bin/env node

/**
 * Update manifest.json, versions.json, and CHANGELOG.md to match package.json version
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

// Update CHANGELOG.md - convert [Unreleased] to new version
const changelogPath = path.join(__dirname, '..', 'CHANGELOG.md');
if (fs.existsSync(changelogPath)) {
	let changelog = fs.readFileSync(changelogPath, 'utf8');
	const today = new Date().toISOString().split('T')[0];

	// Check if this version already exists in CHANGELOG
	const versionExistsPattern = new RegExp(`^## \\[${version.replace(/\./g, '\\.')}\\]`, 'm');
	if (versionExistsPattern.test(changelog)) {
		console.log(`ℹ️  CHANGELOG.md: Version ${version} already exists, skipping update`);
	} else {
		// Check if [Unreleased] section exists and has content
		const unreleasedPattern = /^## \[Unreleased\]\s*\n([\s\S]*?)(?=\n---\n)/m;
		const match = changelog.match(unreleasedPattern);

		if (match && match[1].trim() && !match[1].includes('Planned Features')) {
			// There is actual release content in [Unreleased], convert it to new version
			
			// Find where to insert the new version (after the header separator)
			const headerSeparatorPattern = /^---\s*\n/m;
			const headerMatch = changelog.match(headerSeparatorPattern);
			
			if (headerMatch) {
				const insertPosition = headerMatch.index + headerMatch[0].length;
				const newVersionSection = `\n## [${version}] - ${today}\n${match[1].trim()}\n\n---\n`;
				
				// Remove the old [Unreleased] section
				changelog = changelog.replace(unreleasedPattern, '');
				
				// Insert new version section after header
				changelog = changelog.slice(0, insertPosition) + newVersionSection + changelog.slice(insertPosition);
				
				// Update Version History section
				const versionHistoryPattern = /(## Version History\s*\n\s*\n)/;
				if (versionHistoryPattern.test(changelog)) {
					changelog = changelog.replace(
						versionHistoryPattern,
						`$1- **${version}** (${today}) - [Add brief description here]\n`
					);
				}
				
				fs.writeFileSync(changelogPath, changelog, 'utf8');
				console.log(`✓ Updated CHANGELOG.md: [Unreleased] → [${version}]`);
				console.log('  ⚠️  Please update the version description in Version History section');
			} else {
				console.log('⚠️  Could not find header separator in CHANGELOG.md');
			}
		} else {
			console.log('ℹ️  CHANGELOG.md: No [Unreleased] content to convert');
			console.log('  Please manually add release notes for version ' + version);
		}
	}
} else {
	console.log('⚠️  CHANGELOG.md not found');
}
