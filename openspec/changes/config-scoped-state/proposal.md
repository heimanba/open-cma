## Why

当同一目录下存在多个配置文件（如 `agent-iac.yaml` 和 `agent-iac-full.yaml`）时，所有命令硬编码使用 `agent-iac.state.json` 作为状态文件名，导致不同配置文件共享同一份状态。用新配置执行 `plan`/`apply` 会将旧配置创建的资源标记为删除，造成线上资源被误删的严重风险。这是 IaC 工具最基本的安全边界——一个配置对应一个独立状态——当前缺失。

## What Changes

- 状态文件名从硬编码 `agent-iac.state.json` 改为从配置文件名派生（`<config-name>.state.json`）
- 新增 `deriveStatePath()` 工具函数，集中状态路径推导逻辑
- 所有使用状态文件的命令（plan/apply/destroy/state）统一调用该函数
- apply 命令在 plan 包含 delete 操作时增加醒目的删除确认提示

## Capabilities

### New Capabilities
- `state-path-derivation`: 从配置文件路径派生状态文件路径，确保每个配置文件拥有独立的状态文件
- `destroy-confirmation`: apply 执行时对 delete 操作增加额外的确认保护

### Modified Capabilities

## Impact

- `src/cli/commands/plan.ts` — 状态路径推导逻辑变更
- `src/cli/commands/apply.ts` — 状态路径推导 + 删除确认增强
- `src/cli/commands/destroy.ts` — 状态路径推导逻辑变更
- `src/cli/commands/state.ts` — 三个子命令的状态路径推导变更
- `src/utils/paths.ts` — 新增文件
- 向后兼容：默认配置 `agent-iac.yaml` 派生 `agent-iac.state.json`，与现有行为一致
- 不修改状态文件格式，不增加运行时依赖
