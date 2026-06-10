## Why

项目从 `agent-iac` 更名为 **OpenCMA**（Open Cloud Managed Agents），确立"云端托管 Agent 的开放管理标准"定位。`agent-iac` 是内部工作名称，缺乏品牌辨识度且无法传达项目愿景。OpenCMA 同时明确了三层含义：Cloud（云端场景）、Managed（全生命周期管理）、Agents（管理对象），并通过 "Open" 前缀宣告开放标准的野心。

## What Changes

- **BREAKING**: CLI 命令从 `agent-iac` 改为 `cma`
- **BREAKING**: 默认配置文件从 `agent-iac.yaml` 改为 `cma.yaml`
- **BREAKING**: 状态文件从 `agent-iac.state.json` 改为 `cma.state.json`
- **BREAKING**: Provider 元数据标签前缀从 `agent-iac.*` 改为 `cma.*`
- npm 包名从 `agent-iac` 改为 `opencma`
- bin 入口从 `agent-iac` 改为 `cma`
- 项目描述更新：体现 OpenCMA 品牌和 Cloud Managed Agents 定位
- 所有文档（README、docs/、examples/、CONTRIBUTING）中的引用更新
- GitHub 仓库相关配置（issue template 等）更新

## Capabilities

### New Capabilities

_无新功能引入——本变更仅涉及命名和品牌统一。_

### Modified Capabilities

_无需求级别的行为变更——所有功能保持不变，仅标识符更名。_

## Impact

- **CLI 入口**: `src/cli/program.ts` — 命令名、描述、所有 `--file` 默认值
- **初始化流程**: `src/cli/commands/init.ts` — 模板生成、gitignore、提示文本
- **状态管理**: `src/cli/commands/session.ts`、`src/utils/paths.ts` — 状态文件路径
- **Provider 标签**: `src/providers/claude/mapper.ts`、`adapter.ts`、`src/providers/qoder/mapper.ts` — 资源元数据标签
- **构建配置**: `package.json` — name、description、bin
- **测试**: `tests/unit/paths.test.ts`、`tests/unit/slim-state.test.ts` — 硬编码的文件名引用
- **文档**: README.md、docs/、examples/、CONTRIBUTING.md — 全部文本引用
- **CI/GitHub**: `.github/ISSUE_TEMPLATE/` — 模板中的项目引用
- **示例配置**: `agent-iac.yaml`、`agent-iac-full.yaml` — 文件本身需重命名
- **用户迁移**: 已有用户需手动重命名 `agent-iac.yaml` → `cma.yaml` 和 `agent-iac.state.json` → `cma.state.json`
