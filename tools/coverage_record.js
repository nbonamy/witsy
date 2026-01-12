#!/usr/bin/env node

/**
 * Coverage History Recorder
 *
 * Records coverage metrics for the current commit to a history file.
 * Designed to run in CI after tests complete.
 *
 * Usage:
 *   node tools/coverage_record.js [--run-tests]
 *
 * Options:
 *   --run-tests    Run tests with coverage first (default: assume coverage already exists)
 *
 * Output:
 *   Appends coverage data to coverage-history.json
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Parse command line arguments
const args = process.argv.slice(2);
const runTests = args.includes('--run-tests');

const historyFile = path.join(process.cwd(), 'coverage-history.json');
const coveragePath = path.join(process.cwd(), 'coverage', 'coverage-final.json');

// Run tests if requested
if (runTests) {
  console.log('Running tests with coverage...');
  try {
    execSync('npx vitest --run --coverage.enabled=true --coverage.reporter=json --silent=true --reporter=dot', {
      stdio: 'inherit',
      maxBuffer: 50 * 1024 * 1024
    });
  } catch (error) {
    console.error('Tests failed, but continuing to record coverage...');
  }
}

// Check coverage file exists
if (!fs.existsSync(coveragePath)) {
  console.error('Error: coverage/coverage-final.json not found');
  console.error('Run tests with coverage first: npm run test:ci');
  process.exit(1);
}

// Get git info
function getGitInfo() {
  try {
    const hash = execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim();
    const shortHash = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
    const message = execSync('git log -1 --pretty=%s', { encoding: 'utf-8' }).trim();
    const author = execSync('git log -1 --pretty=%an', { encoding: 'utf-8' }).trim();
    const branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim();
    return { hash, shortHash, message, author, branch };
  } catch (error) {
    console.error('Error getting git info:', error.message);
    return { hash: 'unknown', shortHash: 'unknown', message: 'unknown', author: 'unknown', branch: 'unknown' };
  }
}

// Calculate coverage metrics from coverage-final.json
function calculateCoverage() {
  const coverage = JSON.parse(fs.readFileSync(coveragePath, 'utf-8'));

  let totalStatements = 0;
  let coveredStatements = 0;
  let totalBranches = 0;
  let coveredBranches = 0;
  let totalFunctions = 0;
  let coveredFunctions = 0;
  let totalLines = 0;
  let coveredLines = 0;

  for (const data of Object.values(coverage)) {
    // Statements
    const statements = data.s || {};
    for (const count of Object.values(statements)) {
      totalStatements++;
      if (count > 0) coveredStatements++;
    }

    // Branches
    const branches = data.b || {};
    for (const branchCounts of Object.values(branches)) {
      for (const count of branchCounts) {
        totalBranches++;
        if (count > 0) coveredBranches++;
      }
    }

    // Functions
    const functions = data.f || {};
    for (const count of Object.values(functions)) {
      totalFunctions++;
      if (count > 0) coveredFunctions++;
    }

    // Lines (using statementMap to get unique lines)
    const lineHits = {};
    const statementMap = data.statementMap || {};
    for (const [key, count] of Object.entries(statements)) {
      const stmt = statementMap[key];
      if (stmt && stmt.start) {
        const line = stmt.start.line;
        if (lineHits[line] === undefined) {
          lineHits[line] = count > 0;
        } else {
          lineHits[line] = lineHits[line] || count > 0;
        }
      }
    }
    for (const hit of Object.values(lineHits)) {
      totalLines++;
      if (hit) coveredLines++;
    }
  }

  const pct = (covered, total) => total > 0 ? Math.round((covered / total) * 10000) / 100 : 100;

  return {
    statements: { covered: coveredStatements, total: totalStatements, pct: pct(coveredStatements, totalStatements) },
    branches: { covered: coveredBranches, total: totalBranches, pct: pct(coveredBranches, totalBranches) },
    functions: { covered: coveredFunctions, total: totalFunctions, pct: pct(coveredFunctions, totalFunctions) },
    lines: { covered: coveredLines, total: totalLines, pct: pct(coveredLines, totalLines) }
  };
}

// Load existing history or create new
function loadHistory() {
  if (fs.existsSync(historyFile)) {
    try {
      return JSON.parse(fs.readFileSync(historyFile, 'utf-8'));
    } catch (error) {
      console.error('Error reading history file, starting fresh:', error.message);
      return [];
    }
  }
  return [];
}

// Main
const gitInfo = getGitInfo();
const metrics = calculateCoverage();
const history = loadHistory();

// Check if this commit is already recorded
const existingIndex = history.findIndex(entry => entry.commit === gitInfo.hash);
if (existingIndex >= 0) {
  console.log(`Commit ${gitInfo.shortHash} already recorded, updating...`);
  history.splice(existingIndex, 1);
}

// Create new entry
const entry = {
  timestamp: new Date().toISOString(),
  commit: gitInfo.hash,
  author: gitInfo.author,
  coverage: {
    statements: metrics.statements.pct,
    branches: metrics.branches.pct,
    functions: metrics.functions.pct,
    lines: metrics.lines.pct
  }
};

history.unshift(entry);

// Save history
fs.writeFileSync(historyFile, JSON.stringify(history, null, 2) + '\n');

console.log(`\nCoverage recorded for commit ${gitInfo.shortHash}:`);
console.log(`  Statements: ${metrics.statements.pct}% (${metrics.statements.covered}/${metrics.statements.total})`);
console.log(`  Branches:   ${metrics.branches.pct}% (${metrics.branches.covered}/${metrics.branches.total})`);
console.log(`  Functions:  ${metrics.functions.pct}% (${metrics.functions.covered}/${metrics.functions.total})`);
console.log(`  Lines:      ${metrics.lines.pct}% (${metrics.lines.covered}/${metrics.lines.total})`);
console.log(`\nHistory saved to ${historyFile}`);
