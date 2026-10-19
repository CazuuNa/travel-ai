# 本地与云端部署手册

## 本地全栈

Docker Desktop 选择 Linux containers，等待引擎 Running。验证 `docker version` 同时显示 Client 和 Server，`docker compose version` 能找到 v2 插件。

```powershell
node scripts/init-env.mjs
docker compose --env-file .env -f deploy/local/compose.yaml config --quiet
docker compose --env-file .env -f deploy/local/compose.yaml up --build -d
docker compose --env-file .env -f deploy/local/compose.yaml ps
docker compose --env-file .env -f deploy/local/compose.yaml logs --tail 100 api
```

服务链：db health → api 部署迁移并启动 → api ready → web。初次需下载镜像和 npm 依赖，请等待 API health。只输出 config --quiet，不把展开的配置（含密码）贴到公开日志。

可信代理跳数由 Compose 自动设置：宿主机直连 0 跳，本地 Nginx 1 跳，云端 Caddy+Nginx 2 跳。Caddy 重写公网客户端转发 IP，Nginx 追加直接来源，API 仅内部可达。更换 CDN 或负载均衡需重建可信链，不能直接将 trust proxy 设为 true。参考 [Express](https://expressjs.com/en/guide/behind-proxies/) 和 [Caddy](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy)。

入口 http://localhost:8080，仅绑定 127.0.0.1。db 和 api 无宿主机端口。数据库卷 travel-ai_postgres_data 独立于容器生命周期；普通 down 不删除卷，重新 up 会保留数据。

```powershell
docker compose --env-file .env -f deploy/local/compose.yaml stop
docker compose --env-file .env -f deploy/local/compose.yaml up -d
# 停止并移除容器/网络，保留数据库卷
docker compose --env-file .env -f deploy/local/compose.yaml down
```

`down -v` 会删除数据库卷，属于销毁数据操作，不用于常规重启或升级。首次数据库初始化后只修改 POSTGRES_PASSWORD 不会改变已有数据库角色密码，需通过数据库执行 ALTER ROLE 并同步应用配置。

## 构建原理

API Dockerfile 使用 build、production-deps、runtime 阶段。build 编译 shared/API；production-deps 只安装生产依赖并生成 Prisma；runtime 以 node 用户运行，启动前执行 migrate deploy。Prisma CLI 被保留为生产依赖以执行启动迁移。

Web Dockerfile 构建静态文件，以非 root Nginx 监听 8080。Nginx /api/ 反代 api:3000，关闭 buffering/cache，读超时 240 秒。React history fallback 使用 try_files。生产依赖阶段不带 API 编译器和单元测试工具；Web 最终镜像没有 Node。

`.dockerignore` 排除 node_modules、dist、.env 与测试产物，构建上下文不携带真实密钥。镜像标签在长期生产中建议固定补丁版本或 digest，并制定定期升级流程。

## 验收命令

```powershell
pnpm install --frozen-lockfile
pnpm --filter @travel/shared build
pnpm smoke
$env:TEST_API_URL='http://localhost:8080/api'
pnpm test:integration
pnpm exec playwright test
```

重启后用同一个账号登录确认会话和记忆仍存在。smoke 删除自己的临时账号，因此持久化检查需要另外保留专用测试账号。live 模式不运行 demo smoke，避免生成费用；逐工具核验输出 mode 和来源。

## 云服务器方案

采用单台 Linux 云服务器、Docker Engine/Compose、Caddy 自动 HTTPS。工程不绑定某家云平台；需要域名 A/AAAA 指向服务器，安全组只开放 80/443 和受限 SSH。CPU、内存、数据库容量按并发、日志和备份评估，不将本地性能当作云容量承诺。

在服务器工程根目录：

```bash
node scripts/init-env.mjs
# 使用编辑器填写 .env 中模型密钥、密码等；勿在命令行粘贴密钥
# 追加：DOMAIN=travel.your-domain.com
# 追加：TLS_EMAIL=you@your-domain.com
docker compose --env-file .env -f deploy/cloud/compose.yaml config --quiet
docker compose --env-file .env -f deploy/cloud/compose.yaml up --build -d
docker compose --env-file .env -f deploy/cloud/compose.yaml ps
```

云端复用本地 db/api 服务定义，web 仅内网，gateway 对外监听 80/443。Caddy 证书写入 caddy_data，配置写入 caddy_config；不得频繁销毁证书卷。Caddy flush_interval=-1，Nginx 继续禁缓冲，保证双层代理下 SSE。

此配置只支持一个 API 实例。不要在未修改分布式并发控制和启动恢复逻辑前增加副本。更高可靠性可使用托管 PostgreSQL、独立迁移任务、集中限流与日志；迁移到托管库时应开启 TLS 并按供应商提供的连接参数配置。

## 备份与恢复

以下为本地 Compose，云端替换配置路径。备份文件含用户数据，存放到受控位置并加密异地保存。不要用 PowerShell 文本重定向保存二进制 pg_dump，否则旧 PowerShell 版本可能损坏文件。

```powershell
New-Item -ItemType Directory -Force backups
docker compose --env-file .env -f deploy/local/compose.yaml exec -T db pg_dump -U travel -d travel -Fc -f /tmp/travel.dump
docker compose --env-file .env -f deploy/local/compose.yaml cp db:/tmp/travel.dump ./backups/travel.dump
```

如修改了数据库用户名/名称，相应替换 -U/-d。恢复先在独立数据库验证：

```powershell
docker compose --env-file .env -f deploy/local/compose.yaml cp ./backups/travel.dump db:/tmp/restore.dump
docker compose --env-file .env -f deploy/local/compose.yaml exec -T db createdb -U travel travel_restore
docker compose --env-file .env -f deploy/local/compose.yaml exec -T db pg_restore -U travel -d travel_restore --no-owner /tmp/restore.dump
```

检查恢复库的用户、消息数量和迁移表，再决定正式切换。备份存在不代表可恢复，需定期做恢复演练。数据库主版本升级使用官方升级或导出导入路径，不能简单替换镜像主版本后复用原数据目录。

## 更新与回滚

发布前备份数据库并保存当前镜像 ID/标签；拉取或构建新版本；检查迁移兼容性；再 up -d。API 启动迁移失败会保持不健康，查看日志后修复，不跳过迁移。生产建议在 CI 构建不可变镜像并给每个发布版本加标签；回滚使用上一镜像，数据库需保持向后兼容或执行经过演练的恢复。

## 排障

| 现象                     | 检查                                                                               |
| ------------------------ | ---------------------------------------------------------------------------------- |
| docker_engine 管道不存在 | Docker Desktop 未启动或上下文不正确；检查 docker context ls 与引擎状态             |
| docker compose 找不到    | 修复 Compose v2 插件安装；部分 Windows 安装可暂用 resources/bin/docker-compose.exe |
| db 不健康                | 数据库密码、已有卷权限、磁盘空间、pg 日志                                          |
| API 启动失败             | .env 校验、JWT 长度、live 密钥、数据库 URL、迁移日志                               |
| 前端 502                 | api 是否 ready、Compose 服务名、端口与代理                                         |
| SSE 一次性出现           | 两层反代 buffering、CDN 缓冲、代理超时                                             |
| 汇率日期非今天           | 供应商按最近发布日提供参考数据，查看 rateDate                                      |
| 中文城市无结果           | 检查返回定位或改用英文城市名称                                                     |
| 景点配置错误             | OPENTRIPMAP_API_KEY 是否存在及套餐权限                                             |
| 记忆不生效               | 是否确认保存、是否同一账号、是否发送了新的消息                                     |
| 页面刷新需登录           | 设计行为：token 仅在内存中保存                                                     |
| 修改 .env 未生效         | Compose up -d --force-recreate api；restart 不更新容器环境变量                     |

本交付环境未能连接 Docker 引擎，因此镜像构建与容器健康状态不应视为已验收。Compose 解析与原生进程数据库/接口实测分开记录，详见 verification.md。
