# 旅游 AI 助手完整知识体系

这份文档按“能运行 → 能理解 → 能修改 → 能部署”的顺序组织。阅读时同时打开关联源码，避免只记概念名词。完成一章的标准是能解释该层的输入、输出、失败方式及验证方法。

## 一、总体学习地图

```text
JavaScript / TypeScript
  ├─ Node.js、模块系统、异步、流、AbortSignal
  └─ pnpm workspace、依赖图、共享类型与运行时 Schema
前端
  ├─ React 组件、状态、Effect、Ref、表单
  ├─ Ant Design 交互与 Tailwind 布局
  └─ HTTP 客户端、身份状态、SSE 解码和取消
后端
  ├─ NestJS Controller / Provider / DI / Guard / Filter
  ├─ 用户认证、授权、限流、校验和错误边界
  └─ Prisma、PostgreSQL、事务、唯一约束和迁移
AI
  ├─ 模型消息、提示词、上下文窗口、token 与费用
  ├─ LangChain 模型抽象和结构化工具
  ├─ LangGraph 状态、节点、边、reducer、循环上限
  └─ 短期历史、长期偏好、来源、不确定性与评测
运维
  ├─ Docker 多阶段构建、镜像、容器、卷和网络
  ├─ Nginx / Caddy、SSE 代理、HTTPS、健康检查
  └─ 测试、日志、备份恢复、发布回滚和容量边界
```

## 二、TypeScript：让边界可推导

### 类型系统与运行时

TypeScript 在编译时检查程序，编译后类型会消失。`input as BudgetInput` 只是告诉编译器相信你，并不检查网络请求。真正的可信边界使用 `toolSchemas.budget.parse(input)`。

`z.infer<typeof schema>` 从 Schema 推导类型，避免手写 DTO 与实际校验规则不一致。工具结果采用泛型 ToolResult<T>，让业务数据类型和元信息封装独立。

判别联合将 StreamPayload 分成多种 type。处理 `e.type === 'token'` 后，TS 知道存在 text；工具结果分支才允许访问 result。这比到处写可选字段更容易发现遗漏。

参考文件：shared/tools.ts、shared/chat.ts、web/lib/stream.ts。

### 模块系统

Node 的 CommonJS 使用 require/module.exports，ESM 使用 import/export。本工程 API 和 shared 编译成 CommonJS，前端交由 Vite 构建。workspace 链接包的 CommonJS 文件位于 packages/shared/dist，不总被默认 node_modules 匹配捕获，因此 Vite 显式配置 commonjsOptions.include，开发时 optimizeDeps.include 包含 shared。

理解模块格式能解释“TS 类型正确但浏览器说没有某个导出”的问题；类型检查不能证明 bundler 能理解运行时模块格式。

### 异步、并发与取消

await 会让出执行权。同一事件循环并不意味着没有竞争：两次请求可以先后通过检查，在 await 后同时写数据。本项目的用户生成 Set 必须先占位再 await；数据库幂等仍依赖唯一约束。

Promise.all 适合独立读取历史和记忆，不适合随意并行有顺序依赖的写操作。AbortSignal 是协作式取消：每一层必须接收并检查它；仅在 UI 隐藏加载图标不会停止模型计费。

练习：解释取消从按钮到 fetch、response close、Agent、providerJson 的传播路径，并指出硬崩溃无法执行 finally。

## 三、pnpm workspace：共享不等于复制

根目录负责统一命令，apps 是部署单元，packages 是复用单元。`workspace:*` 强制引用本工作区的 shared，避免误拉 registry 上同名包。

依赖图决定构建顺序：先 shared，再 API/Web。前端只需要共享契约，不应拿到服务端密钥、数据库客户端和模型 SDK。共享包一旦导入服务端环境变量，会使安全边界变得模糊。

pnpm-lock.yaml 记录解析版本和完整性；CI 与 Docker 用 --frozen-lockfile，避免安装过程中悄悄更新依赖。packageManager 指定团队版本，Node engines 声明最低运行版本。CLI 与 Client 的 Prisma 版本必须一致。

练习：新增一个共享字段，观察两个应用哪里报类型错误，并通过 Schema 修改统一修复；不要分别手改两份类型。

## 四、React：页面是状态的投影

### 组件职责

App 管登录状态、会话选择和抽屉开关；Sidebar 展示会话；ChatWorkspace 管一次聊天交互；ToolDrawer 管结构化工具表单；MemoryDrawer 管用户确认的偏好；ResultCard 统一展示来源、模式和结果。

