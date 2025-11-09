#!/usr/bin/env node

/**
 * Coverage Gaps Analyzer
 *
 * This script analyzes test coverage to identify files with the most uncovered lines.
 * It runs vitest with JSON coverage output, then parses the results to count uncovered
 * statements per file and shows which specific lines are uncovered.
 *
 * Usage:
 *   node tools/coverage_gaps.js [--limit N] [--filter path/pattern] [--show-lines]
 *
 * Options:
 *   --limit N            Show top N files (default: 20)
 *   --filter pattern     Only show files matching pattern (e.g., "src/components")
 *   --show-lines         Show uncovered line numbers for each file
 *
 * Output:
 *   Lists files sorted by number of uncovered lines, with total lines and coverage %.
 *   Optionally shows which specific lines are uncovered.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Parse command line arguments
const args = process.argv.slice(2);
let limit = 20;
let filterPattern = null;
let showLines = false;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--limit' && args[i + 1]) {
    limit = parseInt(args[i + 1]);
    i++;
  } else if (args[i] === '--filter' && args[i + 1]) {
    filterPattern = args[i + 1];
    i++;
  } else if (args[i] === '--show-lines') {
    showLines = true;
  }
}

console.log('Running coverage analysis...');
console.log('This may take a minute...\n');

// Run vitest with JSON coverage
try {
  execSync('npx vitest --run --coverage.enabled=true --coverage.reporter=json --silent=true --reporter=dot', {
    stdio: 'ignore',
    maxBuffer: 50 * 1024 * 1024
  });
} catch (error) {
  // Vitest may exit with non-zero even on success if tests fail
  // Continue anyway as we're interested in coverage
}

// Read coverage JSON
const coveragePath = path.join(process.cwd(), 'coverage', 'coverage-final.json');
if (!fs.existsSync(coveragePath)) {
  console.error('Error: coverage/coverage-final.json not found');
  console.error('Make sure vitest coverage ran successfully');
  process.exit(1);
}

const coverage = JSON.parse(fs.readFileSync(coveragePath, 'utf-8'));

/**
 * Convert line numbers to compact ranges
 * e.g., [1,2,3,5,6,8] -> "1-3,5-6,8"
 */
function formatLineRanges(lines) {
  if (lines.length === 0) return '';

  lines.sort((a, b) => a - b);
  const ranges = [];
  let rangeStart = lines[0];
  let rangeEnd = lines[0];

  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === rangeEnd + 1) {
      rangeEnd = lines[i];
    } else {
      if (rangeStart === rangeEnd) {
        ranges.push(String(rangeStart));
      } else if (rangeEnd === rangeStart + 1) {
        ranges.push(`${rangeStart},${rangeEnd}`);
      } else {
        ranges.push(`${rangeStart}-${rangeEnd}`);
      }
      rangeStart = lines[i];
      rangeEnd = lines[i];
    }
  }

  // Add the last range
  if (rangeStart === rangeEnd) {
    ranges.push(String(rangeStart));
  } else if (rangeEnd === rangeStart + 1) {
    ranges.push(`${rangeStart},${rangeEnd}`);
  } else {
    ranges.push(`${rangeStart}-${rangeEnd}`);
  }

  return ranges.join(',');
}

// Analyze each file
const results = [];

for (const [filePath, data] of Object.entries(coverage)) {
  // Apply filter if specified
  if (filterPattern && !filePath.includes(filterPattern)) {
    continue;
  }

  // Count uncovered statements and collect line numbers
  const statements = data.s || {};
  const statementMap = data.statementMap || {};
  let totalStatements = 0;
  let uncoveredStatements = 0;
  const uncoveredLines = new Set();

  for (const [key, count] of Object.entries(statements)) {
    totalStatements++;
    if (count === 0) {
      uncoveredStatements++;

      // Get the line number for this statement
      const stmt = statementMap[key];
      if (stmt && stmt.start) {
        uncoveredLines.add(stmt.start.line);
      }
    }
  }

  // Calculate coverage percentage
  const coveragePct = totalStatements > 0
    ? ((totalStatements - uncoveredStatements) / totalStatements * 100).toFixed(2)
    : 100;

  // Get relative path for cleaner display
  const relativePath = filePath.replace(process.cwd() + '/', '');

  results.push({
    file: relativePath,
    total: totalStatements,
    uncovered: uncoveredStatements,
    covered: totalStatements - uncoveredStatements,
    coveragePct: parseFloat(coveragePct),
    uncoveredLines: Array.from(uncoveredLines)
  });
}

// Sort by uncovered statements (descending)
results.sort((a, b) => b.uncovered - a.uncovered);

// Display results
console.log('Top files with most uncovered lines:\n');
console.log('UNCOVERED\tTOTAL\tCOVERAGE\tFILE');
console.log('=========\t=====\t========\t====');

const topResults = results.slice(0, limit);
for (const result of topResults) {
  if (result.uncovered === 0) continue; // Skip fully covered files

  const uncovered = String(result.uncovered).padEnd(9);
  const total = String(result.total).padEnd(5);
  const coverage = String(result.coveragePct + '%').padEnd(8);

  console.log(`${uncovered}\t${total}\t${coverage}\t${result.file}`);

  if (showLines && result.uncoveredLines.length > 0) {
    const lineRanges = formatLineRanges(result.uncoveredLines);
    console.log(`         \t     \t        \t  Lines: ${lineRanges}`);
  }
}

console.log('\n' + '='.repeat(80));
console.log(`Showing top ${topResults.length} files with most coverage gaps`);
if (filterPattern) {
  console.log(`Filter: ${filterPattern}`);
}
if (!showLines) {
  console.log('Use --show-lines to see uncovered line numbers');
}
