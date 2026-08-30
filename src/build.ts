/**
 * catalog 组装（dwp-registry）：entries/*.yml → data/catalog.json。
 * 纯函数 assembleCatalog 与 fs I/O 分离，便于 Node 测试。
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseYaml } from './yaml.ts';
import { validateEntry, asEntry, type DwpEntry } from './entry.ts';

export interface Catalog {
  schemaVersion: 1;
  generatedAt: string;
  count: number;
  entries: DwpEntry[];
}

export interface LoadError { file: string; errors: string[] }

/** 纯组装：已校验条目 → catalog（按 id 稳定排序）。 */
export function assembleCatalog(entries: DwpEntry[], generatedAt: string): Catalog {
  const sorted = [...entries].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return { schemaVersion: 1, generatedAt, count: sorted.length, entries: sorted };
}

/** 从目录读全部 .yml 条目并校验；返回有效条目 + 错误列表。 */
export function loadAndValidate(dir: string): { entries: DwpEntry[]; errors: LoadError[] } {
  const entries: DwpEntry[] = [];
  const errors: LoadError[] = [];
  if (!existsSync(dir)) return { entries, errors: [{ file: dir, errors: ['目录不存在'] }] };
  for (const f of readdirSync(dir).filter((n) => /\.ya?ml$/.test(n)).sort()) {
    const path = join(dir, f);
    let value;
    try { value = parseYaml(readFileSync(path, 'utf8')); }
    catch (e) { errors.push({ file: f, errors: [String((e as Error).message ?? e)] }); continue; }
    const errs = validateEntry(value, `${f}: `);
    if (errs.length) { errors.push({ file: f, errors: errs }); continue; }
    const entry = asEntry(value);
    // 文件名须与 id 一致（防分片错名）
    if (basename(f, '.yml') !== entry.id) {
      errors.push({ file: f, errors: [`文件名须等于 id（${entry.id}）`] });
      continue;
    }
    entries.push(entry);
  }
  return { entries, errors };
}

/** 重复 id 检测（跨文件）。 */
export function findDuplicateIds(entries: DwpEntry[]): string[] {
  const seen = new Map<string, number>();
  for (const e of entries) seen.set(e.id, (seen.get(e.id) ?? 0) + 1);
  return [...seen].filter(([, n]) => n > 1).map(([id]) => id);
}

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
export const ENTRIES_DIR = join(repoRoot, 'entries');
export const CATALOG_FILE = join(repoRoot, 'data', 'catalog.json');