局部状态包括 text、busy、messages；Ref 包括 AbortController、底部滚动节点和当前本地会话 ID。Ref 改变不会触发渲染，适合保存控制资源。state 用函数更新接收上一次值，防止 token 流回调捕获旧消息列表。

### Effect 与生命周期

切换会话触发历史请求；卸载时取消网络操作。生成中新会话 meta 更新 selected，组件需识别它是当前本地流，不要立刻拉数据库历史覆盖尚在增长的消息。

这是 localId Ref 的用途。只依赖 selected 而不区分“用户切换”和“服务端刚分配 ID”，会出现一条用户消息重复、助手内容闪回等问题。

### 表单与 UI

Ant Design 提供输入、表单错误、按钮、抽屉和确认删除；Tailwind 管布局、间距和响应式；独立 CSS 管品牌视觉和复杂场景。两者不要重复争夺组件内部样式。

工具字段由共享示例驱动，提交后再经过共享 Schema。数值用 InputNumber，布尔用 Switch，日期用原生 date 输入，文本长度有上限。服务端错误还需通过 Alert/消息提示反馈。

### 用户体验

Enter 发送，Shift+Enter 换行，中文输入法组合阶段不触发发送。生成中展示停止按钮，禁用会话切换与退出以减少竞态。空会话给起始问题；网络失败不伪造成功；演示模式持续显示。

练习：模拟 SSE 在中文字符中间断包、点击停止后再发消息、切换旧会话后新建会话，检查状态是否符合预期。

## 五、NestJS：显式组织后端职责

Controller 接收 HTTP，Provider 承担业务，Module 注册依赖关系。@Inject 声明运行时注入，避免仅依赖 TS 类型推断。AuthService 处理账号；ToolsService 处理工具边界；AgentService 处理模型编排；StreamController 管网络与请求状态。

Guard 在处理函数前确认身份；Filter 把未知异常变成稳定错误响应。输入校验不是 Guard 的职责，授权也不应由模型判断。

`@Res()` 接管原始响应适合 SSE，但意味着你要自己设置状态码、头、flush 和 end。普通 JSON 接口则让 NestJS 自动序列化。流开始前后错误处理不同：头已发送时不能改成 HTTP 500，必须发送 error 帧或关闭连接。

练习：阅读 main.ts 和 app.module.ts，画出 Provider 注入关系。为一个新的资源接口明确 Guard、Schema、所有权查询与异常处理各放在哪一层。

## 六、认证与授权：两个不同问题

认证回答“你是谁”：邮箱密码换 JWT，Guard 验签、检查 exp/issuer/audience，确认用户尚存在。授权回答“你能访问什么”：数据库查询同时限制 id 与 userId。

只验证 token 后按 id 查询所有资源，会出现水平越权。UUID 难猜不等于有授权。对其他用户资源返回 404，减少存在性泄漏。

密码不明文保存，bcrypt cost=12。哈希验证应控制长度和请求频率，避免暴力尝试与计算资源消耗。token 仅浏览器内存，降低持久 XSS 窃取后的长期风险，但刷新需登录，仍不能代替 XSS 防护。

本版未包含找回密码、邮箱验证、刷新令牌和设备会话管理。若增加刷新令牌，建议使用 HttpOnly/Secure cookie、轮换、服务端撤销和 CSRF 防护，而不是把长期 token 放进 localStorage。

## 七、PostgreSQL 与 Prisma

### 表、关系与约束

主键唯一识别记录；外键保证关联存在；级联删除清理从属数据；唯一约束是并发一致性的最终防线。UserMemory(userId,key) 表达一人一类偏好；ChatRequest.id 表达一次幂等操作。

索引改善查找和排序，但会增加写入与空间开销。索引必须来自实际查询：userId+updatedAt 对应会话列表，conversationId+createdAt 对应消息。过早给每个字段建索引没有依据。

### 事务

创建请求、用户消息、空助手消息在一个事务里。若中途失败，不能留下半条孤立会话。生成不能放在持续数十秒的数据库事务内；先短事务占位，释放连接，模型完成后再短事务保存结果。

这体现“数据库原子性”与“长任务生命周期”的分离。长任务通过 running/complete/interrupted/failed 建模，而非一直占用锁等待模型。

### 迁移

Schema 是当前目标，migration 是到达目标的历史步骤。generate 只生成客户端，migrate deploy 才应用已有迁移。生产不使用 dev/reset。SQL 审阅重点包括删除、默认值、非空约束、已有数据回填和长时间锁。

练习：直接在 SQL 层尝试插入重复 UserMemory，理解为什么应用层先查再写仍不足以防重复。

