## 1. 类型定义精简

- [x] 1.1 精简 `src/types/state.ts`：StateFile 只保留 `resources[]`，ResourceState 只保留 `address`/`remote_id`/`version?`/`content_hash`
- [x] 1.2 精简 `src/providers/interface.ts`：RemoteResource 只保留 `id`/`type`/`version?`，删除 `attributes`/`created_at`/`updated_at`

## 2. StateManager 适配

- [x] 2.1 修改 `StateManager.initialize()` 不再生成 serial/lineage/version
- [x] 2.2 修改 `StateManager.load()` 使用 pick 模式，从旧格式中只提取 load-bearing 字段
- [x] 2.3 修改 `StateManager.save()` 移除 serial 递增逻辑，直接写 `{ resources }` 结构

## 3. Executor 适配

- [x] 3.1 修改 `src/executor/executor.ts` 中 `setResource()` 调用，不再传入 `created_at`/`updated_at`/`attributes`

## 4. Provider Adapter 精简

- [x] 4.1 精简 Claude adapter 的 `toRemoteResource()`：只返回 id/type/version
- [x] 4.2 精简 Qoder adapter 的 `toRemoteResource()`：只返回 id/type/version

## 5. Metadata 标记注入

- [x] 5.1 修改 Claude mapper：在 `mapEnvironment`/`mapAgent` 中注入 `agent-iac.project` 和 `agent-iac.resource`，Vault create 时也注入（Claude Vault 支持 metadata）
- [x] 5.2 修改 Qoder mapper：在 `mapEnvironment`/`mapAgent` 中注入 `agent-iac.project` 和 `agent-iac.resource`，Vault/Skill/MemoryStore 不注入
- [x] 5.3 确保 mapper 签名能接收 project name 参数（从 config 传入）
- [x] 5.4 确保用户声明的 metadata 优先于 agent-iac 注入的 key

## 6. 测试

- [x] 6.1 测试 StateManager 加载旧格式 state 文件（含 serial/lineage/attributes 等）成功且输出精简格式
- [x] 6.2 测试 StateManager 加载已精简格式 state 文件成功
- [x] 6.3 测试 executor 写入 state 后只包含 4 个 load-bearing 字段
- [x] 6.4 测试 metadata 注入：Claude Agent/Environment/Vault 包含 agent-iac.* key
- [x] 6.5 测试 metadata 注入：Qoder Agent/Environment 包含 agent-iac.* key，Vault/Skill/MemoryStore 不包含
- [x] 6.6 测试 metadata 用户优先：用户声明的 agent-iac.project 不被覆盖
