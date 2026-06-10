## Context

CMA 使用本地 state 文件追踪已部署资源。planner 完全信任本地 state 做 create/update/no-op 决策，不查询远端。当 state 与远端不一致（丢失、部分失败、带外操作）时，create 操作触发 409 Conflict，报错信息为原始 API 响应，用户无法自助恢复。

当前 base-client 的错误处理是 `new Error(`${prefix} ${status}: ${body}`)` 纯字符串，已有的 409 处理（`deleteEnvironment`）依赖 `msg.includes("409")` 做字符串匹配。

## Goals / Non-Goals

**Goals:**
- 409 报错时给出可操作的诊断信息，指引用户恢复
- 提供 `cma state import` 命令让用户显式认领远端资源
- 引入结构化 API 错误类，让所有层可以按 statusCode 做判断
- 统一现有的字符串匹配错误判断

**Non-Goals:**
- 自动 adopt / 自动 update（显式优于隐式）
- Plan-time refresh（远端状态同步）
- 修改 state 文件格式
- 修改 planner 逻辑

## Decisions

### D1: ApiError 放在 base-client.ts 而非独立文件

**选择**: 在 `src/providers/base-client.ts` 中导出 `ApiError` 类。

**替代方案**: 新建 `src/providers/errors.ts` 或放入 `src/types/`。

**理由**: ApiError 是 BaseApiClient 的实现细节，只有 client 抛出它。types/ 不允许 class（设计原则），独立文件对一个类来说过度。executor 通过 import { ApiError } from base-client 使用即可。

### D2: ApiError 继承 Error，携带 statusCode 和 responseBody

**选择**:
```ts
export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly responseBody: string,
    prefix: string,
  ) {
    super(`${prefix} ${statusCode}: ${responseBody}`);
  }
}
```

**理由**: message 格式保持不变（向后兼容日志输出），额外属性支持程序化判断。保留 responseBody 便于诊断信息展示。

### D3: Executor 在 create 路径捕获 409，包装为可操作错误

**选择**: executor 的 `executeAction` 在每种资源类型的 create 分支中统一处理——捕获 ApiError(409)，替换为包含 import 指引的错误信息。

**替代方案**: 在 adapter 层处理（每个 adapter × 每种资源类型都要写）或在 executePlan 的外层 catch 处理（无法区分 create/update/delete 的 409）。

**理由**: executor 是唯一知道当前动作是 create 的层级。只有 create 的 409 意味着"资源已存在"，update/delete 的 409 含义不同（如版本冲突、资源被占用），不应被拦截。

实现方式——抽取 helper 函数而非在每个 switch case 中重复 try/catch：

```ts
function wrapConflictError(err: unknown, address: ResourceAddress): never {
  if (err instanceof ApiError && err.statusCode === 409) {
    const key = `${address.provider}.${address.type}.${address.name}`;
    throw new Error(
      `Resource ${address.type}.${address.name} already exists on remote (409 Conflict).\n` +
      `To adopt this resource into your state, run:\n` +
      `  cma state import ${key} <remote-id>`
    );
  }
  throw err;
}
```

在 executor 各资源 create 分支中：
```ts
case "agent": {
  try {
    result = await provider.createAgent(name, decl, refs);
  } catch (err) {
    wrapConflictError(err, address);
  }
  break;
}
```

### D4: state import 命令从配置文件计算 hash，version 传入可选

**选择**: `cma state import <provider>.<type>.<name> <remote-id> [--version <n>]`

import 流程：
1. 解析 address 三段式（provider.type.name）
2. 读取当前配置文件，查找对应资源声明
3. 调用 `computeResourceHash` 计算 content_hash
4. 调用 `state.setResource` 写入 state
5. `save()` 持久化

**version 处理**: 通过 `--version` 参数可选传入。不自动 GET 远端——import 是纯本地操作，不应依赖网络（和 `terraform import` 不同的简化选择——terraform import 会 GET 远端，但 CMA 的 version 只在 agent update 时需要，且 updateAgent 执行时会自行 GET）。

**理由**: 保持 import 为离线操作简化实现。version 在下次 update 时由 adapter 自行获取（`updateAgent` 已有 `GET /agents/{id}` 取 version 的逻辑）。

### D5: 回退 QoderAdapter 临时补丁

**选择**: 将 `createEnvironment` 和 `createAgent` 恢复为原始的裸 POST 逻辑。409 由 executor 统一处理。

### D6: deleteEnvironment 的 409 判断迁移到 ApiError

**选择**: 将 `msg.includes("in use") && !msg.includes("409")` 改为 `err instanceof ApiError && (err.statusCode === 409 || err.responseBody.includes("in use"))`。

**理由**: 409 判断不再依赖错误消息格式，且保留对 "in use" 文本的检查（因为 API 可能返回非 409 但包含 "in use" 的错误）。

## Risks / Trade-offs

**[用户需要手动输入 remote-id]** → 409 报错信息中包含原始 API 响应体，其中通常包含已存在资源的 id。用户可以从中提取。后续可考虑添加 `cma state list --remote` 命令来查询远端资源列表。

**[import 不验证远端资源是否真实存在]** → import 是纯本地操作，写入的 remote_id 如果有误，下次 update/delete 时会在 API 层面报错。这和 `cma state rm` 同样不验证远端的策略一致。

**[import 的 content_hash 基于当前配置]** → 如果配置文件在 import 前被修改过，hash 可能与远端实际状态不符，导致下次 plan 误判为 no-op（应为 update）或反之。这是可接受的——import 后运行 `cma plan` 即可看到差异。
