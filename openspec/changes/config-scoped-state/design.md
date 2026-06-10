## Context

所有 CLI 命令（plan、apply、destroy、state list/show/rm）通过以下方式定位状态文件：

```typescript
const statePath = resolve(dirname(configPath), "agent-iac.state.json");
```

状态文件名硬编码为 `agent-iac.state.json`，与配置文件名无关。当同一目录存在多个配置文件时，它们共享同一份状态，planner 的删除逻辑（"状态中有但配置中没有 → 删除"）会误删其他配置管理的资源。

当前涉及硬编码路径的位置：
- `src/cli/commands/plan.ts:11`
- `src/cli/commands/apply.ts:13`
- `src/cli/commands/destroy.ts:12`
- `src/cli/commands/state.ts:7,33,65`

## Goals / Non-Goals

**Goals:**
- 每个配置文件拥有独立的状态文件，互不干扰
- 默认配置 `agent-iac.yaml` 的行为与现有完全一致（零迁移）
- apply 执行 delete 操作时有额外的确认保护
- 改动范围最小化，不引入新的架构概念

**Non-Goals:**
- 不实现跨配置文件的资源共享（ref/data source 机制）
- 不增加 `--state` CLI 参数
- 不修改 StateFile/ResourceState 数据结构
- 不实现资源级 `prevent_destroy` lifecycle 配置

## Decisions

### 1. 状态文件名派生规则

**决定**: 将配置文件的 `.yaml`/`.yml` 后缀替换为 `.state.json`。

| 配置文件 | 状态文件 |
|----------|----------|
| `agent-iac.yaml` | `agent-iac.state.json` |
| `agent-iac-full.yaml` | `agent-iac-full.state.json` |
| `my-project.yml` | `my-project.state.json` |

**备选方案**: 在配置文件同目录创建 `.state/` 子目录，每个配置对应一个文件。否决原因：增加目录结构复杂度，`.gitignore` 规则需要变更，且单文件方案已足够。

**备选方案**: 增加 `--state <path>` CLI 参数。否决原因：当前阶段"约定优于配置"更合适，减少用户心智负担。未来可按需添加。

### 2. 提取 deriveStatePath 工具函数

**决定**: 在 `src/utils/paths.ts` 新增函数，所有命令统一调用。

```typescript
export function deriveStatePath(configPath: string): string {
  return configPath.replace(/\.ya?ml$/, ".state.json");
}
```

**理由**: 单一职责，避免 4 个文件中重复相同的路径推导逻辑。放在 `utils/` 符合层级依赖规则（utils 不导入业务模块）。

### 3. apply 删除确认增强

**决定**: 当 plan 包含 delete 操作时，在确认提示前用红色文字单独列出即将删除的资源，并在确认消息中明确提示"将删除 N 个资源"。

**理由**: 现有的确认提示 `"Do you want to apply these changes?"` 过于笼统，用户可能忽略 delete 操作的存在。Terraform 也会在 plan 输出中用红色高亮 destroy 操作。

## Risks / Trade-offs

**[风险] 用户不知道状态文件名变了** → 在 plan/apply 输出开头打印状态文件路径，让用户始终清楚当前操作的是哪个状态文件。

**[风险] 配置文件名不以 .yaml/.yml 结尾** → `deriveStatePath` 对不匹配的文件名追加 `.state.json` 后缀作为 fallback，并在函数文档中注明。

**[取舍] 共享资源会重复创建** → 两个配置文件声明同一个 `environment.dev` 会在远端创建两份。这是隔离的代价，与 Terraform 多目录行为一致。未来可通过 ref 机制解决。
