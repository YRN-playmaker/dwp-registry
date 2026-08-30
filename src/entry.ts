/**
 * DWP registry 条目类型 + 校验（dwp-registry）。
 * 校验器把已锁定的分发/商业模型编成硬规则（CI 强制）：
 *  - content 许可永不含 copyleft（GPL/AGPL/LGPL）——内容不能传染；
 *  - commercial=true ⇒ content=proprietary 且必须有 sales 渠道（外链销售 + 平台侧授权）；
 *  - commercial=false ⇒ 无 sales，且 dwp.package.url 必须是 https 直链下载 + sha512 integrity；
 *  - id 规范 author.slug；spec 语义化版本。
 * 零依赖手写（无 ajv），与 schema/entry.schema.json 保持一致。
 */
import { type YamlValue } from './yaml.ts';

export interface DwpEntry {
  id: string;
  name: { zh: string; en: string };
  author: string;
  description?: string;
  tags?: string[];
  license: { code: string; content: string; commercial: boolean };
  dwp: {
    spec: string;
    package: { version: string; url: string; integrity: string; size: number; entry?: string };
    thumbnail: string;
    screenshots?: string[];
    params?: Record<string, string | number | boolean>;
    width?: number;
    height?: number;
  };
  sales?: null | { platform: string; url: string; entitlement: string };
  compatibility?: { dsh?: string; platform?: string[] };
  featured?: boolean;
  updatedAt?: string;
}

const LEFTOVER_COPYLEFT = /gpl|agpl|lgpl/i;
const ID_RE = /^[a-z0-9][a-z0-9._-]*$/;
const SEMVER_RE = /^\d+\.\d+(\.\d+)?$/;
const INTEGRITY_RE = /^sha512-[A-Za-z0-9+/=]+$/;

/** 校验单条目；返回错误列表（空 = 通过）。 */
export function validateEntry(v: YamlValue, where = ''): string[] {
  const errs: string[] = [];
  const e = v as Partial<DwpEntry> | null;
  if (!e || typeof e !== 'object' || Array.isArray(e)) return [`${where}条目必须是映射`];

  const req = (cond: boolean, msg: string) => { if (!cond) errs.push(`${where}${msg}`); };

  req(typeof e.id === 'string' && ID_RE.test(e.id), 'id 必填且形如 author.slug（小写）');
  req(typeof e.author === 'string' && e.author !== '', 'author 必填');
  req(!!e.name && typeof e.name.zh === 'string' && typeof e.name.en === 'string', 'name.zh / name.en 必填');

  // license
  const lic = e.license;
  req(!!lic && typeof lic.code === 'string', 'license.code 必填');
  req(!!lic && typeof lic.content === 'string', 'license.content 必填');
  if (lic) {
    req(typeof lic.commercial === 'boolean', 'license.commercial 必须是布尔');
    if (typeof lic.content === 'string') {
      req(!LEFTOVER_COPYLEFT.test(lic.content), `license.content 不得为 copyleft（GPL 传染，内容致命）：${lic.content}`);
    }
    if (lic.commercial === true) {
      req(lic.content === 'proprietary', 'commercial=true ⇒ license.content 必须为 proprietary（协议 §8.2）');
      req(!!e.sales && typeof e.sales === 'object', 'commercial=true ⇒ 必须提供 sales 渠道');
    } else {
      req(e.sales == null, 'commercial=false ⇒ 不应有 sales 字段（免费包直链分发）');
    }
  }

  // dwp
  const d = e.dwp;
  req(!!d && typeof d.spec === 'string' && SEMVER_RE.test(d.spec), 'dwp.spec 必填且为语义化版本');
  req(!!d && typeof d.thumbnail === 'string' && /^https:\/\//.test(d.thumbnail), 'dwp.thumbnail 必须 https');
  const pkg = d?.package;
  req(!!pkg && typeof pkg.version === 'string', 'dwp.package.version 必填');
  if (pkg) {
    req(/^https:\/\//.test(pkg.url ?? ''), 'dwp.package.url 必须 https 直链');
    req(typeof pkg.size === 'number' && pkg.size > 0, 'dwp.package.size 必须正数');
    req(typeof pkg.integrity === 'string' && INTEGRITY_RE.test(pkg.integrity), 'dwp.package.integrity 必须 sha512-…');
    // 免费包：url 必须是可自动拉取的直链（GitHub Release 约定）
    if (lic?.commercial === false) {
      req(/github\.com\/.+\/releases\/download\//.test(pkg.url ?? ''), '免费包 url 应为 GitHub Release 直链（可自动安装）');
    }
  }

  // sales（若存在）
  if (e.sales && typeof e.sales === 'object') {
    req(['itch', 'afdian', 'gumroad', 'other'].includes(e.sales.platform), 'sales.platform ∈ itch|afdian|gumroad|other');
    req(/^https:\/\//.test(e.sales.url), 'sales.url 必须 https');
  }

  if (e.tags) req(Array.isArray(e.tags), 'tags 必须是列表');
  return errs;
}

/** 从解析后的 YAML 收窄为 DwpEntry（假定已过 validateEntry）。 */
export const asEntry = (v: YamlValue): DwpEntry => v as DwpEntry;
