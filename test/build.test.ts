import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assembleCatalog, loadAndValidate, findDuplicateIds, ENTRIES_DIR } from '../src/build.ts';
import type { DwpEntry } from '../src/entry.ts';

const entry = (id: string): DwpEntry =>
  ({ id, author: 'a', name: { zh: id, en: id }, license: { code: 'MIT', content: 'CC0', commercial: false }, dwp: { spec: '0.4.1', thumbnail: 'https://x', package: { version: '1', url: 'https://github.com/o/r/releases/download/v/x.dwp', integrity: 'sha512-a=', size: 1 } } }) as DwpEntry;

test('assembleCatalog：按 id 稳定排序 + count 正确', () => {
  const c = assembleCatalog([entry('b.two'), entry('a.one')], '2026-01-01T00:00:00Z');
  assert.equal(c.count, 2);
  assert.deepEqual(c.entries.map(e => e.id), ['a.one', 'b.two']);
  assert.equal(c.schemaVersion, 1);
  assert.equal(c.generatedAt, '2026-01-01T00:00:00Z');
});

test('findDuplicateIds：检出重复', () => {
  assert.deepEqual(findDuplicateIds([entry('x'), entry('y'), entry('x')]), ['x']);
});

test('loadAndValidate：真实 entries/ 目录 4 条全通过、0 错误', () => {
  const { entries, errors } = loadAndValidate(ENTRIES_DIR);
  assert.deepEqual(errors, [], `不应有校验错误：${JSON.stringify(errors)}`);
  assert.equal(entries.length, 4);
  assert.ok(entries.some(e => e.license.commercial === true), '应含付费示例');
  assert.ok(entries.some(e => e.license.commercial === false), '应含免费示例');
});

test('loadAndValidate：文件名≠id → 报错', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dwpreg-'));
  writeFileSync(join(dir, 'wrong.name.yml'),
    'id: right.id\nauthor: a\nname:\n  zh: x\n  en: x\nlicense:\n  code: MIT\n  content: CC0\n  commercial: false\ndwp:\n  spec: 0.4.1\n  thumbnail: https://x/p.png\n  package:\n    version: "1"\n    url: https://github.com/o/r/releases/download/v/x.dwp\n    integrity: sha512-a=\n    size: 1\n');
  const { errors } = loadAndValidate(dir);
  assert.equal(errors.length, 1);
  assert.match(errors[0]!.errors[0]!, /文件名须等于 id/);
});

test('loadAndValidate：坏 YAML → 报错不崩', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dwpreg-'));
  writeFileSync(join(dir, 'broken.yml'), 'id: x\n  bad indent here\n');
  const { errors } = loadAndValidate(dir);
  assert.ok(errors.length >= 1);
});
