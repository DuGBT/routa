# MCP Server 设计学习报告 — 基于 Routa 项目实践

> 本报告从 Routa 项目的 MCP 实现中提炼设计原则，适合想从零设计一个生产级 MCP Server 的开发者阅读。

---

## 一、什么是 MCP

MCP（Model Context Protocol）是 Anthropic 提出的开放协议，让 AI 模型通过标准化 JSON-RPC 调用外部工具。核心概念：

- **Server**：暴露工具的一方（本项目中就是 Routa）
- **Client**：消费工具的一方（Claude Code、Copilot 等 AI agent）
- **Tool**：Server 暴露的能力单元，有 name、description、inputSchema
- **Transport**：通信方式（stdio / Streamable HTTP / WebSocket）

协议版本：`2024-11-05`（基础），Streamable HTTP 扩展 `2025-06-18`。

---

## 二、架构总览

```
AI Agent (Claude Code / Copilot / ...)
        │
        │  JSON-RPC over HTTP/WebSocket
        ▼
┌─────────────────────────────────────────┐
│  MCP Server (Routa)                      │
│                                          │
│  ┌──────────────┐   ┌─────────────────┐  │
│  │ ToolManager  │──▶│  Domain Layer   │  │
│  │ (注册/过滤)   │   │  AgentTools     │  │
│  └──────────────┘   │  NoteTools      │  │
│                     │  KanbanTools    │  │
│  ┌──────────────┐   │  WorkspaceTools │  │
│  │ Session Mgr  │   └────────┬────────┘  │
│  │ (workspace   │            │           │
│  │  作用域隔离)  │            ▼           │
│  └──────────────┘   ┌─────────────────┐  │
│                     │  Store Layer    │  │
│                     │  SQLite / PG    │  │
│                     └─────────────────┘  │
└─────────────────────────────────────────┘
```

关键分层：
1. **Transport 层**：处理协议通信（HTTP/WS），管理 session 生命周期
2. **ToolManager 层**：决定注册哪些工具，按 mode/profile 过滤
3. **ToolExecutor 层**：实际执行工具逻辑，解析上下文
4. **Domain 层**：业务逻辑（Agent、Task、Note、Kanban）
5. **Store 层**：持久化

---

## 三、核心设计模式

### 3.1 工厂模式创建 Server

**原则**：MCP Server 不是全局单例，而是**按 session 工厂创建**。

```typescript
// src/core/mcp/routa-mcp-server.ts
export function createRoutaMcpServer(options: CreateMcpServerOptions): RoutaMcpServerResult {
  const server = new McpServer({
    name: getMcpServerName(opts.mcpProfile),
    version: "0.1.0",
  });

  const toolManager = new RoutaMcpToolManager(routaSystem.tools, opts.workspaceId);
  toolManager.setToolMode(toolMode);
  toolManager.setAllowedTools(getMcpProfileToolAllowlist(opts.mcpProfile));

  if (opts.sessionId) toolManager.setSessionId(opts.sessionId);

  // 依赖注入：编排器、笔记工具、看板工具
  const orchestrator = initRoutaOrchestrator();
  toolManager.setOrchestrator(orchestrator);
  toolManager.setNoteTools(routaSystem.noteTools);
  toolManager.setKanbanTools(kanbanTools);

  toolManager.registerTools(server);
  return { server, system: routaSystem, toolManager };
}
```

**为什么这样做**：
- 每个 session 可以有不同的 workspace、toolMode、profile
- WS 连接各自独立，互不污染
- 方便测试：传入 mock 的 system

### 3.2 Allowlist 过滤模式（二维工具控制）

**原则**：用两个正交维度控制工具暴露，而不是 N 个 if-else。

```typescript
// 维度 1：Tool Mode（essential vs full）
export type ToolMode = "essential" | "full";

// 维度 2：Server Profile（coordination / kanban-planning / team-coordination）
export type McpServerProfile = "coordination" | "kanban-planning" | "team-coordination";

// 过滤逻辑：简洁的 Set.has()
private shouldRegisterTool(toolName: string): boolean {
  return !this.allowedTools || this.allowedTools.has(toolName);
}

// 注册时统一走 gate
const register = (toolName: string, callback: () => void) => {
  if (!this.shouldRegisterTool(toolName)) return;
  callback();
};
```

