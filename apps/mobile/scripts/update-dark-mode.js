#!/usr/bin/env node

/**
 * Script to update remaining components to support dark mode
 * This script identifies components that haven't been updated and applies
 * the dark mode pattern automatically.
 *
 * Usage: node scripts/update-dark-mode.js
 */

const fs = require('fs');
const path = require('path');

// Color mappings from hardcoded values to theme colors
const colorMappings = {
  // Background colors
  "'#FFFFFF'": 'colors.background',
  "'#FFF'": 'colors.background',
  "'#F9F9F9'": 'colors.backgroundSecondary',
  "'#FAFAFA'": 'colors.backgroundSecondary',
  "'#F5F5F5'": 'colors.backgroundTertiary',
  "'#F2F2F7'": 'colors.borderLight',

  // Text colors
  "'#000000'": 'colors.text',
  "'#000'": 'colors.text',
  "'#1A1A1A'": 'colors.text',
  "'#666666'": 'colors.textSecondary',
  "'#666'": 'colors.textSecondary',
  "'#8E8E93'": 'colors.textTertiary',
  "'#EBEBF5'": 'colors.textSecondary',

  // Border colors
  "'#E5E5EA'": 'colors.border',
  "'#E5E5E5'": 'colors.border',

  // Brand colors
  "'#007AFF'": 'colors.primary',
  "'#E3F2FF'": 'colors.primaryLight',

  // Status colors
  "'#34C759'": 'colors.success',
  "'#FF3B30'": 'colors.error',
  "'#FF9500'": 'colors.warning',
};

// Files to process
const componentsDir = path.join(__dirname, '../src/components');
const screensDir = path.join(__dirname, '../app/(tabs)');

function getAllTsxFiles(dir) {
  const files = [];

  function traverse(currentDir) {
    const items = fs.readdirSync(currentDir);

    for (const item of items) {
      const fullPath = path.join(currentDir, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        traverse(fullPath);
      } else if (item.endsWith('.tsx')) {
        files.push(fullPath);
      }
    }
  }

  traverse(dir);
  return files;
}

function needsUpdate(content) {
  // Check if file already imports useTheme
  if (content.includes('useTheme') && content.includes('@/contexts/ThemeContext')) {
    console.log('  ✓ Already updated');
    return false;
  }

  // Check if file has any hardcoded colors
  const hasHardcodedColors = Object.keys(colorMappings).some(color =>
    content.includes(color)
  );

  if (!hasHardcodedColors) {
    console.log('  ✓ No hardcoded colors found');
    return false;
  }

  return true;
}

function updateFile(filePath) {
  console.log(`\nProcessing: ${path.basename(filePath)}`);

  let content = fs.readFileSync(filePath, 'utf8');

  if (!needsUpdate(content)) {
    return;
  }

  // Add useTheme import if not present
  if (!content.includes("import { useTheme } from '@/contexts/ThemeContext'")) {
    // Find the last import statement
    const importRegex = /^import .* from .*;$/gm;
    const imports = content.match(importRegex);

    if (imports && imports.length > 0) {
      const lastImport = imports[imports.length - 1];
      content = content.replace(
        lastImport,
        `${lastImport}\nimport { useTheme } from '@/contexts/ThemeContext';`
      );
    }
  }

  // Add useTheme hook in component if not present
  if (content.includes('export default function') || content.includes('export function')) {
    // Find function component declaration
    const funcMatch = content.match(/(export (?:default )?function \w+\([^)]*\)) \{/);

    if (funcMatch && !content.includes('const { colors } = useTheme();')) {
      const funcDeclaration = funcMatch[0];
      content = content.replace(
        funcDeclaration,
        `${funcDeclaration}\n  const { colors } = useTheme();`
      );
    }
  }

  // Replace hardcoded colors with theme colors
  Object.entries(colorMappings).forEach(([hardcoded, themeColor]) => {
    // Only replace in style objects, not in strings or other contexts
    const regex = new RegExp(`((?:color|backgroundColor|borderColor|borderTopColor|borderBottomColor):\\s*)${hardcoded.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g');
    content = content.replace(regex, `$1${themeColor}`);
  });

  // Move StyleSheet.create inside component if it's outside
  if (content.includes('const styles = StyleSheet.create({')) {
    // This is a complex transformation, skip for now
    console.log('  ⚠ Manual update needed: Move StyleSheet.create inside component');
  }

  // Write updated content
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('  ✓ Updated');
}

// Main execution
console.log('Starting dark mode update script...\n');

const componentFiles = getAllTsxFiles(componentsDir);
const screenFiles = getAllTsxFiles(screensDir);
const allFiles = [...componentFiles, ...screenFiles];

console.log(`Found ${allFiles.length} .tsx files to process\n`);

allFiles.forEach(updateFile);

console.log('\n✓ Dark mode update script completed!');
console.log('\nNote: Some files may require manual adjustments:');
console.log('1. Move StyleSheet.create inside component function');
console.log('2. Ensure colors object is destructured from useTheme()');
console.log('3. Update any conditional colors or complex color logic');
