# FoeDesk

FoeDesk 是一个独立的 Tauri 桌面电子宠物项目。当前实现覆盖迁移计划阶段 0—6：桌面窗口、四名人物、本地互动与情绪、离线/DeepSeek 对话、长期记忆、衣柜、隐藏暗号、后台主题及 66 套规范化外观资源（61 套迁移资源与 5 套原创皮肤）。

旧项目位于本机的 `travel-collection/`，仅作为只读参考，不属于新应用的构建或 pnpm workspace。

## 开发

```bash
cd app
pnpm install
pnpm dev
```

仅构建 Web 前端：

```bash
pnpm build:web
```

检查 Rust 后端：

```bash
cd app/src-tauri
cargo check
```

重新生成并校验人物资源：

```bash
cd app
pnpm assets:migrate
pnpm assets:validate
```

迁移边界和验收要求见 [`docs/MIGRATION.md`](docs/MIGRATION.md)，人工验收步骤见 [`docs/MANUAL_TESTING.md`](docs/MANUAL_TESTING.md)。
