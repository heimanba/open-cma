# Provider 参考

OpenCMA 通过 Provider 适配器与不同的 AI Agent 平台交互。每个 Provider 实现统一的资源操作接口，但各平台的能力有所差异。

## 支持的 Provider

| Provider | 配置键 | 认证方式 |
|----------|--------|---------|
| Claude | `claude` | `api_key`（Anthropic API Key） |
| Qoder | `qoder` | `api_key`（个人访问令牌）+ 可选 `gateway` |

## 能力矩阵

不同 Provider 对资源类型的支持程度不同，分为三个等级：

| 等级 | 含义 |
|------|------|
| **native** | 原生支持，平台提供对应的 API |
| **emulated** | 模拟支持，通过其他原语间接实现 |
| **unsupported** | 不支持，使用时会报错并给出替代建议 |

### 资源支持对照表

| 资源类型 | Claude | Qoder | 备注 |
|---------|--------|-------|------|
| Environment | native | native | 两者均通过 API 管理云端沙箱 |
| Vault | native | native | 凭证库管理 |
| Skill | native | native | Claude 使用 files[] 上传，Qoder 使用 zip 上传 |
| Agent | native | native | 核心资源，两者均原生支持 |
| Memory Store | **unsupported** | native | Claude 无记忆存储原语，可用 Skill 或 MCP 替代 |
| MCP Server | native | native | 通过 mcp_servers 字段挂载 |
| Multi-Agent | native | **unsupported** | Qoder 无多 Agent 编排原语，可独立部署后通过 MCP 协作 |

### 不支持的资源处理

当配置中包含某 Provider 不支持的资源时：

- `validate` 阶段会输出警告诊断信息
- `plan` 阶段会跳过该资源，不生成操作
- 诊断信息中包含替代方案建议（`remediation`）

示例诊断输出：

```
claude.memory_store.unsupported:
  no memory store primitive on Claude.
  use skill knowledge or MCP for context persistence

qoder.multiagent.unsupported:
  no multiagent primitive on Qoder.
  deploy agents independently and orchestrate via MCP
```

## Provider 配置

### Claude

```yaml
providers:
  claude:
    api_key: ${ANTHROPIC_API_KEY}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `api_key` | string | 是 | Anthropic API Key，建议通过环境变量引用 |

**模型标识示例**：`claude-sonnet-4-6`、`claude-opus-4-6`

### Qoder

```yaml
providers:
  qoder:
    api_key: ${QODER_PAT}
    gateway: "https://api.qoder.com/api/v1/cloud"
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `api_key` | string | 是 | Qoder 个人访问令牌 |
| `gateway` | string | 否 | API 网关地址，默认使用 Qoder 官方网关 |

**模型标识示例**：`ultimate`、`standard`

## 多 Provider 配置

同时配置多个 Provider 时，通过 `defaults.provider` 控制默认部署目标：

```yaml
providers:
  claude:
    api_key: ${ANTHROPIC_API_KEY}
  qoder:
    api_key: ${QODER_PAT}
    gateway: "https://api.qoder.com/api/v1/cloud"

defaults:
  provider: all    # 部署到所有 Provider
  # provider: claude  # 只部署到 Claude
  # provider: qoder   # 只部署到 Qoder
```

单个资源可以通过 `provider` 字段覆盖默认值：

```yaml
agents:
  claude-agent:
    provider: claude
    model: claude-sonnet-4-6
    # ...

  qoder-agent:
    provider: qoder
    model: ultimate
    # ...
```

跨 Provider 部署时，`model` 字段使用 Record 格式为每个 Provider 指定模型：

```yaml
agents:
  universal-agent:
    model:
      claude: claude-sonnet-4-6
      qoder: ultimate
    # ...
```

## 工具名称差异

Claude 和 Qoder 的内置工具命名风格不同：

| 能力 | Claude | Qoder |
|------|--------|-------|
| 读取文件 | `read` | `Read` |
| 文件搜索 | `glob` | `Glob` |
| 文本搜索 | `grep` | `Grep` |
| 网页搜索 | `web_search` | `WebSearch` |
| 网页获取 | `web_fetch` | `WebFetch` |

OpenCMA 的 Adapter 层会自动处理这些差异，在配置中请使用目标 Provider 的原生命名。

## 数据来源

开发 Provider 适配器时，以下为各平台的官方 API 参考：

| Provider | 数据来源 | 说明 |
|----------|----------|------|
| Claude | https://platform.claude.com/llms.txt | Claude Platform API 规范 |
| Qoder | https://qoder.com/marketplace/skill?id=official_FjWvobU0 | Qoder Cloud Agents Skill 文档 |
