# dwp-registry

DWP（DSH Wallpaper Package）壁纸的**收录注册表**——纯数据仓库，是 `dsh-wallpaper_share` 内置 market 拉取的数据源。

## 模型

- **分片存储**：每条壁纸一个 `entries/<id>.yml`（文件名须等于 `id`），避免单文件合并冲突；
- **构建产物**：`src/cli.ts build` 把所有条目组装成 `data/catalog.json`（客户端只拉这一个文件）；
- **零依赖**：自带最小 YAML 子集解析器（`src/yaml.ts`），CI 用 Node 原生类型剥离直跑，无需 `npm install`。

## 收录条目 schema

见 `schema/entry.schema.json`；运行时校验器 `src/entry.ts` 与之一致，把**已锁定的分发/商业模型**编成硬规则：

| 规则 | 约束 |
| --- | --- |
| 内容许可 | `license.content` **永不含 copyleft**（GPL/AGPL/LGPL）——内容不能被传染 |
| 付费 ⇒ 专有 | `commercial: true` ⇒ `content: proprietary` **且**必须有 `sales` 渠道 |
| 免费 ⇒ 直链 | `commercial: false` ⇒ 无 `sales`，`dwp.package.url` 必须是 **GitHub Release 直链** + `sha512` integrity（可自动安装） |
| 付费分发 | 内容托管在**创作者自售平台**（itch.io / 爱发电 / Gumroad），平台侧授权；`.dwp` 内容**不进本仓、不走 git 分支存储** |

## 用法

```bash
node src/cli.ts validate     # 校验全部条目（CI 用；有错非零退出）
node src/cli.ts build        # 校验 + 写 data/catalog.json
node --test "test/*.test.ts" # 测试
```

## 提交新壁纸

1. 复制一个 `entries/*.yml` 改字段（文件名 = `id`）；
2. 本地 `node src/cli.ts validate` 通过；
3. 开 PR——CI 校验通过后自动再生 `catalog.json`。

## 生态

| 仓库 | 角色 |
| --- | --- |
| `dsh-wallpaper_edit` | 制作插件 + DWP 协议事实源 |
| `dwp-runtime-web` | 参考运行时（`@dwp/core` / `gl` / `web`，MIT） |
| `dsh-wallpaper_share` | 渲染消费端 + 内置 market 拉取（读本草单） |
| `dwp-registry`（本仓库） | 纯数据收录（CC0） |

> 镜像：本仓可发布为 `@dwp-registry` npm 包（`catalog.json` 作 data file），供 `DSH_DWP_MIRROR` 双源回退。
