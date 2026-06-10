## Context

State file 当前采用 Terraform 级设计（serial/lineage/attributes 等），但 agent-iac 管理的资源数量少（通常 <20 个）、平台 API 都有 list/get 端点、部分资源支持 metadata。经过 API 能力审查确认 metadata-based discovery 覆盖率不足，state 文件仍然必要。

当前 state 文件结构（`src/types/state.ts`）：
- `StateFile`: version(1) / serial / lineage / resources[]
- `ResourceState`: address / remote_id / version / content_hash / created_at / updated_at / attributes

代码审查确认只有 address / remote_id / content_hash / version 被读取，其余 6 字段写入后从未消费。

## Goals / Non-Goals

**Goals:**
- 精简 StateFile 和 ResourceState 类型到只保留 load-bearing 字段
- 精简 RemoteResource 接口，provider 不再返回冗余数据
- 向后兼容加载旧格式 state 文件（忽略多余字段，不报错）
- 对支持 metadata 的资源类型注入 `agent-iac.*` 标记

**Non-Goals:**
- 不做 metadata-based discovery（Skill/Vault(Qoder)/MemoryStore 不支持 metadata 写入）
- 不做 state refresh / state import
- 不做 content_hash 去 state 化（mapper 变换不可逆）
- 不做 state 文件迁移工具（旧文件自动兼容）

## Decisions

### D1: 删除 StateFile 顶层 3 字段

删除 `version`、`serial`、`lineage`。

**理由**：`version` 硬编码为 1 从未变过；`serial` 在 save() 时递增但从未读取；`lineage` 在 initialize() 时生成 UUID 但从未读取。全部是 Terraform 惯例的照搬。

**替代方案**：保留 version 字段用于未来格式迁移 → 不采纳，当需要格式迁移时再加回来，YAGNI。

### D2: 删除 ResourceState 3 字段

删除 `created_at`、`updated_at`、`attributes`。

**理由**：timestamps 从未被任何消费者读取，需要时可通过 GET API 实时获取；`attributes` 存了完整 API response body（最大的膨胀来源），同样从未读取。

**替代方案**：只删 attributes 保留 timestamps → 不采纳，timestamps 同样无人读取，保留会继续要求 RemoteResource 返回它们。

### D3: 精简 RemoteResource 接口

从 `{ id, type, version?, attributes, created_at, updated_at }` 精简为 `{ id, type, version? }`。

**理由**：executor 写入 state 时只用 id 和 version，type 保留用于类型校验。两个 provider 的 adapter 都需要同步修改 `toRemoteResource()` 返回值。

### D4: StateManager.load() 向后兼容

加载时用解构 + pick 模式，只提取已知字段，忽略旧文件中的多余字段。不需要格式版本检测或迁移逻辑。

```
load(file) → JSON.parse → pick resources[] → 每个 resource 只取 address/remote_id/version/content_hash
```

### D5: Metadata 注入策略

在 mapper 层注入，不在 adapter 层。Mapper 构造 API request body 时，如果资源类型支持 metadata，则 merge 进 `agent-iac.*` 标记。

注入的 metadata key：
- `agent-iac.project`: 从 config 的 project name 取
- `agent-iac.resource`: 资源在 YAML 中的 name

覆盖范围（基于 API 能力审查）：

| 资源类型 | Claude | Qoder |
|---------|--------|-------|
| Agent | create + update | create + update |
| Environment | create + update | create + update |
| Vault | create + update | 不注入（API 不支持） |
| Skill | 不注入（API 不支持） | 不注入（update 只接受 name/description） |
| MemoryStore | N/A | 不注入（API 不支持） |

注入规则：与用户在 YAML 中声明的 metadata merge，`agent-iac.*` key 不覆盖用户已有的同名 key。

### D6: state show 输出变化

`state show` 当前直接 `JSON.stringify(found)` 输出完整 ResourceState。精简后输出自然只包含 4 个字段。这是 **BREAKING** 变更，但 state show 是诊断工具，不是机器接口，影响可接受。

## Risks / Trade-offs

- **[旧 state 文件兼容]** → load() 使用 pick 模式忽略多余字段，零风险。旧文件加载后下次 save() 会写出精简格式，不可逆但无损。
- **[attributes 删除后无法本地查看资源详情]** → 用 `GET /agents/{id}` 等 API 实时查看。可未来加 `state show --remote` flag。当前 attributes 字段从未被任何命令或逻辑读取，删除无实际影响。
- **[metadata 注入可能与用户 metadata 冲突]** → 使用 `agent-iac.` 前缀做 namespace，且不覆盖用户已有 key。Claude metadata 限制 16 对，注入 2 个占用 12.5% 配额。
- **[未来格式迁移没有 version 字段]** → 可通过字段存在性检测格式版本（有 serial → v1 旧格式，无 serial → v2 精简格式），不需要显式版本号。
