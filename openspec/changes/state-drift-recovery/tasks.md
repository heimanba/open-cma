## 1. ApiError 结构化错误

- [x] 1.1 在 `src/providers/base-client.ts` 中新增 `ApiError` 类（extends Error，含 statusCode、responseBody 属性），导出
- [x] 1.2 将 `BaseApiClient` 的 `get`、`post`、`put`、`delete` 方法的错误抛出从 `new Error(...)` 改为 `new ApiError(...)`
- [x] 1.3 将 `QoderClient.postFormData` 的错误抛出改为 `new ApiError(...)`
- [x] 1.4 将 `QoderAdapter.deleteEnvironment` 中的 `msg.includes("409")` 迁移为 `err instanceof ApiError && err.statusCode === 409`

## 2. Executor 409 诊断增强

- [x] 2.1 在 `src/executor/executor.ts` 中新增 `wrapConflictError(err, address)` helper 函数
- [x] 2.2 在 `executeAction` 的每个资源类型 create 分支中包裹 try/catch 调用 `wrapConflictError`

## 3. 回退临时补丁

- [x] 3.1 将 `QoderAdapter.createEnvironment` 恢复为原始裸 POST 逻辑（移除 try/catch 409 fallback）
- [x] 3.2 将 `QoderAdapter.createAgent` 恢复为原始裸 POST 逻辑（移除 try/catch 409 fallback）

## 4. State Import 命令

- [x] 4.1 在 `src/cli/commands/state.ts` 中新增 `stateImportCommand` 函数，解析三段式地址 + remote-id + 可选 --version
- [x] 4.2 import 逻辑：读取配置文件、校验资源声明存在、检查 state 中无重复、计算 content_hash、写入 state 并保存
- [x] 4.3 在 `src/cli/program.ts` 的 stateCmd 下注册 `import` 子命令

## 5. 验证

- [x] 5.1 typecheck 通过（`bun run typecheck`）
- [x] 5.2 现有测试通过（`bun test`）
