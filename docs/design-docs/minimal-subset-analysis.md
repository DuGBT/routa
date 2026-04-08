# Routa.js 最小子集提取分析

> 本文档分析 Routa.js 的模块边界、依赖关系和内核提取策略，为不同场景下的最小化方案提供依据。

## 1. 系统边界图 (C4 Context + Container)

### 1.1 Context 视图

```
┌─────────────┐     ┌──────────────────────────┐     ┌──────────────────┐
│             │     │                          │     │                  │
│   用户       │────▶│      Routa Platform      │◀────│  LLM Provider    │
│ (Browser/   │     │   Multi-Agent Coord.     │     │ (Anthropic/      │
│  Desktop)   │     │                          │     │  OpenAI/...)     │
│             │◀────│                          │────▶│                  │
└─────────────┘     └──────────┬───────────────┘     └──────────────────┘
                               │
                    ┌──────────┴───────────────┐
                    │                          │
               ┌────▼─────┐              ┌─────▼────┐
               │  GitHub   │              │ 本地文件   │
               │ (Webhook/ │              │ (Git Repo)│
               │  API)     │              └──────────┘
               └───────────┘
```

### 1.2 Container 视图

```
                         ┌─────────────────────────────────────────┐
                         │             Routa Platform              │
                         │                                         │
  ┌──────────┐  REST/SSE │  ┌─────────┐  JSON-RPC  ┌───────────┐  │
  │ Web UI   │◀──────────┼──│ Next.js  │◀──────────▶│  ACP API  │  │
  │ (React)  │           │  │  App     │            │  /api/acp │  │
  └──────────┘           │  └────┬─────┘            └─────┬─────┘  │
                         │       │                        │        │
  ┌──────────┐  MCP/WS   │  ┌────▼────────────────────────▼─────┐ │
  │ MCP      │◀──────────┼──│         RoutaSystem               │ │
  │ Client   │           │  │  ┌─────────────────────────────┐  │ │
  │ (IDE)    │           │  │  │      Orchestrator           │  │ │
  └──────────┘           │  │  │  (multi-agent dispatch)     │  │ │
                         │  │  └──────────┬──────────────────┘  │ │
                         │  │  ┌──────────▼──────────────────┐  │ │
                         │  │  │      MCP Server             │  │ │
                         │  │  │  (34 tools registration)    │  │ │
                         │  │  └──────────┬──────────────────┘  │ │
                         │  │  ┌──────────▼──────────────────┐  │ │
                         │  │  │      Store Layer            │  │ │
                         │  │  │  (Memory / SQLite / PG)     │  │ │
                         │  │  └─────────────────────────────┘  │ │
                         │  └───────────────────────────────────┘ │
                         │                                        │
                         │  ┌──────────────┐  ┌────────────────┐  │
                         │  │ EventBus     │  │ Specialist     │  │
                         │  │ (in-process) │  │ Registry       │  │
                         │  └──────────────┘  └────────────────┘  │
                         └─────────────────────────────────────────┘
```

### 1.3 Desktop 运行时变体

```
                         ┌─────────────────────────────────────────┐
                         │          Tauri Desktop Shell            │
                         │                                         │
  ┌──────────┐  REST/SSE │  ┌─────────┐            ┌───────────┐  │
  │ Desktop  │◀──────────┼──│  Axum    │◀──────────▶│  ACP API  │  │
  │ WebView  │           │  │  Server  │            │ (Rust)    │  │
  └──────────┘           │  │ (Rust)   │            └───────────┘  │
                         │  └────┬─────┘                            │
                         │       │ SQLite                          │
                         │  ┌────▼───────────────────────────────┐ │
                         │  │      routa-core (Rust)             │ │
                         │  │  MCP Server + Orchestrator + Store│ │
                         │  └───────────────────────────────────┘ │
                         └─────────────────────────────────────────┘
```

## 2. 模块依赖矩阵

### 2.1 一级模块分类