**设计要点**：
- `allowedTools` 为 `undefined` 时不限制（走 toolMode 分支）
- `allowedTools` 有值时只注册白名单工具（profile 精确控制）
- 两个维度独立设置，最终由 `shouldRegisterTool` 统一裁决

### 3.3 Workspace-First 作用域解析

**原则**：每个 MCP 工具调用都必须绑定到一个 workspace，避免歧义。

```typescript
// src/app/api/mcp/route.ts
function resolveWorkspaceId(request: NextRequest): string | null {
  return (
    requireWorkspaceId(request.headers.get("routa-workspace-id")) ??  // 1. Header
    requireWorkspaceId(url.searchParams.get("wsId")) ??               // 2. Query param
    requireWorkspaceId(process.env.ROUTA_WORKSPACE_ID)                 // 3. Env fallback
  );
}
```

**为什么三层 fallback**：
- **Header**：标准方式，浏览器/IDE 客户端
- **Query param**：Claude Code 等 CLI 无法自定义 header 时使用
- **Env**：单 workspace 部署时的兜底

### 3.4 Session 生命周期管理

**原则**：session 是一等的内存资源，有创建、查找、清理三个阶段。

```typescript
// 内存 Map 存储 session
const sessions = new Map<string, McpSession>();

// 请求处理：找已有 session 或创建新的
async function getOrCreateSession(request: NextRequest) {
  const sessionId = request.headers.get("mcp-session-id");
  const existing = sessionId ? sessions.get(sessionId) : undefined;

  if (existing) return existing.transport;  // 复用

  // 新 session
  const workspaceId = resolveWorkspaceId(request);
  if (!workspaceId) return missingWorkspaceResponse();

  return createSession(workspaceId, false, acpSessionId, toolMode, mcpProfile);
}

// 清理：transport 关闭时自动从 Map 中移除
transport.onclose = () => {
  sessions.delete(transport.sessionId);
};
```

### 3.5 自动初始化 + 透明重试

**原则**：客户端可能因重启丢失 session，服务端应优雅恢复。

```typescript
// 检测 "Server not initialized" 错误
if (errorBody?.error?.code === -32000 &&
    errorBody?.error?.message?.includes("not initialized")) {

  // 1. 创建新 session
  const freshTransport = await createSession(wsId, ...);

  // 2. 发送 initialize
  await freshTransport.handleRequest(initRequest);

  // 3. 发送 notifications/initialized
  await freshTransport.handleRequest(notifRequest);

  // 4. 重放原始请求
  const retryResponse = await freshTransport.handleRequest(retryRequest);

  // 5. 在响应头中返回新 session ID
  retryHeaders.set("mcp-session-id", newSessionId);
}
```

这保证了 agent 重启后无需手动重新初始化。

### 3.6 兼容性修补

**原则**：不能假设所有客户端都完美遵守协议，在服务端做防御性修补。

```typescript
// Claude Code 不发 text/event-stream 导致 406
function ensureAcceptHeader(request: NextRequest, ...required: string[]): NextRequest {
  const current = request.headers.get("accept") ?? "";
  const missing = required.filter(r => !current.includes(r));
  if (missing.length === 0) return request;

  const patched = [current, ...missing].filter(Boolean).join(", ");
  return new NextRequest(request.url, { method: request.method, headers, body: request.body });
}
```

---

## 四、传输层设计

### 4.1 双传输架构

```
┌──────────────────────────────────────┐
│     RoutaMcpHttpServer               │
│                                      │
│  ┌──────────────────────────────┐    │
│  │  Node.js HTTP Server         │    │
│  │                              │    │
│  │  POST/GET/DELETE /mcp       │─────▶ StreamableHTTPServerTransport
│  │                              │         ↕
│  │  Upgrade: WebSocket /ws     │─────▶ WebSocketServerTransport
│  │                              │         ↕
│  └──────────────────────────────┘    │    McpServer (with tools)
│                                      │
│  Port 0 (OS 动态分配)                 │
└──────────────────────────────────────┘
```

**为什么 port 0**：与 Next.js 的 3000 端口共存，不冲突。操作系统自动分配可用端口。

### 4.2 每个 WS 连接独立 Server 实例

```typescript
private async handleWebSocketConnection(ws: WebSocket) {
  // 每个连接一个全新的 MCP Server
  const transport = new WebSocketServerTransport(ws);
  const { server } = createRoutaMcpServer({
    workspaceId: this.workspaceId,
    toolMode: this._toolMode,
  });
  await server.connect(transport);
}
```

