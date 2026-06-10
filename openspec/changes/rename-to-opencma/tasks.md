## 1. 核心代码重命名

- [x] 1.1 更新 `package.json`：name → `opencma`，description 体现 OpenCMA 品牌，bin 入口 `agent-iac` → `cma`
- [x] 1.2 重命名 `bin/agent-iac.ts` → `bin/cma.ts`
- [x] 1.3 更新 `src/cli/program.ts`：命令名 → `cma`，所有 `--file` 默认值 → `cma.yaml`，描述文本
- [x] 1.4 更新 `src/cli/commands/init.ts`：模板内容、gitignore 条目、提示文本中的 `agent-iac` → `cma`
- [x] 1.5 更新 `src/cli/commands/session.ts`：状态文件路径 `agent-iac.state.json` → `cma.state.json`
- [x] 1.6 更新 `src/utils/paths.ts`：状态文件名引用

## 2. Provider 标签重命名

- [x] 2.1 更新 `src/providers/claude/mapper.ts`：标签前缀 `agent-iac.*` → `cma.*`
- [x] 2.2 更新 `src/providers/claude/adapter.ts`：标签前缀 `agent-iac.*` → `cma.*`
- [x] 2.3 更新 `src/providers/qoder/mapper.ts`：标签前缀 `agent-iac.*` → `cma.*`

## 3. 测试更新

- [x] 3.1 更新 `tests/unit/paths.test.ts`：文件名引用 → `cma`
- [x] 3.2 更新 `tests/unit/slim-state.test.ts`：文件名引用 → `cma`
- [x] 3.3 运行 `bun run guard && bun run typecheck && bun test` 确认全部通过

## 4. 示例配置文件重命名

- [x] 4.1 `git mv agent-iac.yaml cma.yaml`
- [x] 4.2 `git mv agent-iac-full.yaml cma-full.yaml`
- [x] 4.3 更新配置文件内部引用（如有）

## 5. 文档更新

- [x] 5.1 更新 `README.md`：项目名、描述、所有命令示例
- [x] 5.2 更新 `CONTRIBUTING.md`
- [x] 5.3 更新 `docs/` 下所有文档（how-it-works、providers、configuration、trade-off）
- [x] 5.4 更新 `examples/` 下的 README 和示例脚本
- [x] 5.5 更新 `.github/ISSUE_TEMPLATE/` 中的引用
- [x] 5.6 更新 `CLAUDE.md` 中的引用（如有）

## 6. 验证

- [x] 6.1 运行 `grep -r "agent-iac" --include="*.ts" --include="*.json"` 确认代码中零残留
- [x] 6.2 运行 `bun run guard && bun run typecheck && bun test` 最终验证
