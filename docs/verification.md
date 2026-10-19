# 实测验收报告

日期：2026-10-18（Asia/Shanghai）。原生进程验证、部署配置检查和未验证事项分别记录。

## 环境

Windows、Node 24.19.0、pnpm 10.28.2；隔离原生 PostgreSQL 18.6 仅监听 127.0.0.1:55439；API 4317；Vite production preview 5179；Playwright + Microsoft Edge headless。Compose 目标为 PostgreSQL 17-alpine，原生实测不替代容器验收。

## 已执行并通过

| 检查                  | 结果                                                                                 |
| --------------------- | ------------------------------------------------------------------------------------ |
| pnpm test             | 10 个文件，22 个测试通过                                                             |
| pnpm test:integration | 真实 API + PostgreSQL，5 个测试通过                                                  |
| pnpm typecheck        | shared、api、web 全部通过                                                            |
| pnpm build            | 三个 workspace 生产构建通过                                                          |
| Prisma generate       | 完整依赖与独立生产依赖目录均生成成功                                                 |
| Prisma migrate deploy | 初始迁移在真实隔离库执行成功                                                         |
| pnpm smoke            | 注册、8 工具、记忆、SSE 通过并清理测试账号                                           |
| Playwright            | 2 个浏览器流程通过                                                                   |
| 重启持久化            | PostgreSQL/API 正常停止重启后，会话和记忆仍可读取                                    |
| 天气 live             | Open-Meteo 地理编码与预报请求成功，mode=live                                         |
| 汇率 live             | Frankfurter CNY→USD 请求成功，mode=live                                              |
| 本地 Compose          | config --quiet 返回 0                                                                |
| 云端 Compose          | config --quiet 返回 0，构建上下文为工程根目录，可信代理跳数为 2                      |
| 生产依赖布局          | 独立目录 prod+frozen+offline 安装通过，显式生成 Prisma 后 Graph 和数据库客户端可加载 |

浏览器主流程：注册、demo 聊天、预算、记忆保存、新建/切换会话、刷新后重新登录、390px 移动布局无横向溢出。第二流程延迟账号 A 的列表响应，切换 B 后释放旧响应，验证 A 的私有标题不进入 B 的页面。桌面和移动截图在 screenshots/desktop.png、screenshots/mobile.png。

## 回归覆盖

- SSE 中文逐字节、CRLF、半帧 EOF、多行 data；输入日期/金额/长度/记忆白名单。
- 预算房间和晚数、无 key 的 live 拒绝启动、真实 StateGraph 循环/上限/取消。
- 供应商允许域名、预报覆盖、汇率日期与舍入。
- 认证、错误密码、重复邮箱、跨用户资源隔离。
- 同 requestId 幂等竞态、不同 ID 同用户并发、取消后 interrupted 状态。
- 工具 toString 原型名拒绝；bcrypt 72 UTF-8 字节边界。
- 1/2 跳代理客户端限流独立与伪造 XFF 前缀拒绝；退出账号关闭 RequestScope。

## 独立审阅

独立只读审阅发现三个 Important：代理 IP 限流、多字节密码截断、跨账号迟到响应。均补充先失败后通过的回归并修复。历史加载竞态原标 Minor，因可能覆盖新发送消息，按影响升级处理：旧请求完成回调检查取消状态，新会话显式清除 loading。

修复后执行全量测试、类型检查、生产构建、集成与浏览器验证，不以重复审阅代替测试。

## 未验证与限制

1. Docker CLI 存在，但 docker_engine 管道不可用。尝试启动 Desktop 后仍无法连接；未完成镜像构建、容器 health、容器重启持久化和镜像内反向代理验收。Compose 解析与生产依赖模拟不能替代运行容器。
2. 无 DeepSeek / OpenTripMap 凭据，因此模型自动工具调用、真实翻译/规划和景点数据未端到端实测，适配器和错误处理已实现。
3. 未创建云服务器、配置域名或签发证书；云端交付配置与说明。
4. 签证提供官方入口和清单，无实时政策库；景点直接工具保持供应商顺序；历史使用有界截断而非额外 LLM 摘要；完整工具卡片不跨会话恢复。
5. 单 API 实例；token 仅内存；无密码找回、邮箱验证、支付、预订和语音。
6. 非阻断构建提示：UI chunk 约 571KB（gzip 182KB），React 手动分块有空 chunk。后续可懒加载优化，当前不影响已测流程。

## 后续 Docker 验收

在正常桌面会话启动 Docker Desktop，确认 docker version 有 Server，再执行 README 的 Compose 和 smoke。若缺少 v2 插件，先修复安装。该步骤在本报告中保留为未完成。