**原因**：MCP 协议的 session 状态绑定在 transport 上，复用会导致状态混乱。

### 4.3 Next.js Route 内嵌方式

当不需要独立端口时，可以直接用 Next.js API Route：

```typescript
// src/app/api/mcp/route.ts
const transport = new WebStandardStreamableHTTPServerTransport({
  sessionIdGenerator: () => crypto.randomUUID(),
  enableJsonResponse: true,  // 兼容不支持 SSE 的客户端
  onsessioninitialized: (sid) => {
    sessions.set(sid, { transport, workspaceId });
  },
});

const { server } = createRoutaMcpServer({ workspaceId, toolMode });
await server.connect(transport);
```

`WebStandardStreamableHTTPServerTransport` 是 MCP SDK 提供的 Web Standard API 版本，可以直接在 Next.js Route 中使用。

---

## 五、Provider 适配层

**原则**：不同 AI provider 接入 MCP 的方式不同，用适配器模式统一。

```typescript
// src/core/acp/mcp-setup.ts
export function providerSupportsMcp(providerId: string): boolean {
  return providerId === "claude";  // 目前只有 Claude Code 支持
}

export async function ensureMcpForProvider(providerId: string, config?): Promise<McpSetupResult> {
  if (!providerSupportsMcp(providerId)) {
    return { mcpConfigs: [], summary: `${providerId}: MCP not supported` };
  }

  // Claude Code: inline JSON
  return ensureMcpForClaude(mcpEndpoint, workspaceId, customServers);
}

function ensureMcpForClaude(endpoint, workspaceId, customServers) {
  const json = JSON.stringify({
    mcpServers: {
      "routa-coordination": {
        url: endpoint,
        type: "http",
        env: { ROUTA_WORKSPACE_ID: workspaceId },
      },
      // 合并用户自定义的 MCP server
      ...mergeCustomMcpServers(builtIn, customServers),
    },
  });
  return { mcpConfigs: [json] };  // 传给 --mcp-config
}
```

**设计要点**：
- `ensureMcpForProvider` 是统一入口，内部按 provider 分发
- 返回 `McpSetupResult`（配置字符串 + 日志摘要），不关心具体怎么传
- 自定义 MCP server 通过 `mergeCustomMcpServers` 合并

---

## 六、可扩展性：自定义 MCP Server

**原则**：用户可以注册额外的 MCP Server，与内置 server 共存。

```typescript
// src/core/store/custom-mcp-server-store.ts
export interface CustomMcpServerConfig {
  id: string;
  name: string;
  type: "stdio" | "http" | "sse";  // 三种传输类型
  command?: string;    // stdio 类型需要
  args?: string[];
  url?: string;        // http/sse 类型需要
  headers?: Record<string, string>;
  env?: Record<string, string>;
  enabled: boolean;
  workspaceId?: string;  // 可以限定 workspace 范围
}
```

支持三种 MCP 传输类型，用户在 UI 上配置后存入 DB，agent 启动时自动加载并合并到 `mcpServers` 配置中。

---

## 七、Rust 端对等实现

**原则**：关键协议层做双运行时，保证语义一致。

```rust
// crates/routa-core/src/mcp/mod.rs
use rmcp::{handler::server::tool::ToolRouter, tool, tool_handler, tool_router, ServerHandler};

#[derive(Clone)]
pub struct RoutaMcpServer {
    state: AppState,
    tool_router: ToolRouter<Self>,
}

#[tool_router]
impl RoutaMcpServer {
    #[tool(description = "List all agents in the default workspace")]
    async fn list_agents(&self) -> Result<CallToolResult, ErrorData> {
        let agents = self.state.agent_store.list_by_workspace("default").await
            .map_err(|e| ErrorData::internal_error(e.to_string(), None))?;
        Ok(CallToolResult::success(vec![Content::text(serde_json::to_string_pretty(&agents)?)]))
    }
}
```

Rust 用 `rmcp` crate 的过程宏（`#[tool]`、`#[tool_router]`）声明式定义工具，比 TS 的命令式注册更简洁。两端工具集通过 `api-contract.yaml` 保持对等。

---

## 八、工具定义的最佳实践

### 8.1 用 Zod 定义输入 Schema

