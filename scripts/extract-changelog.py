#!/usr/bin/env python3
"""
Extract changelog for a specific version from CHANGELOG.md
"""
import sys
import re

def extract_version_changelog(changelog_path, version):
    """Extract changelog content for a specific version"""
    with open(changelog_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Remove 'v' prefix if present (e.g., v1.3.0 -> 1.3.0)
    version = version.lstrip('v')

    # Pattern to match version section
    version_pattern = rf'## \[{re.escape(version)}\].*?\n(.*?)(?=\n## \[|\Z)'
    match = re.search(version_pattern, content, re.DOTALL)

    if not match:
        print(f"Version {version} not found in changelog", file=sys.stderr)
        sys.exit(1)

    changelog_content = match.group(1).strip()

    # Remove the separator line at the end if present
    changelog_content = re.sub(r'\n---\s*$', '', changelog_content)

    return changelog_content

if __name__ == '__main__':
    if len(sys.argv) != 3:
        print("Usage: extract-changelog.py <changelog_path> <version>", file=sys.stderr)
        sys.exit(1)

    changelog_path = sys.argv[1]
    version = sys.argv[2]

    changelog = extract_version_changelog(changelog_path, version)
    print(changelog)