| 模块 | 角色 | 内部入度 | 内部出度 | 独立性 |
|------|------|---------|---------|--------|
| `models` | 类型定义 | **高** (被所有模块依赖) | 0 | ★☆☆☆☆ (叶子，但被广泛依赖) |
| `store` | 持久化接口+内存实现 | 中 (被 system/orchestrator 依赖) | 1 (models) | ★★☆☆☆ |
| `events` | 事件总线 | 中 | 1 (models) | ★★★★☆ |
| `specialists` | 角色定义 | 中 (被 orchestrator 依赖) | 1 (models) | ★★★☆☆ |
| `tools` | MCP 工具实现 | 中 | 3 (models, store, events) | ★★★☆☆ |
| `mcp` | MCP 服务器 | 中 | 4 (tools, store, events, models) | ★★☆☆☆ |
| `orchestration` | 多 agent 编排 | **高** (系统核心) | 5 (store, events, specialists, models, acp) | ★☆☆☆☆ |
| `acp` | ACP 进程管理 | 低 (仅被 orchestrator 调用) | 2 (models, store) | ★★★★☆ |
| `db` | 数据库 schema+连接 | 低 (仅被 store 依赖) | 1 (models) | ★★★★★ |
| `routa-system` | 服务容器 | **最高** (聚合点) | 全部 | ☆☆☆☆☆ (枢纽) |
| `kanban` | 看板业务 | 低 | 4 (store, events, models, mcp) | ★★★☆☆ |
| `workflows` | 工作流引擎 | 低 | 5 (store, events, models, acp, specialists) | ★★☆☆☆ |
| `notes` | 笔记(CRDT) | 低 | 4 (store, events, models, mcp) | ★★★☆☆ |
| `github` | GitHub 集成 | 低 | 4 (store, events, models, webhooks) | ★★★★☆ |
| `harness` | 仓库治理 | 低 | 3 (store, models, git) | ★★★★☆ |
| `review` | 代码审查 | 低 | 3 (store, models, events) | ★★★★☆ |
| `a2a` | Agent-to-Agent | 低 | 4 (store, events, models, mcp) | ★★★☆☆ |

**独立性说明**: ★☆☆☆☆ = 枢纽(被广泛依赖)，★★★★★ = 叶子(可直接提取)

### 2.2 模块角色分类

**叶子模块** (可独立提取，无内部依赖):
- `models` — 纯类型，零依赖
- `events` — 仅依赖 models
- `specialists` — 仅依赖 models
- `db` — 仅依赖 models

**枢纽模块** (系统骨干，拆分影响大):
- `routa-system` — 聚合所有服务
- `orchestration` — 编排核心
- `mcp` — 工具注册中心

**粘合模块** (桥接外部系统，可替换/移除):
- `github` → 可替换为 GitLab/自研
- `webhooks` → 仅 GitHub webhook 适配
- `polling` → 仅适配轮询式 ACP 客户端
- `a2a` → 可选协议适配器

## 3. 内核提取原则

### 原则 1: Store 接口化

**现状**: `src/core/store/` 已有良好的接口/实现分离（`AgentStore` 接口 → `InMemoryAgentStore` / `PgAgentStore` / `SqliteAgentStore`）。

**要求**: 提取时必须保留接口，不直接依赖具体实现。内核只需 `InMemory*Store`。

### 原则 2: Orchestrator 协议无关

**现状**: Orchestrator 通过 ACP 协议与子 agent 通信，通过 EventBus 与工具层通信。

**要求**: 编排器不应关心工具是 MCP/HTTP/本地调用。提取时 ACP 可简化为直接 `child_process.spawn`。

### 原则 3: Specialist 可插拔

**现状**: `specialist-prompts.ts` 将角色提示词硬编码为字符串常量。`specialist-db-loader.ts` 支持数据库/文件/内置三级加载。

**要求**: 内核只保留硬编码 fallback（ROUTA + CRAFTER），其余通过声明式配置加载。

### 原则 4: 事件驱动松耦合

**现状**: `EventBus` 是进程内 `EventEmitter` 封装，模块间通过事件通信（如 `agent:completed`、`task:updated`）。

**要求**: 提取时保留 EventBus，它是解耦编排器/工具/Store 的关键。

### 原则 5: 渐进式裁剪

**要求**: 从完整项目裁剪时，按依赖深度从外向内删除:
1. 先删叶子模块（github, harness, review, fitness）
2. 再删业务模块（kanban, workflows, notes, webhooks, scheduling）
3. 最后保留内核（models, store, events, orchestrator, mcp, acp）

## 4. 拆分可行性评估

### 4.1 按独立性排序（推荐提取顺序）

| 顺序 | 模块 | 独立性 | 提取难度 | 预估 LOC |
|------|------|--------|---------|---------|
| 1 | `models` | ★★★★★ | 极低 | ~200 |
| 2 | `events` | ★★★★☆ | 极低 | ~150 |
| 3 | `specialists` (core 4) | ★★★★☆ | 低 | ~500 |
| 4 | `store` (in-memory) | ★★★☆☆ | 低 | ~1500 |
| 5 | `acp` (简化) | ★★★★☆ | 中 | ~300 |
| 6 | `tools` (agent-tools) | ★★★☆☆ | 中 | ~2000 |
| 7 | `mcp` (server) | ★★☆☆☆ | 中 | ~1000 |
| 8 | `orchestration` | ★☆☆☆☆ | 高 | ~1200 |
| 9 | `routa-system` | ☆☆☆☆☆ | 高 | ~300 |

