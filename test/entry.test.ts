import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateEntry, type DwpEntry } from '../src/entry.ts';

const base = (): DwpEntry => ({
  id: 'yrn.demo', author: 'YRN', name: { zh: '演示', en: 'Demo' },
  license: { code: 'MIT', content: 'CC-BY-4.0', commercial: false },
  dwp: {
    spec: '0.4.1', thumbnail: 'https://x/p.png',
    package: { version: '1.0.0', url: 'https://github.com/o/r/releases/download/v1/r.dwp', integrity: 'sha512-abc=', size: 100 },
  },
});
const has = (errs: string[], re: RegExp) => assert.ok(errs.some(e => re.test(e)), `期望错误 ${re}，实得 ${JSON.stringify(errs)}`);

test('合法免费条目 → 无错', () => {
  assert.deepEqual(validateEntry(base()), []);
});

test('content 为 GPL → 拒绝（内容不得 copyleft）', () => {
  const e = base(); e.license.content = 'GPL-3.0';
  has(validateEntry(e), /copyleft/);
});

test('commercial=true 但 content≠proprietary → 拒绝', () => {
  const e = base(); e.license.commercial = true; e.license.content = 'CC-BY-4.0';
  e.sales = { platform: 'itch', url: 'https://a.itch.io/x', entitlement: 'platform' };
  has(validateEntry(e), /proprietary/);
});

test('commercial=true 缺 sales → 拒绝', () => {
  const e = base(); e.license.commercial = true; e.license.content = 'proprietary';
  has(validateEntry(e), /sales/);
});

test('commercial=true + proprietary + sales → 通过（url 非 GitHub 直链也放行）', () => {
  const e = base(); e.license.commercial = true; e.license.content = 'proprietary';
  e.dwp.package.url = 'https://a.itch.io/x';
  e.sales = { platform: 'itch', url: 'https://a.itch.io/x', entitlement: 'platform' };
  assert.deepEqual(validateEntry(e), []);
});

test('免费包 url 非 GitHub Release 直链 → 拒绝（无法自动安装）', () => {
  const e = base(); e.dwp.package.url = 'https://drive.google.com/x';
  has(validateEntry(e), /GitHub Release/);
});

test('commercial=false 却带 sales → 拒绝', () => {
  const e = base(); e.sales = { platform: 'itch', url: 'https://a.itch.io/x', entitlement: 'platform' };
  has(validateEntry(e), /不应有 sales/);
});

test('integrity 非 sha512 → 拒绝', () => {
  const e = base(); e.dwp.package.integrity = 'md5-xyz';
  has(validateEntry(e), /sha512/);
});

test('id 非法（大写/空格）→ 拒绝', () => {
  const e = base(); e.id = 'YRN Demo';
  has(validateEntry(e), /id/);
});

test('缺 name.en → 拒绝', () => {
  const e = base(); (e.name as { en?: string }).en = undefined;
  has(validateEntry(e), /name/);
});

test('sales.platform 非法 → 拒绝', () => {
  const e = base(); e.license.commercial = true; e.license.content = 'proprietary';
  e.sales = { platform: 'patreon', url: 'https://patreon.com/x', entitlement: 'platform' };
  has(validateEntry(e), /sales.platform/);
});
