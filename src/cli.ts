/**
 * dwp-registry CLI：
 *   node src/cli.ts validate   → 校验全部条目，非零退出码若有错
 *   node src/cli.ts build      → 校验 + 写 data/catalog.json
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { loadAndValidate, assembleCatalog, findDuplicateIds, ENTRIES_DIR, CATALOG_FILE } from './build.ts';

const cmd = process.argv[2] ?? 'validate';
const { entries, errors } = loadAndValidate(ENTRIES_DIR);

const dupes = findDuplicateIds(entries);
for (const id of dupes) errors.push({ file: '(dup)', errors: [`重复 id: ${id}`] });

if (errors.length) {
  console.error(`✗ ${errors.length} 个条目有问题：`);
  for (const e of errors) for (const m of e.errors) console.error(`  - ${e.file}: ${m}`);
  process.exit(1);
}

console.log(`✓ ${entries.length} 条目全部通过校验`);

if (cmd === 'build') {
  const catalog = assembleCatalog(entries, new Date().toISOString());
  mkdirSync(dirname(CATALOG_FILE), { recursive: true });
  writeFileSync(CATALOG_FILE, JSON.stringify(catalog, null, 2) + '\n', 'utf8');
  console.log(`→ 已写 ${CATALOG_FILE}（${catalog.count} 条）`);
}
