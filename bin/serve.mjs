#!/usr/bin/env node

/**
 * CLI entry point for attendance-insights.
 * Serves the pre-built static app on a local port.
 *
 * Usage:
 *   npx attendance-insights          (default port 3333)
 *   npx attendance-insights --port 4000
 */

import { createServer } from 'http';
import { readFileSync, existsSync, statSync } from 'fs';
import { join, extname, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST_DIR = join(__dirname, '..', 'dist');

// Parse --port argument
const args = process.argv.slice(2);
let port = 3333;
const portIdx = args.indexOf('--port');
if (portIdx !== -1 && args[portIdx + 1]) {
  port = parseInt(args[portIdx + 1], 10) || 3333;
}

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.zip': 'application/zip',
};

if (!existsSync(DIST_DIR)) {
  console.error('Error: dist/ folder not found. Run "npm run build" first.');
  process.exit(1);
}

const server = createServer((req, res) => {
  let urlPath = req.url.split('?')[0];

  // Try exact file match
  let filePath = join(DIST_DIR, urlPath);

  // If directory or not found, try index.html (SPA fallback)
  if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
    filePath = join(DIST_DIR, 'index.html');
  }

  try {
    const content = readFileSync(filePath);
    const ext = extname(filePath);
    const mime = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': mime,
      'Cache-Control': ext === '.html' ? 'no-cache' : 'max-age=31536000',
    });
    res.end(content);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    port++;
    console.log(`  Port ${port - 1} is in use, trying ${port}...`);
    server.listen(port, '0.0.0.0');
  } else {
    console.error('Server error:', err.message);
    process.exit(1);
  }
});

server.listen(port, '0.0.0.0', () => {
  const localUrl = `http://localhost:${port}`;
  console.log('');
  console.log('  ┌─────────────────────────────────────────────┐');
  console.log('  │                                             │');
  console.log('  │   Attendance Insights is running            │');
  console.log(`  │   Local:   ${localUrl.padEnd(30)}│`);
  console.log(`  │   Network: http://0.0.0.0:${port}${' '.repeat(18 - String(port).length)}│`);
  console.log('  │                                             │');
  console.log('  │   Press Ctrl+C to stop                      │');
  console.log('  │                                             │');
  console.log('  └─────────────────────────────────────────────┘');
  console.log('');
});
