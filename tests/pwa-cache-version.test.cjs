const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
test('public PWA cache matches package version', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const sw = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');
  assert.ok(sw.includes(`const CACHE='sqf-public-v${pkg.version}';`), 'Update PWA cache when bumping the release version');
});
