# OpenCMA：AI Agent 的 Terraform

**用声明式 YAML 管理云端 AI Agent 基础设施，让 Agent 部署像管理云资源一样可控、可审计、可迁移。**

![OpenCMA — AI Agent 的 Terraform](https://img.alicdn.com/imgextra/i3/O1CN01iQ3vJS1PJbzBTBcIM_!!6000000001820-2-tps-1536-1024.png)

---

## Agent 强了，管理没跟上

Agent 的能力演进很快：从 Dify/Coze 的 Workflow 拖拽，到 LangChain/CrewAI 的代码框架，再到 Claude Code/Codex 这样的通用 Agent——Coding Agent 证明了一件事：**一个通用 Agent + 合适的工具 + 足够的上下文，就能处理任意复杂任务。**

与此同时，Agent 的运行形态也在变：从本地分钟级任务，到云端小时级长程执行；从每步都需要人确认，到定时触发、无人值守。Loop Engineering 已经是社区共识——一个 Automation-Ready 的 Agent 需要调度、隔离、知识、连接器和多 Agent 协作。

**但问题是：这些能力的配置和管理，今天还停留在各平台的 Web UI 里。**

- 改了什么？谁改的？——没有记录
- 出了问题想回滚？——手动恢复
- 想同时部署到多个平台？——重复配一遍
- 想纳入 CI/CD？——没有接口

Agent 本身够强了，缺的是一个基础设施管理层。

---

## Remote Agent 有了参考架构

Claude 推出的 Claude Managed Agents（CMA）率先定义了 Remote Agent 的运行模型：**Agent**（配置：模型、指令、工具、MCP）+ **Environment**（运行时：云端或自托管沙盒）+ **Session**（执行实例：长程任务、状态持久化）+ **Events**（交互协议：用户消息、工具结果、状态更新）。

虽然 CMA 是 Anthropic 的产品，但其架构设计指向开放：支持自托管沙盒、事件流可观测、Agent 配置与执行实例解耦。长程执行、状态持久化、事件驱动——这些特性正在让 CMA 成为 Remote Agent 的**参考架构**。

但 CMA 的 API 是命令式的：创建 agent、启动 session、发送事件、轮询状态……每一步都要写代码调用。当 Agent 基础设施复杂起来时，命令式 API 的管理成本会急剧上升。

**OpenCMA 回答的是：如果 Remote Agent 已经有了参考架构，为什么不用声明式配置来管理它？**

---

## OpenCMA 是什么

**OpenCMA 之于 CMA，就是 Terraform 之于云资源 API。**

一个 YAML 文件定义你的全部 Agent 基础设施——运行环境、模型、指令、工具、技能、凭证、多 Agent 协作——然后用 `plan` / `apply` / `destroy` 工作流统一管理。

```yaml
version: "1"

providers:
  claude:
    api_key: ${ANTHROPIC_API_KEY}

environments:
  dev:
    config:
      type: cloud
      networking:
        type: unrestricted

skills:
  code-review:
    source: ./skills/code-review/
    description: "Structured code review with severity levels"

agents:
  researcher:
    model: claude-sonnet-4-6
    instructions: |
      You are a research agent. Search the codebase and web
      to gather relevant information.
    environment: dev
    tools:
      builtin: [read, glob, grep, web_search, web_fetch]

  reviewer:
    model: claude-sonnet-4-6
    instructions: |
      You are a code reviewer. Focus on correctness, security,
      and performance.
    environment: dev
    skills: [code-review]

  lead:
    model: claude-sonnet-4-6
    instructions: ./prompts/lead.md
    environment: dev
    mcp_servers:
      - name: github
        url: "https://mcp.example.com/github"
    multiagent:
      type: coordinator
      agents: [researcher, reviewer]
```

```bash
$ cma plan

  ~ agent.researcher   update (instructions changed)
  + agent.reviewer     create
  + agent.lead         create (depends: researcher, reviewer)

  Plan: 1 to update, 2 to create, 0 to destroy.

$ cma apply -y

  ✓ agent.researcher   updated
  ✓ agent.reviewer     created
  ✓ agent.lead         created

  Apply complete. 3 resources managed.
```

![OpenCMA CLI 完整工作流演示](https://img.alicdn.com/imgextra/i1/O1CN015hqXm927QnI54KUBD_!!6000000007792-1-tps-1200-700.gif)

---

## "Open" 是第一设计原则

名字里的 "Open" 不是装饰。**Terraform 解决了云资源的厂商锁定，OpenCMA 解决的是 Agent 平台的厂商锁定。**

每个 Agent 平台都定义了自己的配置格式和 API——Claude、Qoder、百炼——Agent 一旦配好就被锁死在一个平台上。OpenCMA 的回答是：

- **配置格式开放** — 纯 YAML，不发明 DSL，不绑定任何平台私有概念
- **Provider 可插拔** — 标准六文件结构，任何人可以为自己的平台写适配器
- **状态透明** — 本地 JSON state 文件，不依赖任何远程后端，你拥有自己的数据
- **迁移自由** — 从平台 A 迁到平台 B，改一行 `provider:` 字段

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

同一份 Agent 定义，不同平台运行。这不是 feature，是立场。

---

## 五项核心能力

### 1. 一个 YAML 管全部

Agent / Environment / Skill / MCP Server / Vault / Multi-Agent 协作——全部在一个文件里声明。可以 Git 版本管理，可以 PR review，可以 rollback。

### 2. Plan 再 Apply

变更前先看 diff，心中有数再执行。和 Terraform 一样的 `validate → plan → apply` 工作流，DevOps 团队零学习曲线。

### 3. 多 Provider 中立

一份配置同时部署到 Claude 和 Qoder，也可以单独指定。Provider 是插件，不是前提。

### 4. 增量变更 + 依赖拓扑

基于内容哈希检测变化，只更新有差异的资源。按 Environment → Skill → Agent 拓扑序操作，上游失败自动跳过下游，不做无意义操作。

### 5. State Drift 检测与恢复

有人在 UI 上手动改了配置？OpenCMA 检测到漂移，提供恢复方案——让声明式配置始终是 Single Source of Truth。

---

## 对接 Loop Engineering 共识

最近社区讨论的 [Loop Engineering](https://x.com/addyosmani/status/2064127981161959567) 指出一个 Automation Agent 需要五样东西。OpenCMA 为这五样东西提供了声明式管理层：

| Loop Engineering 要求 | OpenCMA 如何回应 |
|---|---|
| **Scheduled Automations** | `plan → apply` 天然适配 CI/CD 触发，配置变更可以是 cron、PR merge hook、或 ChatOps |
| **Worktrees（并行隔离）** | 每个 Agent 独立资源生命周期，多 Agent 并行部署互不干扰 |
| **Skills（项目知识）** | `skills:` 是一等资源类型——把项目知识打包上传，Agent 不用猜 |
| **Plugins & Connectors** | `mcp_servers:` + `vault:` 声明式接入外部工具，凭证统一管理 |
| **Sub-agents（多 Agent 协作）** | `multiagent: coordinator` 模式，一个 Agent 调度多个 Agent |

Loop Engineering 描述了 Agent 需要什么能力，OpenCMA 回答的是：**这些能力的配置不应该被任何单一平台垄断定义。**

---

## 为谁设计

- **平台方** — 迁移工具就是获客漏斗；标准制定者就是生态位占领者
- **开发团队** — Agent 配置纳入 GitOps 流程，可审查、可 CI 校验、可一键回滚
- **多平台用户** — 不被锁定，一份配置走天下

---

## 当前状态

- **v0.1.0**，端到端流程已跑通
- **49 个源文件，6 个运行时依赖**，TypeScript + Bun，无框架包袱
- 已验证 **Claude** 和 **Qoder** 两个 Provider 的完整生命周期管理
- 完整 CLI：`init` / `validate` / `plan` / `apply` / `destroy` / `state` / `session`

## Roadmap

| 阶段 | 目标 |
|------|------|
| **短期** | 接入百炼 CMA 作为 Provider；发布 Open-CMA 配置规范 |
| **中期** | Coze / Dify → CMA 迁移适配器；开源发布 |
| **长期** | Remote State 协作；CI/CD 深度集成；成为 Agent 基础设施管理的事实标准 |

---

## 快速开始

GitHub: [https://github.com/heimanba/open-cma](https://github.com/heimanba/open-cma)

```bash
# 克隆仓库
git clone https://github.com/heimanba/open-cma.git
cd open-cma

# 安装
bun install

# 初始化项目（交互式引导）
bun run dev init

# 校验配置
bun run dev validate

# 预览变更
bun run dev plan

# 执行部署
bun run dev apply
```

30 秒从零到一个云端 Agent。

---

> **Terraform 让"基础设施即代码"成为云计算的共识。OpenCMA 要做的，是让"Agent 即代码"成为 AI 时代的共识。**

---

**Star & Contribute:** [github.com/heimanba/open-cma](https://github.com/heimanba/open-cma)
