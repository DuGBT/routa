# Routa.js 实现架构流程

> 从"用户拖卡片"到"Agent 完成任务并自动推进"的完整链路解析。

## 系统分层

```
┌─────────────────────────────────────────────────────────┐
│  Presentation Layer                                      │
│  React UI → Next.js API Routes → SSE 实时推送           │
├─────────────────────────────────────────────────────────┤
│  Orchestration Layer                                     │
│  WorkflowOrchestrator → KanbanSessionQueue → EventBus   │
├─────────────────────────────────────────────────────────┤
│  Protocol Layer                                          │
│  AcpProcessManager → ProviderAdapter → A2AClient        │
├─────────────────────────────────────────────────────────┤
│  Data Layer                                              │
│  RoutaSystem → Stores × 13 (InMemory / Pg / SQLite)     │
├─────────────────────────────────────────────────────────┤
│  Agent Runtime                                           │
│  Claude Code | OpenCode | Copilot | Docker | Workspace  │
└─────────────────────────────────────────────────────────┘
```

## 全链路流程

### Step 1: 用户操作

```
用户在 UI 拖拽卡片到 "Dev" 列
         │
         ▼
PATCH /api/tasks/[taskId]  { columnId: "dev" }
```

API handler (`src/app/api/tasks/[taskId]/route.ts`) 执行四道门禁：

1. **Artifact Gate** — 目标列是否要求前置产出物？缺了就返回 400 拒绝
2. **字段校验** — 检查 Story Readiness、INVEST 验证是否通过
3. **Dev 列特殊处理** — 自动创建 Git Worktree 实现开发隔离
4. **入队执行** — 调用 `enqueueKanbanTaskSession()` 交给并发队列

### Step 2: 并发队列排队

```
KanbanSessionQueue (src/core/kanban/kanban-session-queue.ts)
         │
         ├── 检查当前 Board 已有几个 Agent 在跑
         │     ├── 未超限 → 立即开始执行
         │     └── 已超限 → 排队等待
         │
         └── 某个 Agent 完成 → drainQueue() → 下一个排队任务开始
```

每个 Board 有独立的并发上限，防止一次跑太多 Agent 打满资源。

### Step 3: 解析自动化配置

```
resolveEffectiveTaskAutomation() (src/core/kanban/effective-task-automation.ts)
         │
         ├── 优先级：卡片级覆盖 > 列级自动化 > 无
         │
         └── 解析出完整的执行计划：
               ├── specialist: "crafter" | "gate" | "developer" | "routa"
               ├── provider:  "claude" | "opencode" | "copilot" | ...
               ├── role:      实现者 | 审查者 | 规划者 | 全干
               ├── steps:     自动化步骤列表（可能多步）
               └── transport: "acp" | "a2a"
```

每张卡片可以覆盖列的默认配置，精确控制"谁来干、用什么模型"。

### Step 4: 构建 Prompt 并启动 Agent

```
triggerAssignedTaskAgent() (src/core/kanban/agent-trigger.ts)
         │
         ├── 选择传输层
         │
         ├── [ACP 路径] 内部 Agent
         │     ├── 解析 Provider（claude 可能升级为 claude-code-sdk）
         │     ├── POST /api/acp (JSON-RPC session/new) 创建会话
         │     ├── buildTaskPrompt() 构建富上下文指令：
         │     │     ├── 任务标题、描述、标签、优先级
         │     │     ├── 当前列位置和前序列信息
         │     │     ├── 上一步 Agent 的产出物摘要（artifact）
         │     │     ├── 上一轮执行记录（成功/失败/重试次数）
         │     │     ├── 可用的 MCP 工具列表及说明
         │     │     └── 自动化步骤的约束和期望输出格式
         │     └── dispatchSessionPrompt() → Agent 进程开始执行
         │
         └── [A2A 路径] 外部 Agent
               ├── 解析跨 Agent 认证配置
               └── 通过 Google A2A 协议发送给外部 Agent
```

### Step 5: Agent 执行过程

```
Agent 进程运行中
         │
         ├── Provider Adapter 层（协议转换，屏蔽差异）
         │     ├── Claude Code → NDJSON stdin/stdout → 统一事件格式
         │     ├── OpenCode    → ACP SDK            → 统一事件格式
         │     ├── Copilot     → HTTP API            → 统一事件格式
         │     └── Docker      → 容器标准输出        → 统一事件格式
         │
         ├── 实时事件推送到前端（通过 SSE）
         │     ├── tool_call     — Agent 正在调用工具
         │     ├── agent_message — Agent 输出文本
         │     └── turn_complete — Agent 完成一轮对话
         │
         └── Watchdog 定时器（30 秒轮询）
               └── 检测 Agent 是否超时无响应 → 触发恢复
```

### Step 6: Agent 完成 → 自动推进到下一列

```
Agent 完成 → EventBus.emit(AGENT_COMPLETED)
         │
         ▼
WorkflowOrchestrator.handleAgentCompletion()
         │
         ├── 质量检查（ralph_loop 模式：是否提供了验证报告？）
         │
         ├── 决策分支
         │     ├── 还有下一步骤？  → 执行下一个 Specialist
         │     ├── 质量不达标？    → 恢复重试（最多 maxRecoveryAttempts 次）
         │     └── 成功完成？      → 进入自动推进
         │
         ├── autoAdvanceCard()
         │     ├── 更新 Task 的 columnId 和 status
         │     ├── emit(COLUMN_TRANSITION) → 触发下一列的自动化！
         │     └── SSE 通知前端 → UI 自动刷新
         │
         └── drainQueue() → 队列中下一个任务开始执行
```

