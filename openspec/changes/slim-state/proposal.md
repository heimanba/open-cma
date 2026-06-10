## Why

State file 当前照搬 Terraform 设计，10 个字段中只有 3 个被代码读取（address、remote_id、content_hash），其余 7 个（serial、lineage、version、created_at、updated_at、attributes、顶层 version）写入后从未消费。这导致 state 文件臃肿（attributes 存了完整 API response body），且给用户一种需要像 Terraform 一样小心维护 state 的错觉。经过完整的 Claude/Qoder API 能力审查，确认 metadata-based discovery 无法统一实施（Skill 两端不支持 metadata，Qoder 的 Vault/MemoryStore 也不支持），因此 state 文件仍然必要，但应精简到只保留 load-bearing 字段。

## What Changes

- 删除 `StateFile` 顶层的 `version`、`serial`、`lineage` 三个字段
- 删除 `ResourceState` 的 `created_at`、`updated_at`、`attributes` 三个字段
- 精简 `RemoteResource` 接口，provider 不再需要返回 timestamps 和 attributes
- `StateManager.load()` 兼容旧格式（忽略多余字段，不报错）
- **BREAKING**：`state show` 命令输出格式变化，不再显示 attributes 详情
- 对支持 metadata 的资源类型，创建/更新时写入 `agent-iac.*` 标记（预留，不用于 discovery）

## Capabilities

### New Capabilities

- `state-slim`: State 类型精简与向后兼容加载，覆盖 StateFile/ResourceState 类型定义变更、StateManager 加载兼容、state show 输出适配
- `metadata-tagging`: 对支持 metadata 的资源类型在 create/update 时注入 agent-iac 标记，覆盖 mapper 层的 metadata 注入逻辑和 provider 能力矩阵

### Modified Capabilities

## Impact

- `src/types/state.ts` — 类型定义变更
- `src/state/state-manager.ts` — load/save 逻辑适配
- `src/providers/interface.ts` — RemoteResource 接口精简
- `src/providers/claude/adapter.ts`、`src/providers/qoder/adapter.ts` — toRemoteResource 简化
- `src/providers/claude/mapper.ts`、`src/providers/qoder/mapper.ts` — metadata 注入
- `src/executor/executor.ts` — setResource 调用参数精简
- `src/cli/commands/state.ts` — state show 输出适配
- 已有 state 文件需兼容加载（不需要迁移工具，多余字段自动忽略）