### 4.2 关键耦合点与拆分策略

| 耦合点 | 影响 | 拆分策略 |
|--------|------|---------|
| `RoutaSystem` 聚合全部 | 改任何模块可能需改 System | 提取时用简化的 `MiniSystem` 替代 |
| `McpToolManager` 57K | 工具注册与调用深度绑定 | 提取时仅保留 `agent-tools` 子集 |
| `api/acp/route.ts` 36K | Web 运行时的最大单体 | demo 中跳过，独立产品中简化为 `stdio` 传输 |
| `orchestrator.ts` 44K | 编排逻辑集中 | 提取时仅保留 delegate 路径 |

## 5. 最小内核定义

### 5.1 绝对不可约核心

```
用户 Prompt
    │
    ▼
┌─────────────┐    ┌──────────────┐    ┌─────────────┐
│ MCP Server  │───▶│ Orchestrator │───▶│ ACP Adapter │
│ (3 tools)   │◀───│ (delegate)   │◀───│ (spawn)     │
└─────────────┘    └──────┬───────┘    └─────────────┘
                          │
                   ┌──────▼───────┐
                   │  Store       │
                   │  (in-memory) │
                   └──────────────┘
```

### 5.2 内核指标

| 指标 | 值 |
|------|-----|
| 文件数 | 10-12 |
| 代码行 | ~800 |
| npm 依赖 | 2 (`@modelcontextprotocol/sdk`, `zod`) |
| 数据库 | 无（内存） |
| 外部服务 | 仅 LLM API |

### 5.3 最小演示场景

```
1. 启动 → MCP Server 在 stdio 监听
2. MCP 客户端发送 "delegate_task" 工具调用
3. Orchestrator 创建子 Agent (CRAFTER specialist)
4. ACP Adapter spawn 子进程执行任务
5. 子进程完成 → 事件回传 → 结果写入内存 Store
6. MCP 客户端查询 "query_agents" → 返回 Agent 状态
```

## 附录: 完整模块文件清单

### 内核（必需）

| 路径 | 用途 |
|------|------|
| `src/core/routa-system.ts` | 服务容器 |
| `src/core/models/*.ts` | 领域类型 |
| `src/core/store/*.ts` | Store 接口 + 内存实现 |
| `src/core/events/event-bus.ts` | 事件总线 |
| `src/core/orchestration/orchestrator.ts` | 编排引擎 |
| `src/core/orchestration/specialist-prompts.ts` | 角色提示词 |
| `src/core/orchestration/delegation-depth.ts` | 递归保护 |
| `src/core/orchestration/task-block-parser.ts` | 任务块解析 |
| `src/core/mcp/routa-mcp-server.ts` | MCP Server |
| `src/core/mcp/routa-mcp-tool-manager.ts` | 工具注册 |
| `src/core/tools/agent-tools.ts` | Agent 工具集 |
| `src/core/acp/` | ACP 进程管理 |

### 业务（可裁剪）

| 路径 | 可裁剪？ |
|------|---------|
| `src/core/kanban/` | ✓ 完全可删 |
| `src/core/workflows/` | ✓ 完全可删 |
| `src/core/notes/` | ✓ 完全可删 |
| `src/core/harness/` | ✓ 完全可删 |
| `src/core/review/` | ✓ 完全可删 |
| `src/core/github/` | ✓ 完全可删 |
| `src/core/webhooks/` | ✓ 完全可删 |
| `src/core/scheduling/` | ✓ 完全可删 |
| `src/core/polling/` | ✓ 完全可删 |
| `src/core/sandbox/` | ✓ 完全可删 |
| `src/core/worker/` | ✓ 完全可删 |
| `src/core/background-worker/` | ✓ 完全可删 |
| `src/core/a2a/` | ✓ 完全可删 |
| `src/core/ag-ui/` | ✓ 完全可删 |
| `src/core/fitness/` | ✓ 完全可删 |
| `src/core/telemetry/` | ✓ 完全可删 |
| `src/core/skill/` | ✓ 完全可删 |
| `src/core/git/` | ✓ 完全可删 |
| `src/core/storage/` | ✓ 可用内存替代 |
| `src/core/db/` | ✓ 内核可用内存 Store |
