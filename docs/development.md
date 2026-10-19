# 开发、测试与扩展

## 工具链

Node.js >=22，pnpm 10.28.2。packageManager 固定版本，pnpm-lock.yaml 固定依赖树，Docker 使用同一 pnpm。若主机版本不符，可执行 `npm install -g pnpm@10.28.2`；此命令修改主机全局工具，请自行选择版本管理方式。

```powershell
pnpm --version
node scripts/init-env.mjs
pnpm install --frozen-lockfile
pnpm db:generate
pnpm --filter @travel/shared build
```

Prisma Client 根据 Schema 生成；修改数据库模型后需要重新 generate。安装成功不等于已创建数据库表，必须部署迁移。

## 开发数据库与进程

```powershell
docker compose --env-file .env -f deploy/local/compose.yaml -f deploy/local/db-dev.yaml up -d db
pnpm db:migrate
pnpm dev
```

`.env` 的 DATABASE_URL 用于宿主机开发：localhost:5432。Compose 会单独将 API 的数据库地址覆盖为 db:5432；不要把容器内的 db 主机名复制到宿主机 URL。init-env 使用十六进制随机密码，避免连接串转义问题。

开发脚本先编译 shared，再并行启动 API 与 web。API 使用 tsx watch --env-file；浏览器不读取服务端密钥。修改 shared 后需重新构建 shared（另开终端 `pnpm --filter @travel/shared exec tsc -w`），或者重启根 dev。前端通过代理访问 /api，不需要开放宽泛 CORS。

端口冲突示例：

```powershell
# 修改 .env 中 PORT=4317，随后启动 API
pnpm --filter @travel/api dev
# 另一个终端
$env:API_PROXY_TARGET='http://localhost:4317'
pnpm --filter @travel/web dev
```

Linux/macOS 对应 `API_PROXY_TARGET=http://localhost:4317 pnpm --filter @travel/web dev`。Vite 开发服务器仅用于开发，公网使用 Nginx 构建产物。

## 脚本与预期

| 命令                  | 作用                                   | 不覆盖的内容           |
| --------------------- | -------------------------------------- | ---------------------- |
| pnpm test             | Vitest 单元、Schema、Graph、客户端协议 | 不自动启动数据库       |
| pnpm test:integration | 调用 TEST_API_URL 的真实 API           | 不验证 Docker 镜像     |
| pnpm typecheck        | shared 编译后检查各包 TS               | 不验证运行时输入       |
| pnpm build            | shared → API → web 生产构建            | 不代表实际模型调用成功 |
| pnpm db:generate      | 生成 Prisma Client                     | 不修改数据库           |
| pnpm db:migrate       | 部署现有迁移                           | 不生成新迁移           |
| pnpm db:dev           | 开发环境生成并应用迁移                 | 不应用于生产库         |
| pnpm smoke            | demo 账号、八工具、记忆、SSE           | 不验证真实供应商       |

测试配置使用 Vite runner 加载配置，减少 Windows 沙箱下配置打包的父目录权限问题。普通机器也可使用同一脚本。若 Vite dev 依赖预构建被沙箱拒绝，先生产 build，再用 preview 验证前端；不把此环境问题改成忽略错误。

## 集成与浏览器测试

先启动 demo API 和数据库，再运行：

```powershell
$env:TEST_API_URL='http://localhost:3000/api'
pnpm test:integration
```

测试覆盖匿名拒绝、重复邮箱、错误密码、用户隔离、非法记忆、消息保存、SSE 终止、同 ID 和不同 ID 的并发竞争、取消状态。随机账号在 afterAll 删除。不要对有真实费用或真实用户的生产实例运行。

```powershell
pnpm exec playwright install chromium
# Docker 全栈地址默认 http://localhost:8080
pnpm exec playwright test
# 现有 Edge 可选
$env:PLAYWRIGHT_CHANNEL='msedge'
$env:E2E_URL='http://localhost:8080'
pnpm exec playwright test
```

浏览器测试失败截图在 test-results，不进入源码包。接口测试与浏览器测试有不同职责：前者覆盖数据状态和并发，后者覆盖按钮、表单与真实页面可用性。

## 数据库改动

1. 修改 database/schema.prisma。
2. 本地开发数据库执行 `pnpm db:dev --name describe_change`。
3. 审阅生成 SQL，确认数据类型和外键删除行为。
4. 执行 db:generate、typecheck、集成测试。
5. 将 Schema 和迁移 SQL 一起提交；生产只运行 db:migrate。

禁止把 migrate reset 当作常规部署命令。破坏性变更采用扩展 → 回填 → 切换 → 删除的多阶段迁移。应用回滚不等于数据库可回滚，需先准备兼容性或备份恢复。

## 添加第九个工具

1. shared/tools.ts 新增 ID、输入 Schema、中文目录和示例。
2. 先在 API 测试写行为断言：成功、无效输入、取消、供应商错误、模式与来源。
3. tools.service 的分支调用独立实现；外部请求必须走固定允许域名封装。
4. 若使用新供应商，在 provider-client 允许集中明确添加域名并验证 JSON。
5. Agent 根据目录自动构造定义；检查模型工具 Schema 能被转换。
6. 前端表单从 shared 示例生成，按需要补字段中文标签或专用复杂组件。
7. 更新工具文档、smoke 输入与测试数量。

不要把工具执行逻辑写进 React，也不要在 Controller 里拼接模型提示词。模型生成建议、确定性业务计算、网络适配与 SSE 生命周期应分别可测试。

## 依赖更新

锁文件是交付的一部分。升级 LangChain/Core/Graph/DeepSeek 时联合检查 peer dependencies，运行真实 Graph 的工具循环测试。升级 Prisma 时同步 CLI 与 Client 版本。升级 Tailwind 主版本时核对 Vite 插件和 CSS 导入方式。本工程使用 Tailwind 4 的 @tailwindcss/vite，不能照搬 v3 的 PostCSS 初始化流程。