## 八、LLM 基础与 DeepSeek

模型接收有角色的消息，输出文本或结构化工具调用。system 提供规则，human 提供用户需求，AIMessage 代表模型输出，ToolMessage 携带执行结果。工具调用是模型的“请求”，不是实际执行，必须由代码执行并校验。

temperature 控制采样随机性，不是事实准确率开关。maxTokens 控制输出上限，不控制输入大小。timeout 和 maxRetries 控制调用生命周期，重试也可能增加费用。

DeepSeek 通过 LangChain ChatDeepSeek 适配，模型 ID 来自环境。不同模型的工具调用和推理字段支持可能不同，上线需用目标模型真实验证。工程只展示 content，不暴露 reasoning_content。

费用大致由输入 token、输出 token、调用次数和供应商价格构成。工具决策与最终流式生成分开，会重复部分输入；应在正确性和首 token 延迟之间权衡。不要为了“看起来聪明”无限循环工具。

## 九、LangChain：统一模型和工具

LangChain 提供消息类型、ChatModel、Runnable、工具结构和调用配置。它不自动让结果真实，也不自动实现业务授权。

DynamicStructuredTool 的 name/description/schema 告诉模型何时调用、如何组织参数；真正实现仍在 ToolsService。bindTools 将定义发送模型，工具的执行上下文由应用保存。

提示词应要求缺失信息时提问，避免擅自补充护照国籍、日期或预算；返回工具错误时让模型解释状态，不用虚构结果掩盖失败。模型输出不能直接用作任意 SQL、任意 URL 或命令。

练习：故意让模型请求负金额，观察 registry 校验；然后设计如何向用户反馈参数错误。

## 十、LangGraph：明确状态与控制流

StateGraph 将工作拆为节点和边。状态 reducer 决定节点输出如何合并：消息需要追加，计数可累加或覆盖，最终答案应替换。节点名不能与状态字段重名，这是本工程测试中发现并修复的真实集成问题。

条件边读取最新 AIMessage 是否有 tool_calls：有则进入 tools，无则进入 respond。tools 添加 ToolMessage 再回 decide；respond 结束。循环要有业务上限，也要有图递归上限，避免错误工具反馈导致持续计费。

工具异常可选择返回结构化错误给模型继续整理；基础设施或越界调用则中止。不要把所有异常 catch 后都当作成功返回。

本版 Graph 状态仅存在当前运行中。PostgreSQL 保存聊天历史，不等于使用 LangGraph 持久 checkpointer；后续若加入人工审核暂停/恢复，需要设计 checkpoint 身份、thread_id 与访问隔离。

## 十一、八个工具的工程分类

| 类别       | 工具             | 应验证什么                                     |
| ---------- | ---------------- | ---------------------------------------------- |
| 确定性规则 | 预算、打包       | 公式、边界、默认值、舍入                       |
| 外部事实   | 天气、汇率、景点 | 来源、时区、基准日、覆盖、超时、供应商结构     |
| 模型生成   | 行程、翻译       | 需求完整、语言正确、标明估算、不伪造事实       |
| 受控指引   | 签证             | 官方入口、未覆盖返回、核验时间、不作无依据结论 |

不能统一用“LLM 生成一段文字”伪装八个工具。真正的工具应有可检查输入、可测试输出、明确来源和失败行为。详见 tools.md。

## 十二、SSE：字节、字符、帧、事件

网络 chunk 是任意字节片段，不保证 UTF-8 字符或 JSON 边界。正确顺序是 TextDecoder(stream:true) → 缓存文本 → 按空行提取帧 → 收集 data 行 → JSON.parse → 按 type 更新 UI。

中文常占多个 UTF-8 字节，逐 chunk 用普通 decode 会产生替换字符。多条事件可能一次到达，一个事件也可能被拆成很多块。CRLF 与 LF 都要支持；注释帧是心跳；EOF 仍有未完成 data 帧要报错。

SSE 保持单向服务端推送，本项目通过 POST 建立，不需要双向 WebSocket。正常结束需 done，不能把网络 EOF 当作成功。前端测试故意每次只送一个字节，验证中文和事件边界。

反向代理默认缓冲会导致模型虽在生成，用户仍一次性看到全文。应用 flush 不足以解决代理缓冲，Nginx 和 Caddy 两层都需配置。

## 十三、记忆系统与 RAG 的区别

聊天历史是当前会话上下文；长期偏好是用户确认的稳定信息；RAG 是检索外部知识用于生成。三个概念可以结合，但不应混为“把所有信息塞进提示词”。

