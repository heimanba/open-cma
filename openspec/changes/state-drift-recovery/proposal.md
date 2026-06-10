## Why

当本地 state 与远端资源不一致时（state 文件丢失、手动在控制台创建资源、或上次 apply 部分失败），planner 基于本地 state 做出错误的 create 决策，executor 盲目执行 POST 请求，远端 API 返回 409 Conflict，整个 apply 流程中断。

这是所有基于本地 state 的 IaC 工具都面临的经典问题——state drift。Terraform、Pulumi、CloudFormation 均采用 **拒绝 + 显式 import** 的策略：不自动 adopt 已有资源，而是报错并引导用户手动认领。这是业界压倒性的共识——显式优于隐式，避免静默覆盖不属于自己的资源。

CMA 当前没有任何 drift 恢复机制：409 直接报错，错误信息不可操作（只暴露原始 API 响应），且没有 import 手段让用户恢复。

影响范围：所有 provider（qoder、claude）的所有可创建资源类型（environment、agent、skill、vault、memory_store）。

## What Changes

遵循 Terraform 的成熟模式，分三步解决：

1. **BaseApiClient 引入结构化错误** — 新增 `ApiError` 类携带 `statusCode` 属性，替代当前基于字符串匹配（`msg.includes("409")`）的错误判断
2. **Executor 409 报错增强** — create 操作遇到 409 时，给出可操作的错误提示，引导用户使用 `cma state import` 认领资源
3. **新增 `cma state import` 命令** — 用户可显式将已存在的远端资源认领进本地 state，与 `terraform import` 语义一致。命令格式为 `cma state import <provider>.<type>.<name> <remote-id>`，必须包含 provider 前缀（同名资源可能存在于不同 provider）。import 时从当前配置文件计算 content_hash，version 从远端 GET 获取（对需要乐观锁的资源类型如 agent）

回退之前在 QoderAdapter 中针对 createEnvironment 和 createAgent 打的临时补丁（自动 fallback 到 update 的方式不安全——可能静默覆盖他人的资源）。

同时将 QoderAdapter.deleteEnvironment 中已有的字符串匹配 409 逻辑（`msg.includes("409")`）迁移到 ApiError，消除两套错误判断并存。

## Non-goals

- 不做自动 adopt / 自动 update — 业界共识是显式操作，避免静默覆盖
- 不做 plan-time refresh（远端状态同步） — 有价值但范围更大，作为后续独立 change
- 不修改 planner 逻辑 — planner 仍然基于本地 state 做决策
- 不修改 state 文件格式

## Capabilities

### New Capabilities
- `api-error`: BaseApiClient 抛出结构化的 ApiError（含 statusCode），替代纯字符串 Error
- `state-import`: 新增 `cma state import <type>.<name> <remote-id>` 命令，将远端已有资源认领进本地 state
- `conflict-diagnostic`: Executor 在 **create 路径**遇到 ApiError(409) 时输出可操作的诊断信息，指引用户执行 import。仅匹配 create 动作——其他场景的 409（如 deleteEnvironment 的"in use"冲突）保留原有处理逻辑

### Modified Capabilities
- `base-client`: 错误抛出方式从 `new Error(msg)` 改为 `new ApiError(statusCode, msg)`
- `executor`: create 路径增加 409 识别，替换原始错误为可操作的诊断提示

## Impact

- `src/providers/base-client.ts` — 新增 ApiError 类，修改所有 HTTP 方法的错误抛出
- `src/executor/executor.ts` — create 路径捕获 ApiError(409)，输出 import 引导信息
- `src/cli/commands/state.ts` — 新增 `import` 子命令
- `src/state/state-manager.ts` — 可能需要新增 importResource 方法（或复用 setResource）
- `src/providers/qoder/adapter.ts` — 回退 createEnvironment/createAgent 的临时 409 补丁；deleteEnvironment 的 409 判断从字符串匹配迁移到 ApiError
- `src/providers/claude/adapter.ts` — 无变更（如有字符串匹配的错误判断一并迁移）
- `src/providers/interface.ts` — 无变更（不再需要 findResource）
- 不修改 planner、parser、state 格式
- 不增加运行时依赖