```typescript
server.tool(
  "create_task",
  "Create a new task in the task store. Returns the taskId for later delegation.",
  {
    title: z.string().describe("Task title"),
    objective: z.string().describe("What this task should achieve"),
    workspaceId: z.string().optional().describe("Workspace ID (uses default if omitted)"),
    scope: z.string().optional().describe("What files/areas are in scope"),
    acceptanceCriteria: z.array(z.string()).optional().describe("List of acceptance criteria"),
    testCases: z.array(z.string()).optional().describe("Human-readable test cases"),
    verificationCommands: z.array(z.string()).optional().describe("Commands for verification"),
    dependencies: z.array(z.string()).optional().describe("Task IDs that must complete first"),
  },
  async (params) => {
    const result = await this.tools.createTask({
      ...params,
      workspaceId: params.workspaceId ?? this.workspaceId,  // 默认值兜底
    });
    return this.toMcpResult(result);
  }
);
```

### 8.2 工具设计要点

| 原则 | 说明 |
|------|------|
| **description 要写清楚** | AI 根据 description 决定是否调用工具 |
| **参数可选优于必填** | `workspaceId` 等上下文参数用 `.optional()` + 兜底值 |
| **返回结构化数据** | JSON 而非纯文本，方便 AI 解析 |
| **错误也要结构化** | 用 `isError: true` + JSON error body |
| **幂等设计** | 同样参数多次调用结果一致（至少读操作如此） |

---

## 九、关键依赖

| 语言 | SDK | 版本 | 用途 |
|------|-----|------|------|
| TypeScript | `@modelcontextprotocol/sdk` | `^1.29.0` | MCP 协议实现 |
| TypeScript | `zod` | — | 工具输入 Schema 校验 |
| TypeScript | `ws` | — | WebSocket 传输 |
| Rust | `rmcp` | `0.15` | Rust MCP SDK |
| Rust | `schemars` | — | JSON Schema 生成 |

---

## 十、设计 Checklist

设计一个生产级 MCP Server 时，检查以下要点：

- [ ] **Transport 选型**：stdio（本地 CLI）/ Streamable HTTP（远程）/ WebSocket（长连接）
- [ ] **Session 管理**：每个 session 独立状态，有创建/查找/清理机制
- [ ] **作用域隔离**：workspace/user/tenant 维度的数据隔离
- [ ] **工具分级**：essential vs full，按模型能力/场景暴露不同工具集
- [ ] **Provider 适配**：不同 AI 客户端的 MCP 配置方式可能不同
- [ ] **兼容性修补**：Accept header、session 过期等边界情况
- [ ] **CORS**：如果 Web 客户端需要跨域访问
- [ ] **自定义扩展**：允许用户注册额外 MCP Server
- [ ] **健康检查**：`/health` 端点，返回 session 数量等信息
- [ ] **优雅关闭**：关闭所有 transport 和 server 连接
- [ ] **日志**：每个请求的 method、session、accept header 记录
- [ ] **双运行时**（可选）：如果需要 Rust 端，保证工具语义对等

---

## 附录：项目文件索引

| 文件 | 职责 |
|------|------|
| `src/core/mcp/routa-mcp-server.ts` | Server 工厂函数 |
| `src/core/mcp/routa-mcp-tool-manager.ts` | 工具注册与过滤 |
| `src/core/mcp/mcp-server-profiles.ts` | Profile 定义与 allowlist |
| `src/core/mcp/tool-mode-config.ts` | 全局 essential/full 配置 |
| `src/core/mcp/routa-mcp-http-server.ts` | 独立 HTTP+WS Server |
| `src/core/mcp/ws-server-transport.ts` | WS 传输适配器 |
| `src/core/mcp/mcp-server-singleton.ts` | 单例生命周期管理 |
| `src/core/mcp/mcp-tool-executor.ts` | 工具执行逻辑 |
| `src/app/api/mcp/route.ts` | Next.js Streamable HTTP 端点 |
| `src/core/acp/mcp-setup.ts` | Provider MCP 适配 |
| `src/core/acp/mcp-config-generator.ts` | MCP endpoint URL 生成 |
| `src/core/store/custom-mcp-server-store.ts` | 自定义 MCP Server 存储 |
| `crates/routa-core/src/mcp/mod.rs` | Rust MCP Server |
| `crates/routa-core/src/acp/mcp_setup.rs` | Rust MCP 配置注入 |
| `crates/routa-server/src/api/mcp_routes.rs` | Rust Axum MCP 路由 |
