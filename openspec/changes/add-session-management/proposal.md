## Why

agent-iac 目前只管 provisioning（environment, vault, skill, memory_store, agent），但用户要真正运行 agent 还需手动调 Session API 拼装 environment_id、vault_ids、memory_store_ids。YAML 中 agent 声明的 `environment`/`vault`/`memory_stores` 关系在 resolver.ts 中被解析但从未消费（死代码），因为这些字段属于 Session Create API 而非 Agent Create API。需要补全 runtime 层，让 `agent-iac session create <agent>` 自动从声明中组装 bindings 并创建 session。

## What Changes

- 新增 `agent-iac session` 子命令族：`create`、`list`、`get`、`delete`
- `session create <agent-name>` 读取 agent 声明的 environment/vault/memory_stores，从 state 解析 remote ID，调用 provider API 创建 session
- 支持 CLI flag 覆盖 agent 声明的默认绑定（`--environment`、`--vault`、`--memory-stores`、`--title`）
- Session 不写入 state file——直接查平台 API（`GET /sessions`）获取列表
- 重构 `resolver.ts`：拆为通用 `resolveRef`/`requireRef` 原子操作，移除当前混合在 `resolveAgentRefs` 中的死代码
- `ProviderAdapter` 接口增加 session CRUD 方法
- Qoder 和 Claude adapter 各自实现 session mapper + adapter 方法

## Capabilities

### New Capabilities
- `session-runtime`: Session 的 CLI 命令、bindings 解析、provider adapter 方法、mapper 实现
- `ref-resolver`: 通用的 name→remote_id 解析工具，替代当前 domain-specific 的 resolveAgentRefs

### Modified Capabilities

## Impact

- `src/executor/resolver.ts` — 重构为通用工具，`resolveAgentRefs` 调用方式改变
- `src/providers/interface.ts` — ProviderAdapter 接口新增 session 方法
- `src/providers/qoder/adapter.ts`, `mapper.ts` — 新增 session 实现
- `src/providers/claude/adapter.ts`, `mapper.ts` — 新增 session 实现
- `src/cli/program.ts` — 注册 session 子命令
- 新增 `src/session/` 模块
- 新增 `src/cli/commands/session.ts`
- 新增 `src/types/session.ts`
