## Context

项目从 `agent-iac` 更名为 **OpenCMA**（Open Cloud Managed Agents）。当前代码中 `agent-iac` 字符串散布在 13+ 个文件中，涉及 CLI 入口、配置文件默认值、Provider 元数据标签、状态文件路径、文档和测试。本设计关注如何安全、完整地完成这次全局重命名。

## Goals / Non-Goals

**Goals:**
- 所有面向用户的标识符统一为 `cma`（CLI 命令、配置文件、状态文件）
- npm 包名改为 `opencma`
- Provider 元数据标签前缀改为 `cma.*`
- 文档和示例体现 OpenCMA 品牌
- 类型检查、lint、测试在重命名后全部通过

**Non-Goals:**
- 不引入向后兼容层（不支持旧名自动降级）
- 不修改任何功能逻辑
- 不更改目录结构（`src/` 下的模块划分保持不变）
- 不处理 GitHub 仓库本身的 rename（那是 GitHub 设置层面的操作）

## Decisions

### 1. 命名映射规则

| 场景 | 旧值 | 新值 | 理由 |
|------|------|------|------|
| npm 包名 | `agent-iac` | `opencma` | 品牌名，全小写无连字符，符合 npm 惯例 |
| CLI 命令 | `agent-iac` | `cma` | 日常高频输入，越短越好 |
| bin 文件 | `bin/agent-iac.ts` | `bin/cma.ts` | 与 CLI 命令一致 |
| 配置文件 | `agent-iac.yaml` | `cma.yaml` | 与 CLI 命令一致 |
| 状态文件 | `agent-iac.state.json` | `cma.state.json` | 与配置文件前缀一致 |
| Provider 标签 | `agent-iac.project` | `cma.project` | 简短且一致 |
| 品牌/文档 | agent-iac | OpenCMA | 首字母大写的品牌名 |

### 2. 变更顺序策略

采用 **由内到外** 的顺序：先改核心代码（provider/state/cli），再改外围（docs/examples/config）。

理由：核心代码变更后可以立即用 `bun run guard && bun run typecheck && bun test` 验证正确性；文档变更不影响编译。

### 3. 常量集中化

不引入新的常量文件。当前 `agent-iac` 字符串大多是硬编码的字面量，替换为 `cma` / `opencma` 后仍保持硬编码——因为这些值在各自上下文中含义不同（有的是文件名，有的是标签前缀，有的是 CLI 名称），强行抽取反而增加间接性。

备选方案：创建 `src/constants.ts` 集中管理。放弃原因——过度抽象，这些值几乎不会再变。

### 4. 示例配置文件处理

`agent-iac.yaml` 和 `agent-iac-full.yaml` 需要 git mv 重命名为 `cma.yaml` 和 `cma-full.yaml`，同时更新文件内容中的引用。

## Risks / Trade-offs

- **[用户迁移成本]** → 无自动迁移工具，用户需手动重命名配置和状态文件。在 README 中添加迁移说明即可，因为项目尚处早期阶段，用户量极少。
- **[Provider 标签不兼容]** → 已部署的 Agent 资源带有 `agent-iac.*` 标签，更名后标签变为 `cma.*`。下次 `apply` 时标签会被更新，不影响功能，但 `plan` 会显示标签变更的 diff。可接受。
- **[遗漏引用]** → 全局搜索可能遗漏动态拼接的字符串。缓解措施：完成后运行 `grep -r "agent-iac" --include="*.ts"` 确认零结果。
