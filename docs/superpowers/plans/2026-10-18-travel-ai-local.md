# Travel AI 本地工程实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现可以通过 Docker Compose 本地运行的旅游 AI 工程，包含八个工具、SSE、认证和可管理的用户记忆，并交付中文知识体系文档。

**Architecture:** pnpm workspace 下部署 React Web、NestJS API 和 PostgreSQL。shared 集中定义 Zod 数据契约；LangGraph 编排 DeepSeek 与工具；demo 模式离线验证业务，live 模式调用真实供应商。

**Tech Stack:** React、TypeScript、TailwindCSS、Ant Design、Vite、NestJS、Prisma、PostgreSQL、LangChain、LangGraph、DeepSeek、Vitest、Playwright、Docker Compose。

**Spec:** ../specs/2026-10-18-travel-ai-design.md

**执行结果：** 用户已确认并授权当前会话实施。任务1–6及文档/云端配置已实现；任务7的镜像构建和容器运行验收受 Docker 引擎不可用阻塞。具体通过项、技术裁决和未验证事项以 ../../implementation-progress.md 与 ../../verification.md 为准；原始步骤保留作为复验清单。

## Global Constraints

- 使用模块化单体与 pnpm workspace，所有应用共用 packages/shared 契约。
- 默认产品界面与文档使用中文。
- 身份仅由服务端认证上下文提供，所有用户资源按 userId 隔离。
- live 模式不得静默降级为 demo；所有工具结果包含来源、时间、模式。
- SSE 使用 POST /api/chat/stream，支持取消、幂等、持久化和明确终止状态。
- 长期记忆仅保存用户确认的白名单字段，不自动保存敏感原文。
- 本地优先，云端默认单台 Linux 云服务器，不实际创建云资源。
- 测试先行；每项任务完成后记录检查命令、输出和偏差。

## Review Focus

1. 非 ASCII 字符跨网络 chunk 时，SSE 解码不能损坏中文；任务 1 覆盖。
2. 两个用户互换会话或消息 ID 时，不能泄露数据；任务 2 覆盖。
3. 客户端中途取消或供应商超时时，不能留下永远 running 的请求；任务 5 覆盖。
4. demo 数据不能被误认为实时预报、汇率或签证结论；任务 3 与任务 6 覆盖。
5. 同一幂等键并发发送时，不能重复保存消息或启动模型调用；任务 5 覆盖。

## 文件职责地图

- 根 package.json、pnpm-workspace.yaml、tsconfig.base.json、.gitignore：工作区脚本及编译约定。
- packages/shared/src/{tools,chat,memory,sse,index}.ts：工具 Schema、请求/事件、记忆字段与纯 SSE 解析。
- database/{schema.prisma,migrations/}：唯一约束、关系和版本化迁移。
- apps/api/src/config.ts：环境变量校验与模式约束。
- apps/api/src/database/：Prisma 生命周期和数据访问。
- apps/api/src/auth/：注册、登录、JWT Guard、请求身份。
- apps/api/src/chat/：会话、消息、幂等请求、流式传输。
- apps/api/src/tools/：注册表、供应商 HTTP 封装、八个工具实现及认证接口。
- apps/api/src/agent/：LangChain 模型、工具绑定、LangGraph 状态与执行上限。
- apps/api/src/memory/：用户确认的长期记忆与受控短期上下文。
- apps/api/src/health/：存活、数据库就绪检查。
- apps/web/src/{features,components,lib}/：页面、聊天、工具表单、记忆管理、SSE 客户端。
- deploy/local/、deploy/cloud/、Dockerfile.\*、.env.example：构建与部署。
- docs/{architecture,knowledge,api,tools,development,deployment,verification}.md：源码导读与验收证据。

## Task 1: 工作区与共享协议

**Files:** 根配置；packages/shared/package.json、tsconfig.json、src/\*.ts、tests/contracts.test.ts、tests/sse.test.ts。

**Interfaces:** 输出 ToolId、toolSchemas、ToolResult<T>、ChatInputSchema、StreamEvent、MemorySchema 和 createSseParser(onEvent)。八个 ID 固定为 itinerary/weather/attractions/budget/visa/currency/packing/translation。

- [ ] 配置 pnpm workspace、TypeScript 构建、Vitest，锁定包管理器版本。
- [ ] 先写失败测试：无效日期、负预算、过长输入、未知工具拒绝；SSE 中文字节拆分、多事件同 chunk、不完整结束帧、CRLF 与多行 data。
- [ ] 运行 `pnpm --filter @travel/shared test`，确认失败指向缺失行为。
- [ ] 实现共享 Schema、事件判别联合和流式解析器；对外 JSON 不携带密钥或内部推理。
- [ ] 运行相同测试及 `pnpm --filter @travel/shared build`，预期全通过。
- [ ] 记录结果；若项目建立独立 Git 仓库，则提交本任务变更。

