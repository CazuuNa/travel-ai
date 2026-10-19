# 远行 · Travel AI

中文旅游 AI 助手：React + TypeScript + TailwindCSS + Ant Design；NestJS + DeepSeek + LangChain + LangGraph；PostgreSQL；pnpm workspace；Docker 本地及云服务器部署。

八个工具：行程规划、天气查询、景点推荐、预算估算、签证查询、货币换算、打包清单、旅行翻译。包含注册登录、会话保存、POST SSE、取消生成、请求幂等、用户数据隔离和可编辑旅行记忆。

## 本地一键部署

需要 Node.js 22+、pnpm 10.28.2、运行中的 Docker Desktop（Linux containers）与 Compose v2。以下命令在工程根目录执行：

```powershell
node scripts/init-env.mjs
docker compose --env-file .env -f deploy/local/compose.yaml up --build -d
docker compose --env-file .env -f deploy/local/compose.yaml ps
```

打开 http://localhost:8080 注册账号，密码至少 12 字符。环境脚本自动生成随机数据库密码与 JWT 密钥，不覆盖已有 `.env`。本地数据库默认不暴露主机端口。

```powershell
pnpm install --frozen-lockfile
pnpm --filter @travel/shared build
pnpm smoke
```

默认 **demo 模式**，不需要模型密钥。天气、景点、汇率、翻译、行程是标记清楚的样例；预算、打包是规则计算。demo 聊天用于验证流式输出和记忆，不自动调用模型工具。

## 切换真实服务

编辑 `.env`（不得提交密钥）：

```dotenv
AI_MODE=live
DEEPSEEK_API_KEY=你的密钥
DEEPSEEK_MODEL=deepseek-chat
OPENTRIPMAP_API_KEY=你的景点供应商密钥
```

```powershell
docker compose --env-file .env -f deploy/local/compose.yaml up -d --force-recreate api
```

live 模式启用模型决策、LangGraph 工具循环及最终回答逐 token 输出。天气使用 Open-Meteo，汇率使用 Frankfurter，景点需要 OpenTripMap 密钥。签证工具提供官方查询指引和准备清单，不提供未经核验的实时签证政策。外部接口失败会明确报错，不静默降级为 demo。

## 开发与检查

```powershell
pnpm install --frozen-lockfile
pnpm db:generate
docker compose --env-file .env -f deploy/local/compose.yaml -f deploy/local/db-dev.yaml up -d db
pnpm db:migrate
pnpm dev
```

前端 http://localhost:5173，API http://localhost:3000。若端口占用，调整 `.env` 中 PORT，前端设置 API_PROXY_TARGET。详情见开发指南。

```powershell
pnpm test
pnpm typecheck
pnpm build
$env:TEST_API_URL='http://localhost:3000/api'
pnpm test:integration
pnpm exec playwright install chromium
pnpm exec playwright test
```

集成测试要求运行中的 demo API 和数据库，会创建、删除随机测试账号；只在开发实例执行。浏览器测试默认访问 8080。实测结果与未验证项见验收报告。

## 代码结构

```text
travel-ai/
├── apps/web/                    React / TS / Tailwind / Ant Design
│   ├── src/components/          会话侧栏
│   ├── src/features/            auth / chat / tools / memory
│   ├── src/lib/                 API、内存 token、SSE 客户端
│   ├── tests/                   客户端协议测试
│   └── e2e/                     Playwright 流程
├── apps/api/
│   ├── src/auth/                密码认证、JWT Guard
│   ├── src/chat/                会话、流式传输、幂等和状态保存
│   ├── src/agent/               模型、Graph、上下文
│   ├── src/tools/               工具服务、规则、真实数据供应商
│   ├── src/memory/              用户确认的偏好 CRUD
│   ├── src/database/            Prisma 生命周期、崩溃状态恢复
│   ├── src/common/              脱敏异常处理
│   └── tests/                   工具、Graph、供应商及集成测试
├── packages/shared/src/         Zod Schema、工具目录、共享类型、SSE 解析
├── database/                    Prisma Schema、版本化 SQL 迁移
├── deploy/local/                Compose、Nginx、数据库开发端口覆盖
├── deploy/cloud/                云服务器 Compose、Caddy HTTPS
├── scripts/                     环境初始化、接口 smoke
├── docs/                        知识体系、架构、接口、部署、验收
├── Dockerfile.api               API 构建与生产依赖分层
├── Dockerfile.web               静态站点与非 root Nginx
└── pnpm-lock.yaml               固定依赖解析
```

## 文档

- [完整知识体系](docs/knowledge.md)
- [架构与代码导读](docs/architecture.md)
- [接口与 SSE 协议](docs/api.md)
- [八个工具与供应商说明](docs/tools.md)
- [开发与扩展指南](docs/development.md)
- [本地与云端部署](docs/deployment.md)
- [实测验收报告](docs/verification.md)

部署边界：单 API 实例，内存限流与生成并发锁不跨副本。token 在内存保存，有效期两小时，刷新需重新登录。外部接口条款、配额与商业使用条件见各供应商。多副本、找回密码、邮箱验证、语音、实时预订及付费不在本版范围。