自动推进会产生**链式反应**：

```
Backlog 列完成 → 自动移到 Todo 列
                      │
                      ▼
                Todo 列完成 → 自动移到 Dev 列
                                    │
                                    ▼
                              Dev 列完成 → 自动移到 Review 列
                                                  │
                                                  ▼
                                            Review 列完成 → 自动移到 Done 列
```

每一列的完成都会触发下一列的 Specialist 自动接管。

### Step 7: 结果回传前端

```
KanbanEventBroadcaster → SSE 连接
         │
         ├── kanban:changed 事件
         │     ├── { entity: "task", action: "moved" }    — 卡片移动
         │     ├── { entity: "task", action: "updated" }   — 任务字段更新
         │     └── { entity: "queue", action: "updated" }  — 队列状态变化
         │
         └── 前端 React 组件监听 SSE → 自动重渲染看板
```

## 核心组件职责

### RoutaSystem — 依赖注入容器

入口文件 `src/core/routa-system.ts`，按环境自动选择存储后端：

| 环境 | 触发条件 | 存储实现 |
|------|----------|----------|
| Web (Vercel) | `DATABASE_URL` 存在 | Postgres (Neon + Drizzle ORM) |
| 本地开发 | `ROUTA_DB_DRIVER=sqlite` | SQLite (better-sqlite3) |
| 测试/演示 | 无数据库配置 | InMemory |

包含 13 个 Store、EventBus、Tools 集合，通过 `globalThis` 单例避免 HMR 丢失。

### EventBus — 事件总线

`src/core/events/event-bus.ts`，支持三种通信模式：

| 模式 | 方法 | 用途 |
|------|------|------|
| 广播 | `emit()` | Agent 完成、任务状态变更等 |
| 订阅 | `subscribe()` + priority 排序 | Agent 关注特定类型事件 |
| 等待组 | `createWaitGroup()` | Coordinator 等所有子 Agent 完成 |

关键事件类型：

- `COLUMN_TRANSITION` — 卡片跨列，驱动自动化
- `AGENT_COMPLETED` / `AGENT_FAILED` / `AGENT_TIMEOUT` — Agent 生命周期
- `ARTIFACT_REQUESTED` / `ARTIFACT_PROVIDED` — Agent 间传递产出物
- `PERMISSION_REQUESTED` / `PERMISSION_RESPONDED` — 运行时权限委派

### Specialist 角色体系

`src/core/orchestration/specialist-prompts.ts`，四个内置角色：

| 角色 | ID | 模型层级 | 职责 |
|------|-----|----------|------|
| Coordinator | `routa` | SMART | 规划、委派、验证。永不直接写代码 |
| Implementor | `crafter` | FAST | 写代码，完成后向父 Agent 汇报 |
| Verifier | `gate` | SMART | 对照验收标准审查实现 |
| Developer | `developer` | SMART | 独立规划并实现，不委派 |

角色可通过 Markdown/YAML 文件自定义，按优先级加载：数据库 > 文件 > 内置。

### Orchestrator — 多层委派

`src/core/orchestration/orchestrator.ts`，实现 Coordinator → Specialist 的委派：

```
Coordinator 收到任务
         │
         ├── checkDelegationDepth() — 最多 2 层，防无限递归
         ├── resolveSpecialist(role) — 解析角色配置
         ├── 创建子 Agent 记录
         ├── AcpProcessManager.spawn() — 启动子 Agent 进程
         ├── 注册 WaitGroup — 等待子 Agent 完成
         │
         ▼
子 Agent 完成 → WaitGroup.onComplete → 唤醒父 Agent 继续
```

## 关键设计决策

| 设计点 | 实现方式 | 解决的问题 |
|--------|----------|------------|
| 门禁机制 | 列级别配置 required artifacts/fields | Agent 不会拿到不完整的任务 |
| 并发控制 | 每个 Board 独立队列 | 多 Agent 并行不争抢资源 |
| Provider 抽象 | Adapter 模式统一协议 | 前端和上层不关心背后是 Claude 还是 GPT |
| 链式自动化 | 完成后 autoAdvance + 触发下一列 | 实现 Backlog→Done 全自动流转 |
| 恢复机制 | 失败重试，带 attempt 编号和原因 | Agent 不稳定时的容错能力 |
| Worktree 隔离 | Dev 列自动创建 Git Worktree | 多 Agent 并行开发互不冲突 |
| Prompt 富上下文 | 包含前序产出物 + 历史 + 约束 | Agent 知道上一步干了什么 |
| 双后端对等 | TypeScript + Rust 实现同一套领域逻辑 | Web 和桌面版行为一致 |

## Rust 端对应关系

Rust 端（`crates/routa-core` + `crates/routa-server`）实现了相同的架构，用于桌面端：

```
TypeScript (Web)                    Rust (Desktop)
─────────────────                   ────────────────
RoutaSystem                   ↔    State (routa-core/src/state.rs)
API Routes (src/app/api/)     ↔    Axum Routes (routa-server/src/api/)
AcpProcessManager             ↔    AcpManager (routa-core/src/acp/)
EventBus                      ↔    事件广播
KanbanWorkflowOrchestrator    ↔    kanban/automation.rs
Stores × 13                   ↔    SQLite Stores
```

两侧通过 `api-contract.yaml` 保持 API 形状一致。
