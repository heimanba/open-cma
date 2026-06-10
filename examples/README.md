# Examples

按 provider 组织的 OpenCMA 配置示例。

## 目录结构

```
examples/
├── claude/                      ← Claude provider
│   ├── basic/                   最简单 agent
│   ├── with-skills/             skill + 文件引用 instructions
│   ├── with-mcp/               MCP server + vault + 受限网络
│   ├── multiagent/             coordinator 多 agent 协作 (Claude 独有)
│   ├── multi-provider/          同一 agent 同时部署到 Claude + Qoder
│   └── full/                    Claude 全功能组合
├── qoder/                       ← Qoder provider
│   ├── basic/                   最简单 agent
│   ├── with-skills/             skill + 文件引用 instructions
│   ├── with-mcp/               MCP server + vault + 受限网络
│   ├── with-memory/            memory_store (Qoder 独有)
│   ├── multi-provider/          同一 agent 同时部署到 Claude + Qoder
│   └── full/                    Qoder 全功能组合
└── runtime/                     ← 运行时示例 (创建 Session + 流式响应)
    ├── run-session.ts           简单对话
    └── run-session-complex.ts   工具调用 + 流式事件
```

## Provider 能力对比

| Feature | Claude | Qoder | 说明 |
|---------|--------|-------|------|
| Environment | native | native | 两者都支持 |
| Vault | native | native | MCP 凭证管理 |
| Skill | native | native | Claude 用 files[] 上传，Qoder 用 zip 上传 |
| Agent | native | native | 两者都支持 |
| MCP Server | native | native | 远程 MCP 服务集成 |
| **Memory Store** | unsupported | **native** | **仅 Qoder 支持** |
| **Multiagent** | **native** | unsupported | **仅 Claude 支持** |

## 工具命名差异

| 功能 | Claude (小写) | Qoder (PascalCase) |
|------|---------------|---------------------|
| 读文件 | `read` | `Read` |
| 文件搜索 | `glob` | `Glob` |
| 内容搜索 | `grep` | `Grep` |
| 网页抓取 | `web_fetch` | `WebFetch` |
| 网页搜索 | `web_search` | `WebSearch` |
| 写文件 | `write` | `Write` |
| 编辑文件 | `edit` | `Edit` |
| Shell | `bash` | `Bash` |

> 在 `defaults.provider: all` 模式下统一用小写即可，部署到 Qoder 时自动转换。

## Quick Start

```bash
cma init                       # 交互式初始化
cma validate                   # 离线校验
cma plan                       # 查看执行计划
cma plan --provider claude     # 只看 Claude 的计划
cma plan --provider qoder      # 只看 Qoder 的计划
cma apply                      # 应用变更
cma apply -y                   # 跳过确认
cma destroy                    # 销毁所有资源
cma state list                 # 查看已管理的资源

# Session 管理（运行时）
cma session create assistant   # 为 agent 创建 session
cma session list               # 列出所有 session
cma session list --agent assistant  # 按 agent 过滤
cma session get sess_abc123    # 查看 session 详情
cma session delete sess_abc123 # 删除 session
```