## Task 2: 数据库、认证与资源隔离

**Files:** database/schema.prisma、migrations；apps/api 的启动、config、database、auth、chat 资源控制器与 memory 模块；tests/auth.integration.test.ts、ownership.integration.test.ts、memory.integration.test.ts。

**Interfaces:** 认证输出 `{accessToken,user:{id,email}}`；Guard 注入 `request.user.id`。会话 CRUD 位于 /api/conversations；记忆 CRUD 位于 /api/memories；统一错误体 `{code,message,requestId}`。

- [ ] 先写失败集成测试：注册重复邮箱、错误密码、无令牌拒绝、A 无法读写 B 的会话或记忆、删除会话清除消息、非法记忆字段拒绝。
- [ ] 配置测试数据库并执行测试，确认功能缺失导致失败；无数据库时保留明确阻塞记录，不伪称集成测试已通过。
- [ ] 实现 User/Conversation/Message/ToolExecution/UserMemory/ChatRequest，增加所有权索引及用户幂等键唯一约束。
- [ ] 实现环境校验、密码哈希、JWT、限流、服务端输入校验和所有权查询；令牌不得进入日志。
- [ ] 实现记忆白名单、显式确认保存、CRUD 与上下文读取，完成上述集成测试。
- [ ] 运行 `pnpm --filter @travel/api test` 和 `pnpm --filter @travel/api build`，预期全通过；记录迁移状态。

## Task 3: 八个旅游工具

**Files:** apps/api/src/tools/{registry,provider-client,tools.controller}.ts、implementations/\*.ts；tests/tools.test.ts、providers.test.ts。

**Interfaces:** `executeTool(id: ToolId,input: unknown,context:{userId:string,signal:AbortSignal}): Promise<ToolResult<unknown>>`。注册表由 shared Schema 校验输入，每个工具返回统一封装。

- [ ] 先写失败测试：预算确定性合计与舍入、汇率基准日期、天气超出预报范围、未知签证组合、供应商超时、demo 标记、错误参数不访问供应商。
- [ ] 执行 `pnpm --filter @travel/api test -- tools providers` 确认预期失败。
- [ ] 实施时查阅官方文档确认 Open-Meteo 地理编码/预报、汇率供应商和景点供应商可用接口与限制；将端点、环境变量和失败策略记录到 docs/tools.md。
- [ ] 实现预算规则、打包规则与受控签证数据；实现天气、汇率及景点适配器；规划和翻译使用模型服务；无配置明确报错。
- [ ] demo 为八个工具提供固定可解释样例，并在每个响应及界面显示模式；live 禁止暗中使用样例。
- [ ] 使用固定响应的 HTTP 测试验证适配逻辑；真实联网测试单独记录，失败不得影响错误边界。
- [ ] 运行本任务测试和 API 全量测试，预期全通过。

## Task 4: DeepSeek 与 LangGraph 编排

**Files:** apps/api/src/agent/{model,graph,context,agent.service}.ts；tests/agent.test.ts、context.test.ts。

**Interfaces:** `runAgent({messages,memories,userId,signal,onEvent}): Promise<{content:string}>`；onEvent 使用 shared StreamEvent 的 token/tool_start/tool_result 子集，传输层分配序号。

- [ ] 先写失败测试：执行合法工具、拒绝无效参数、工具调用上限、取消传播、仅用户确认记忆进入上下文、历史上下文限长、工具结果被当作数据。
- [ ] 运行 Agent 测试，确认失败。
- [ ] 查阅官方 LangGraph/LangChain/DeepSeek 文档确认当前导出、工具调用与流式接口，再固定兼容版本。
- [ ] 实现模型/工具循环、递归和轮数上限、用户上下文注入、短期历史控制与必要摘要；不输出内部思考内容。
- [ ] demo 使用独立执行分支，不初始化真实模型客户端；live 密钥缺失启动失败。
- [ ] 运行 Agent 测试与 API 全量测试，预期全通过。

## Task 5: SSE 与持久化请求生命周期

**Files:** apps/api/src/chat/{stream.controller,stream.service,request-store}.ts；tests/stream.integration.test.ts、request-race.integration.test.ts。

**Interfaces:** POST /api/chat/stream 接收 `{conversationId?,message,requestId}`；流按 meta → token/工具事件 → done 或 error 发送，附 requestId 与递增 seq。GET 会话消息包含 complete/interrupted/failed 状态。

