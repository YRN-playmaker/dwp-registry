import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseYaml, parseScalar } from '../src/yaml.ts';

test('标量：类型推断', () => {
  assert.equal(parseScalar('123'), 123);
  assert.equal(parseScalar('-1.5'), -1.5);
  assert.equal(parseScalar('true'), true);
  assert.equal(parseScalar('false'), false);
  assert.equal(parseScalar('null'), null);
  assert.equal(parseScalar('~'), null);
  assert.equal(parseScalar('"600"'), '600');           // 引号保字符串
  assert.equal(parseScalar('hello world'), 'hello world');
  assert.equal(parseScalar('https://a/b#c'), 'https://a/b#c');   // plain 含 # 不误判（无引号但整行注释已处理）
});

test('块映射：嵌套 + 标量值', () => {
  const v = parseYaml(`
id: yrn.clock-desk
name:
  zh: 时钟桌面
  en: Clock Desk
count: 3
`) as Record<string, unknown>;
  assert.equal(v.id, 'yrn.clock-desk');
  assert.deepEqual(v.name, { zh: '时钟桌面', en: 'Clock Desk' });
  assert.equal(v.count, 3);
});

test('流序列 [a, b] 与块序列 - x', () => {
  const v = parseYaml(`
tags: [clock, minimal, "with space"]
modes:
  - light
  - dark
`) as Record<string, unknown>;
  assert.deepEqual(v.tags, ['clock', 'minimal', 'with space']);
  assert.deepEqual(v.modes, ['light', 'dark']);
});

test('块序列项为映射（- key: val 续行）', () => {
  const v = parseYaml(`
screens:
  - url: https://a/1.png
    w: 1920
  - url: https://a/2.png
    w: 1280
`) as Record<string, unknown>;
  assert.deepEqual(v.screens, [
    { url: 'https://a/1.png', w: 1920 },
    { url: 'https://a/2.png', w: 1280 },
  ]);
});

test('注释：整行与行内（引号内 # 保留）', () => {
  const v = parseYaml(`
# 顶部注释
a: 1   # 行内注释
b: "x#y"   # 引号内 # 不算注释
`) as Record<string, unknown>;
  assert.deepEqual(v, { a: 1, b: 'x#y' });
});

test('空值键 → null；嵌套 license/sales', () => {
  const v = parseYaml(`
license:
  code: MIT
  content: CC-BY-4.0
  commercial: false
sales:
compatibility:
  platform: [web]
`) as Record<string, unknown>;
  assert.deepEqual(v.license, { code: 'MIT', content: 'CC-BY-4.0', commercial: false });
  assert.equal(v.sales, null);
  assert.deepEqual(v.compatibility, { platform: ['web'] });
});

test('真实 registry 条目形状往返', () => {
  const v = parseYaml(`
id: yrn.rain-night
name:
  zh: 雨夜
  en: Rain Night
author: YRN-playmaker
dwp:
  spec: 0.4.1
  package:
    version: 1.0.0
    url: https://github.com/YRN-playmaker/dwp/releases/download/v1.0.0/rain-night.dwp
    integrity: sha512-abc123
    size: 204800
  thumbnail: https://raw.githubusercontent.com/x/preview.png
  params:
    accent: "#ff8800"
    density: 0.6
featured: true
`) as Record<string, unknown>;
  const dwp = v.dwp as Record<string, Record<string, unknown>>;
  assert.equal(dwp.spec, '0.4.1');
  assert.equal(dwp.package.version, '1.0.0');
  assert.equal(dwp.package.size, 204800);
  assert.equal(dwp.package.integrity, 'sha512-abc123');
  assert.deepEqual(dwp.params, { accent: '#ff8800', density: 0.6 });
  assert.equal(v.featured, true);
});

test('缩进错误 → 抛带行号', () => {
  assert.throws(() => parseYaml('a: 1\n  b: 2\n'), /第 2 行/);
});

test('version: 1.0.0 保持字符串（非数字）', () => {
  const v = parseYaml('version: 1.0.0') as Record<string, unknown>;
  assert.equal(v.version, '1.0.0');   // 多段点分 → plain string
});
