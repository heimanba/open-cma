# OpenCMA

![OpenCMA — AI Agent 的 Terraform](https://img.alicdn.com/imgextra/i3/O1CN01iQ3vJS1PJbzBTBcIM_!!6000000001820-2-tps-1536-1024.png)

Open Cloud Managed Agents —— 用声明式 YAML 管理云端 AI Agent 基础设施，像 Terraform 管云资源一样管 Agent。

一份配置文件定义 Agent 的运行环境、模型、指令、工具、技能和凭证，通过 `plan` / `apply` / `destroy` 工作流统一管理，支持多 Provider（Claude、Qoder）同时部署。

## 特性

- **声明式配置** —— 一个 `cma.yaml` 文件描述全部 Agent 基础设施，可 Git 版本管理、可审查、可回滚
- **Terraform 式工作流** —— `validate → plan → apply`，变更前先预览，心中有数再执行
- **多 Provider 支持** —— 同一份配置同时部署到 Claude 和 Qoder，也可单独指定
- **增量变更** —— 基于内容哈希检测变化，只更新有差异的资源，不做无意义操作
- **依赖自动解析** —— Environment → Skill → Agent 按拓扑序创建，依赖出错自动跳过下游
- **State Drift 恢复** —— 检测远程配置与声明的漂移，提供恢复方案，声明式配置始终是 Single Source of Truth

## 快速开始

### 安装

```bash
bun install
```

### 初始化项目

```bash
bun run dev init
```

交互式向导会引导你选择 Provider 并生成 `cma.yaml` 模板。

### 编辑配置

生成的模板是一个最简 Agent，编辑它来定义你的 Agent：

```yaml
version: "1"

providers:
  claude:
    api_key: ${ANTHROPIC_API_KEY}

defaults:
  provider: claude

environments:
  dev:
    config:
      type: cloud
      networking:
        type: unrestricted

agents:
  assistant:
    description: "通用编程助手"
    model: claude-sonnet-4-6
    instructions: |
      你是一个编程助手，可以阅读文件、搜索代码库并协助代码审查。
    environment: dev
    tools:
      builtin: [read, glob, grep, web_search, web_fetch]
```

### 校验配置

```bash
bun run dev validate
```

离线检查 YAML 结构和字段合法性，不发起任何 API 调用。

### 预览变更

```bash
bun run dev plan
```

对比当前配置与远程状态，列出将要执行的 create / update / delete 操作：

```
$ cma plan

  ~ agent.researcher   update (instructions changed)
  + agent.reviewer     create
  + agent.lead         create (depends: researcher, reviewer)

  Plan: 1 to update, 2 to create, 0 to destroy.
```

### 执行变更

```bash
bun run dev apply
```

按依赖拓扑序创建或更新资源，执行前会要求确认。加 `-y` 跳过确认。

```
$ cma apply -y

  ✓ agent.researcher   updated
  ✓ agent.reviewer     created
  ✓ agent.lead         created

  Apply complete. 3 resources managed.
```

### 销毁资源

```bash
bun run dev destroy
```

销毁所有由 OpenCMA 管理的远程资源。

## 核心概念

OpenCMA 管理以下资源类型，它们之间的关系如下：

```
┌──────────────────────────────────────────────────────┐
│                     cma.yaml                         │
│                                                      │
│  ┌─────────────┐  ┌────────┐  ┌──────────────────┐  │
│  │ Environment │  │ Vault  │  │  Memory Store    │  │
│  │  运行环境    │  │ 凭证库  │  │  记忆存储         │  │
│  └──────┬──────┘  └───┬────┘  └────────┬─────────┘  │
│         │             │                │             │
│         └─────────────┼────────────────┘             │
│                       ▼                              │
│              ┌────────────────┐                      │
│              │     Agent      │                      │
│              │ 模型+指令+工具  │                      │
│              └───┬────────┬───┘                      │
│                  │        │                          │
│           ┌──────┘        └──────┐                   │
│           ▼                      ▼                   │
│    ┌────────────┐        ┌────────────┐              │
│    │   Skill    │        │ MCP Server │              │
│    │  技能包     │        │  外部工具   │              │
│    └────────────┘        └────────────┘              │
│                                                      │
│         ┌──────────────────────┐                     │
│         │    Multi-Agent       │                     │
│         │  coordinator 协作模式 │                     │
│         └──────────────────────┘                     │
└──────────────────────────────────────────────────────┘
```

| 资源类型 | 说明 |
|---------|------|
| **Environment** | Agent 的云端运行环境，配置网络策略和预装包 |
| **Vault** | 凭证库，管理 MCP Server 的访问令牌 |
| **Skill** | 技能包，从本地目录上传的可复用能力模块 |
| **Memory Store** | 记忆存储，为 Agent 提供持久化上下文（仅 Qoder） |
| **MCP Server** | 外部工具服务器，通过 MCP 协议接入第三方能力 |
| **Agent** | 核心资源，组合上述所有元素定义一个完整的 AI Agent |
| **Multi-Agent** | 多 Agent 协作，coordinator 模式下由一个 Agent 调度其他 Agent（仅 Claude） |

## 命令参考

| 命令 | 说明 | 常用选项 |
|------|------|---------|
| `init` | 创建 `cma.yaml` 模板 | |
| `validate` | 离线校验配置文件 | `-f <path>` 指定配置文件 |
| `plan` | 预览变更计划 | `--provider <name>` 指定 Provider，`--json` JSON 输出 |
| `apply` | 执行变更 | `-y` 跳过确认，`--provider <name>` 指定 Provider |
| `destroy` | 销毁所有托管资源 | `-y` 跳过确认，`--cascade` 级联删除依赖资源 |
| `state list` | 列出状态文件中的所有资源 | |
| `state show <address>` | 查看某个资源的详细状态 | |
| `state rm <address>` | 从状态文件中移除资源（不删除远程） | |
| `session create <agent>` | 为 Agent 创建运行时 Session | `--environment`、`--vault`、`--title`、`--provider` |
| `session list` | 列出 Session | `--agent` 按 Agent 过滤，`--provider` |
| `session get <id>` | 查看 Session 详情 | `--provider` |
| `session delete <id>` | 删除 Session | `--provider` |

## 示例

`examples/` 目录包含多种配置场景，按 Provider 和复杂度组织：

**Claude**

| 示例 | 说明 |
|------|------|
| [basic](examples/claude/basic/) | 最简单的 Claude Agent |
| [with-skills](examples/claude/with-skills/) | 挂载技能包 |
| [with-mcp](examples/claude/with-mcp/) | 接入 MCP Server + Vault |
| [multiagent](examples/claude/multiagent/) | 多 Agent coordinator 协作 |
| [full](examples/claude/full/) | 完整特性展示 |
| [multi-provider](examples/claude/multi-provider/) | 同时部署到 Claude + Qoder |

**Qoder**

| 示例 | 说明 |
|------|------|
| [basic](examples/qoder/basic/) | 最简单的 Qoder Agent |
| [with-skills](examples/qoder/with-skills/) | 挂载技能包 |
| [with-memory](examples/qoder/with-memory/) | 使用 Memory Store |
| [full](examples/qoder/full/) | 完整特性展示 |
| [multi-provider](examples/qoder/multi-provider/) | 同时部署到 Claude + Qoder |

## 多 Provider 切换

同一份 Agent 定义，切换 Provider 只需改两行：

```yaml
# 部署到 Claude
providers:
  claude:
    api_key: ${ANTHROPIC_API_KEY}
defaults:
  provider: claude

# 换到 Qoder？改两行
providers:
  qoder:
    api_key: ${QODER_PAT}
    gateway: "https://api.qoder.com/api/v1/cloud"
defaults:
  provider: qoder
```

## 环境变量

在 `.env` 文件中配置，OpenCMA 会自动加载（Bun 内置支持）。

配置文件中通过 `${VAR_NAME}` 语法引用环境变量。

| 变量 | 说明 | 用途 |
|------|------|------|
| `ANTHROPIC_API_KEY` | Anthropic API 密钥 | Claude Provider 认证 |
| `QODER_PAT` | Qoder 个人访问令牌 | Qoder Provider 认证 |
| `MCP_*` | MCP Server 相关令牌 | Vault 凭证引用 |

## 进阶文档

| 文档 | 说明 |
|------|------|
| [配置指南](docs/configuration.md) | 渐进式配置教程，从最简到完整 |
| [Provider 参考](docs/providers.md) | Provider 能力矩阵与差异说明 |
| [工作原理](docs/how-it-works.md) | 状态管理、依赖图、增量检测 |

## 许可证

MIT
