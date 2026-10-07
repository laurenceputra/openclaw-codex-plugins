import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync, readFileSync, readdirSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const source = join(root, 'packages/custom-codex-search');
const expected = [
  'CHANGELOG.md', 'LICENSE', 'README.md', 'SECURITY.md', 'auth-adapter.mjs',
  'index.mjs', 'openclaw.plugin.json', 'package.json', 'policy.mjs', 'search.mjs',
  'transport.mjs', 'test/metadata-summary.test.mjs', 'test/native-summary-fixture.json',
  'test/native-summary.test.mjs', 'test/provider.test.mjs', 'test/release.test.mjs',
  'test/summary.test.mjs', 'test/transport.test.mjs',
].sort();
const temp = mkdtempSync(join(tmpdir(), 'custom-codex-search-pack-'));
try {
  const metadata = JSON.parse(execFileSync('npm', ['pack', '--json', '--ignore-scripts', '--pack-destination', temp], {cwd: source, encoding: 'utf8'}));
  const packs = Array.isArray(metadata) ? metadata : Object.values(metadata);
  assert.equal(packs.length, 1);
  const [pack] = packs;
  assert.equal(pack.name, 'custom-codex-search');
  assert.equal(pack.version, '0.2.0');
  assert.deepEqual(pack.files.map(f => f.path).sort(), expected);
  execFileSync('tar', ['-xzf', join(temp, pack.filename), '-C', temp]);
  const extracted = join(temp, 'package');
  for (const path of expected) {
    const content = readFileSync(join(extracted, path));
    assert.deepEqual(content, readFileSync(join(source, path)), 'Packed bytes differ: ' + path);
    if (path.endsWith('.mjs')) {
      // Relative imports must resolve inside this independently extracted package.
      for (const match of content.toString().matchAll(/(?:from\s*|import\s*\()\s*['"]([^'"]+)['"]/g)) {
        if (match[1].startsWith('.')) {
          const resolved = fileURLToPath(new URL(match[1], 'file://' + join(extracted, path)));
          assert(resolved.startsWith(extracted + '/'), 'Escaping relative import: ' + match[1]);
        }
      }
    }
  }
  const tests = readdirSync(join(extracted, 'test')).filter(f => f.endsWith('.test.mjs')).sort();
  execFileSync(process.execPath, ['--test', ...tests.map(f => join('test', f))], {cwd: extracted, stdio: 'inherit'});
  console.log('PASS: exact 18-file allowlist, matching package bytes, contained imports, and extracted tests.');
} finally {
  rmSync(temp, {recursive: true, force: true});
}
