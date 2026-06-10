## 1. 状态路径派生函数

- [x] 1.1 创建 `src/utils/paths.ts`，实现 `deriveStatePath(configPath: string): string`，将 `.yaml`/`.yml` 替换为 `.state.json`，非 yaml 后缀则追加 `.state.json`
- [x] 1.2 在 `tests/utils/paths.test.ts` 中添加单元测试，覆盖 `.yaml`、`.yml`、非标准后缀、绝对路径等场景

## 2. 命令文件迁移

- [x] 2.1 修改 `src/cli/commands/plan.ts`，用 `deriveStatePath(configPath)` 替换硬编码的 `agent-iac.state.json`
- [x] 2.2 修改 `src/cli/commands/apply.ts`，用 `deriveStatePath(configPath)` 替换硬编码路径
- [x] 2.3 修改 `src/cli/commands/destroy.ts`，用 `deriveStatePath(configPath)` 替换硬编码路径
- [x] 2.4 修改 `src/cli/commands/state.ts` 三个子命令（list/show/rm），用 `deriveStatePath` 替换硬编码路径

## 3. Apply 删除确认增强

- [x] 3.1 在 `apply.ts` 中，当 plan 包含 delete 操作时，在确认提示前显示红色的 "Resources to be DESTROYED" 警告块
- [x] 3.2 确认消息中明确显示删除数量，如 "Apply changes? (will destroy N resource(s))"
- [x] 3.3 `--yes` 模式下仍打印删除警告（跳过确认但保留可见性）

## 4. 验证

- [x] 4.1 运行 `bun run guard && bun run typecheck && bun test` 确保无回归
- [x] 4.2 手动验证：用默认 `-f agent-iac.yaml` 执行 plan，确认状态文件仍为 `agent-iac.state.json`（向后兼容）
- [x] 4.3 手动验证：用 `-f agent-iac-full.yaml` 执行 plan，确认使用独立的 `agent-iac-full.state.json`，不会产生误删
