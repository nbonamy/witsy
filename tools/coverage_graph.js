#!/usr/bin/env node

/**
 * Coverage History Graph
 *
 * Draws an ASCII graph of coverage evolution in the terminal.
 *
 * Usage:
 *   node tools/coverage_graph.js [--metric statements|branches|functions|lines] [--limit N]
 *
 * Options:
 *   --metric    Which metric to graph (default: statements)
 *   --limit     Number of commits to show (default: auto-fit terminal)
 */

const fs = require('fs');
const path = require('path');

// Parse arguments
const args = process.argv.slice(2);
let metric = 'statements';
let limit = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--metric' && args[i + 1]) {
    metric = args[i + 1];
    i++;
  } else if (args[i] === '--limit' && args[i + 1]) {
    limit = parseInt(args[i + 1]);
    i++;
  }
}

// Load history
const historyFile = path.join(process.cwd(), 'coverage-history.json');
if (!fs.existsSync(historyFile)) {
  console.error('Error: coverage-history.json not found');
  process.exit(1);
}

let history = JSON.parse(fs.readFileSync(historyFile, 'utf-8'));

// History is newest-first, reverse for chronological display
history = history.slice().reverse();

// Terminal dimensions
const termWidth = process.stdout.columns || 80;
const termHeight = process.stdout.rows || 24;

// Graph dimensions
const graphHeight = Math.min(20, termHeight - 8);
const labelWidth = 8; // "100.00% "
const graphWidth = termWidth - labelWidth - 2;

// Limit data points to fit
if (limit) {
  history = history.slice(-limit);
} else {
  history = history.slice(-graphWidth);
}

if (history.length === 0) {
  console.log('No coverage history to display');
  process.exit(0);
}

// Extract values
const values = history.map(entry => entry.coverage[metric]);
const commits = history.map(entry => entry.commit.substring(0, 7));

// Calculate range (with some padding)
const minVal = Math.max(0, Math.floor(Math.min(...values) - 2));
const maxVal = Math.min(100, Math.ceil(Math.max(...values) + 2));
const range = maxVal - minVal || 1;

// Map value to row (0 = bottom, graphHeight-1 = top)
const valueToRow = (val) => Math.round(((val - minVal) / range) * (graphHeight - 1));

// Build the graph
const graph = [];
for (let row = 0; row < graphHeight; row++) {
  graph[row] = new Array(history.length).fill(' ');
}

// Plot points and connect them
for (let col = 0; col < history.length; col++) {
  const row = valueToRow(values[col]);
  graph[row][col] = '●';

  // Connect to previous point
  if (col > 0) {
    const prevRow = valueToRow(values[col - 1]);
    if (prevRow !== row) {
      const minRow = Math.min(row, prevRow);
      const maxRow = Math.max(row, prevRow);
      for (let r = minRow + 1; r < maxRow; r++) {
        if (graph[r][col - 1] === ' ') graph[r][col - 1] = '│';
      }
    }
  }
}

// Print header
console.log();
console.log(`  Coverage History: ${metric}`);
console.log(`  ${'─'.repeat(Math.min(history.length + labelWidth, termWidth - 4))}`);

// Print graph (top to bottom)
for (let row = graphHeight - 1; row >= 0; row--) {
  const labelVal = minVal + (row / (graphHeight - 1)) * range;
  const label = (row === graphHeight - 1 || row === 0 || row === Math.floor(graphHeight / 2))
    ? `${labelVal.toFixed(1)}%`.padStart(7)
    : '       ';

  const line = graph[row].join('');
  console.log(`${label} │${line}`);
}

// Print x-axis
console.log(`${'       '} └${'─'.repeat(history.length)}`);

// Print commit labels (sparse)
const commitLine = new Array(history.length).fill(' ');
const step = Math.max(1, Math.floor(history.length / 6));
for (let i = 0; i < history.length; i += step) {
  const commit = commits[i];
  for (let j = 0; j < commit.length && i + j < history.length; j++) {
    commitLine[i + j] = commit[j];
  }
}
console.log(`${'       '}  ${commitLine.join('')}`);

// Print summary
console.log();
const latest = values[values.length - 1];
const oldest = values[0];
const diff = latest - oldest;
const diffStr = diff >= 0 ? `+${diff.toFixed(2)}%` : `${diff.toFixed(2)}%`;
const trend = diff > 0 ? '↑' : diff < 0 ? '↓' : '→';

console.log(`  Latest: ${latest.toFixed(2)}%  |  Change: ${diffStr} ${trend}  |  Commits: ${history.length}`);
console.log();
