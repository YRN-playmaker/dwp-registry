/**
 * 最小 YAML 子集解析器（零依赖，dwp-registry 专用）。
 * 支持 registry 条目所需语法：块映射（缩进）、块序列（- 标量 / - 映射）、
 * 流序列 [a, b]、标量（plain / 双引号 / 单引号 / number / bool / null）、# 行注释。
 * 不支持：多行字符串、锚点/别名、流映射、复杂键——条目 schema 刻意避开这些。
 * 解析失败抛带行号的错误（CI 定位用）。
 */

export type YamlValue = string | number | boolean | null | YamlValue[] | { [k: string]: YamlValue };

interface Line { indent: number; text: string; no: number }

export function parseYaml(src: string): YamlValue {
  const lines: Line[] = [];
  const raw = src.replace(/\r\n/g, '\n').split('\n');
  for (let i = 0; i < raw.length; i++) {
    const stripped = stripComment(raw[i]!);
    if (stripped.trim() === '') continue;
    const indent = stripped.length - stripped.trimStart().length;
    lines.push({ indent, text: stripped.trim(), no: i + 1 });
  }
  if (lines.length === 0) return null;
  const pos = { i: 0 };
  const value = parseBlock(lines, pos, lines[0]!.indent);
  if (pos.i < lines.length) throw new Error(`YAML 第 ${lines[pos.i]!.no} 行：意外的缩进/内容`);
  return value;
}

/** 去掉行内 # 注释（尊重引号内的 #）。 */
function stripComment(line: string): string {
  let inS = false, inD = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === "'" && !inD) inS = !inS;
    else if (ch === '"' && !inS) { inD = !inD; if (inD && i > 0 && line[i - 1] === '\\') { /* escaped, stays */ } }
    else if (ch === '#' && !inS && !inD) return line.slice(0, i);
  }
  return line;
}

function parseBlock(lines: Line[], pos: { i: number }, indent: number): YamlValue {
  const line = lines[pos.i]!;
  if (line.text.startsWith('- ') || line.text === '-') return parseSeq(lines, pos, indent);
  return parseMap(lines, pos, indent);
}

function parseMap(lines: Line[], pos: { i: number }, indent: number): Record<string, YamlValue> {
  const obj: Record<string, YamlValue> = {};
  while (pos.i < lines.length) {
    const line = lines[pos.i]!;
    if (line.indent < indent) break;
    if (line.indent > indent) throw new Error(`YAML 第 ${line.no} 行：映射缩进不一致`);
    const m = /^([^:]+):\s*(.*)$/.exec(line.text);
    if (!m) throw new Error(`YAML 第 ${line.no} 行：期望 "key: value"`);
    const key = parseScalar(m[1]!.trim());
    if (typeof key !== 'string') throw new Error(`YAML 第 ${line.no} 行：键必须是字符串`);
    const rest = m[2]!.trim();
    pos.i++;
    if (rest !== '') { obj[key] = parseInline(rest, line.no); continue; }
    // 值为下一层块（若存在且更深）
    const next = lines[pos.i];
    if (next && next.indent > indent) obj[key] = parseBlock(lines, pos, next.indent);
    else if (next && next.indent === indent && next.text.startsWith('- ')) obj[key] = parseSeq(lines, pos, indent);
    else obj[key] = null;
  }
  return obj;
}

function parseSeq(lines: Line[], pos: { i: number }, indent: number): YamlValue[] {
  const arr: YamlValue[] = [];
  while (pos.i < lines.length) {
    const line = lines[pos.i]!;
    if (line.indent < indent || !(line.text.startsWith('- ') || line.text === '-')) break;
    if (line.indent > indent) throw new Error(`YAML 第 ${line.no} 行：序列缩进不一致`);
    const after = line.text === '-' ? '' : line.text.slice(2).trim();
    // "- key: val" → 该序列项是映射，其首键与本 '-' 同行
    const childIndent = line.indent + 2;
    if (after === '') {
      pos.i++;
      const next = lines[pos.i];
      arr.push(next && next.indent >= childIndent ? parseBlock(lines, pos, next.indent) : null);
    } else if (/^[^:]+:(\s|$)/.test(after)) {
      // 内联映射项：把 "- " 去掉，改写为普通映射行，从本行起按 childIndent 解析
      lines[pos.i] = { indent: childIndent, text: after, no: line.no };
      arr.push(parseMap(lines, pos, childIndent));
    } else {
      pos.i++;
      arr.push(parseInline(after, line.no));
    }
  }
  return arr;
}

/** 行内值：流序列 [..] 或标量。 */
function parseInline(text: string, no: number): YamlValue {
  if (text.startsWith('[')) {
    if (!text.endsWith(']')) throw new Error(`YAML 第 ${no} 行：流序列未闭合`);
    const inner = text.slice(1, -1).trim();
    if (inner === '') return [];
    return splitFlow(inner).map((p) => parseScalar(p.trim()));
  }
  return parseScalar(text);
}

function splitFlow(s: string): string[] {
  const out: string[] = [];
  let cur = '', inS = false, inD = false;
  for (const ch of s) {
    if (ch === "'" && !inD) inS = !inS;
    else if (ch === '"' && !inS) inD = !inD;
    if (ch === ',' && !inS && !inD) { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  out.push(cur);
  return out;
}

/** 标量：引号串 / 布尔 / null / 数字 / plain。 */
export function parseScalar(text: string): YamlValue {
  if (text === '') return null;
  if (text.length >= 2 && text[0] === '"' && text.at(-1) === '"') {
    try { return JSON.parse(text) as string; } catch { return text.slice(1, -1); }
  }
  if (text.length >= 2 && text[0] === "'" && text.at(-1) === "'") return text.slice(1, -1).replace(/''/g, "'");
  if (text === 'true') return true;
  if (text === 'false') return false;
  if (text === 'null' || text === '~') return null;
  if (/^-?\d+$/.test(text)) return Number(text);
  if (/^-?\d*\.\d+(e[+-]?\d+)?$/i.test(text)) return Number(text);
  return text;   // plain string（含 URL、sha512-…、日期等）
}