- [ ] 先写失败测试：协议帧、递增序号、HTTP 前置校验、流开始后错误、恰好一个 done、并发重复幂等键、取消后状态落库、错误会话所有权拒绝。
- [ ] 运行流式集成测试确认失败。
- [ ] 使用数据库唯一约束和事务创建 ChatRequest；先检查身份与会话，再发送 SSE 响应头。
- [ ] 实现心跳、取消传播、try/finally 清理、部分内容持久化、超时与断线状态；记录工具执行脱敏结果。
- [ ] 同一幂等键不得重启运行中的 Agent；已完成请求返回可识别状态，客户端通过消息查询恢复。
- [ ] 运行流式测试、竞态测试与 API 全量测试，预期全通过。

## Task 6: React 界面与交互

**Files:** apps/web 的 Vite/Tailwind 配置、src/App.tsx、features/{auth,chat,tools,memory}/、lib/api.ts；tests/chat.test.tsx、e2e/travel.spec.ts。

**Interfaces:** API 客户端内存保存 token；streamChat 使用 shared SSE 解析并返回可取消控制；工具表单使用 shared Schema 和固定工具目录。

- [ ] 先写失败交互测试：注册登录、新建会话、流式追加、停止按钮、工具表单错误、演示标识、记忆增删改、刷新后需要重新登录。
- [ ] 运行 `pnpm --filter @travel/web test`，确认功能缺失失败。
- [ ] 实现响应式中文界面：会话侧栏、欢迎页、聊天消息、执行卡片、八个工具入口、记忆设置；Ant Design 管理交互组件，Tailwind 管理布局。
- [ ] 正确处理网络错误、未认证、重复请求、空结果与取消；Markdown 禁用原始 HTML；不使用 dangerouslySetInnerHTML。
- [ ] 运行 Web 测试和生产构建，预期通过；连接 demo API 运行 Playwright 主流程并检查桌面与窄屏布局。

## Task 7: 本地 Docker 与端到端验收

**Files:** Dockerfile.api、Dockerfile.web、.dockerignore、.env.example、deploy/local/compose.yaml、nginx.conf、scripts/smoke.mjs；tests/deployment.test.ts。

**Interfaces:** web 对外端口 8080；api 容器端口 3000；PostgreSQL 内网端口 5432；GET /api/health/live 和 /api/health/ready。

- [ ] 添加部署检查：缺少 live 密钥失败、health ready 要求数据库可用、Nginx SSE 禁用缓冲。
- [ ] 实现多阶段构建、冻结锁文件安装、数据库健康依赖、启动迁移、命名数据卷与必要非 root 运行配置。
- [ ] demo 环境可复制示例文件启动；JWT secret 与数据库密码必须显式设置；数据库默认不暴露主机端口。
- [ ] 运行 `docker compose --env-file .env -f deploy/local/compose.yaml config --quiet`，预期成功。
- [ ] 运行同一配置的 `up --build -d`，检查所有健康状态；执行 smoke 脚本验证认证、八个工具、SSE 与记忆。
- [ ] 重启容器并重新登录，确认消息与记忆仍可读取；不使用 down -v 清理验收环境。
- [ ] 运行 `pnpm test`、`pnpm typecheck`、`pnpm build`；记录准确结果，Docker 引擎不可用时明确保留未验证状态。

## Task 8: 文档、云端配置与最终审阅

**Files:** README.md、docs/\*.md、deploy/cloud/compose.yaml、Caddyfile、生产环境模板。

**Interfaces:** 文档命令与实际 scripts、路径、端口、环境变量一致；云端复用相同镜像并通过 HTTPS 入口代理。

- [ ] 编写 PowerShell 本地启动、开发启动、生产构建、迁移、备份恢复与排障说明。
- [ ] 编写完整知识体系与源码映射，解释一次请求从 UI、SSE、Graph、工具到 PostgreSQL 的全过程。
- [ ] 添加单台 Linux 云服务器 Compose、TLS 代理、备份与回滚步骤；仅提供配置，不实际部署。
- [ ] 检查文档中的所有命令和配置引用；记录测试数据库、demo、live 和 Docker 的各自验证情况。
- [ ] 全工程审阅：认证隔离、凭据、外部请求、模式真实性、取消、幂等与数据丢失风险。
- [ ] 修复重要问题并补回归测试；运行最终全量测试与构建，交付源码、知识文档和验收报告。

## 执行记录约定

在 docs/implementation-progress.md 维护每项任务状态、实际命令、失败原因和修复结果。网络下载、Docker 引擎、真实 API 凭据作为独立环境条件报告，不能把静态检查当作端到端验收。当前目录为 projectless 输出目录，实施前确认 Git 边界，避免把父目录无关项目纳入提交。