长期记忆应有来源、修改和删除渠道，不能自动把一次临时需求当作永久偏好。按 userId 读取是授权边界，向量相似度不是。敏感信息和旅游习惯也需要区分：本版只有显式偏好字段。

当前短期历史通过条数和字符双重限制截断；不维护额外摘要表。若加入摘要，需区分用户陈述与模型猜测、保留来源消息、避免摘要迭代放大错误，并给用户可见的删除机制。

若加入 pgvector，流程可为：确认记忆 → 分块 → embedding → 带 userId 的向量检索 → 有界提示上下文。embedding 模型升级需考虑维度和重建；检索召回不保证事实仍有效。

## 十四、测试：从纯函数到真实页面

单元测试：Schema、预算公式、记忆白名单、上下文预算、SSE 分块。Graph 测试：用可控模型决策函数配合真实 StateGraph，验证执行顺序、轮数上限和取消，不只断言 mock 被调用。

供应商测试：固定 HTTP 响应验证 JSON 解析、日期范围和换算。集成测试：真实 API+PostgreSQL 验证认证、所有权、事务和竞态。浏览器测试：实际表单、按钮、聊天与工具呈现。

每类证据有范围：类型检查不能证明授权；模拟供应商不能证明公网连通；Compose config 不能证明镜像能启动；demo 成功不能证明 DeepSeek live 可用。

TDD 的重点是先证明测试能在缺少行为时失败，再实现使其通过。最终全量检查还要确认新变更没有破坏旧流程。测试报告应保留环境阻塞，而非把跳过当通过。

## 十五、Docker 与部署

镜像是不可变构建产物，容器是运行实例，命名卷保存数据库数据，Compose 网络用服务名互联。容器内 localhost 仅指自身，所以 API 连接 db:5432，而宿主机开发连接 localhost:5432。

多阶段构建把编译工具与运行依赖分开。Web 最终只需 Nginx 和静态文件，API 需要生产依赖、Prisma Client 和迁移 CLI。非 root 用户减少容器权限；不代表可以忽略供应链与主机补丁。

depends_on 的 service_healthy 解决启动顺序，不能替代运行期间的错误恢复。live 说明进程活着，ready 说明数据库可查询。日志有大小与文件数量限制，防止填满磁盘。

练习：停止 API 再启动，确认健康状态；重启数据库并观察错误；普通 down/up 后检查持久化；在独立恢复库验证备份。

## 十六、云端、HTTPS 与演进

本地端口绑定回环，云端由 Caddy 暴露 80/443，TLS 证书写持久卷。数据库和 API 留在内部网络。SSE 长连接占用连接资源，应考虑代理超时、并发、模型速率和数据库连接池。

先用单实例和清晰边界交付，再根据瓶颈演进：用户级配额、共享限流、分布式租约、独立迁移、托管数据库、集中日志、模型追踪和评测。不要只增加容器副本而忽略 running 请求的所有权。

## 十七、建议学习路线

1. 跑 demo 与 smoke，理解产品流程。
2. 阅读 shared 并增加边界测试，掌握 TS 与 Zod。
3. 阅读 AuthGuard、Controller 和 Prisma Schema，理解身份、所有权和事务。
4. 阅读预算与天气实现，对比确定性计算和外部事实。
5. 阅读 SSE 解析与 StreamController，手动取消一次生成。
6. 阅读 Graph，画出工具循环，运行无限工具请求测试。
7. 配置自己的 DeepSeek 和景点密钥，逐项验证 live，记录数据来源与费用。
8. 跑 Docker 与备份恢复，再部署自己的 Linux 服务器。
9. 选择一个真实需求扩展，先写验收标准，再加契约、实现、测试和文档。

## 十八、官方参考入口

- [React 学习](https://react.dev/learn)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [pnpm Workspace](https://pnpm.io/workspaces)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [Ant Design](https://ant.design/components/overview/)
- [NestJS](https://docs.nestjs.com/)
- [Prisma](https://www.prisma.io/docs)
- [PostgreSQL](https://www.postgresql.org/docs/)
- [LangChain JavaScript](https://docs.langchain.com/oss/javascript/langchain/overview)
- [LangGraph](https://docs.langchain.com/oss/javascript/langgraph/overview)
- [DeepSeek API](https://api-docs.deepseek.com/)
- [Docker Compose](https://docs.docker.com/compose/)
- [MDN SSE](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events)

依赖的具体实现以本工程锁文件和实测版本为准；官方文档会更新，升级应重新运行对应验证。
