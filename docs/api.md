# API 与 SSE 协议

基础路径 `/api`。JSON 请求设置 Content-Type: application/json。除 auth/register、auth/login、health 外，携带 Authorization: Bearer TOKEN。返回示例省略非必要字段，真实日期由服务器生成。

## 认证

| 方法与路径           | 请求               | 成功结果                                    |
| -------------------- | ------------------ | ------------------------------------------- |
| POST /auth/register  | `{email,password}` | 201，`{accessToken,user:{id,email}}`        |
| POST /auth/login     | `{email,password}` | 201，同上                                   |
| DELETE /auth/account | 无                 | 200，`{deleted:true}`，级联删除用户全部数据 |

邮箱转小写并去除首尾空白；密码至少 12 字符，且 UTF-8 编码最多 72 字节，避免 bcrypt 截断多字节密码。重复邮箱返回 409，错误密码返回 401，格式错误返回 400。此版登录 POST 默认使用 NestJS 的 201。

## 会话

| 方法与路径                      | 行为                                |
| ------------------------------- | ----------------------------------- |
| GET /conversations              | 返回最近 100 个会话，按更新时间倒序 |
| POST /conversations             | 请求 `{title?}`，创建会话           |
| GET /conversations/:id/messages | 返回最近 500 条消息，按时间顺序排列 |
| DELETE /conversations/:id       | 删除会话、消息、请求、执行记录      |

会话对象包括 id、userId、title、createdAt、updatedAt。消息包括 id、conversationId、role、content、status、requestId、createdAt。role 为 user 或 assistant；status 为 running、complete、interrupted、failed。对不存在或其他用户的会话返回同样的 404，不泄露存在性。

## 长期记忆

- GET /memories：当前用户的偏好列表。
- POST /memories：`{key,value,confirmed:true}`。相同 key 会更新原值。
- DELETE /memories/:id：仅删除属于当前用户的记忆。

key 仅允许 interests / pace / budgetLevel / diet / homeCity / language。value 1–300 字符。confirmed 必须是布尔字面量 true。记录包含 id、userId、key、value、source、时间；source 为 user-confirmed。

## 工具

GET /tools 返回八个工具的 id、name、description、icon。POST /tools/:id 接收对应 shared Schema 定义的结构化 JSON，详见 tools.md。直接调用不会自动保存为聊天消息。

```json
{
  "status": "ok",
  "data": { "total": 2090, "currency": "CNY" },
  "sources": [{ "name": "用户输入与预算计算规则" }],
  "fetchedAt": "2026-10-18T09:00:00.000Z",
  "mode": "estimated",
  "warning": "估算不含往返大交通"
}
```

业务工具失败使用同一封装：status=error，error={code,message,retryable}，可能仍是 HTTP 201。消费者必须检查 status，不能只检查 HTTP 是否 2xx。认证、请求体过大等传输错误仍使用 HTTP 错误码。

常见工具码：INVALID_INPUT、UNKNOWN_TOOL、PROVIDER_NOT_CONFIGURED、LOCATION_NOT_FOUND、FORECAST_RANGE、CURRENCY_UNSUPPORTED、PROVIDER_HTTP、PROVIDER_SIZE、TOOL_FAILED。

## 聊天流

POST /chat/stream，输入：

```json
{
  "conversationId": "可选的现有会话UUID",
  "requestId": "客户端生成的全新UUID",
  "message": "安排杭州三日游，预算3000元，两个人"
}
```

message 1–8000 字符。首次调用省略 conversationId，服务端新建并通过 meta 返回 ID。新的一次用户发送使用新 requestId；同一 requestId 不可用来改写消息或触发重播。

HTTP 200、Content-Type: text/event-stream; charset=utf-8。每帧 `data: JSON` 后跟两个换行。所有业务事件含 requestId 和递增 seq。

```text
data: {"type":"meta","conversationId":"...","mode":"live","requestId":"...","seq":1}

data: {"type":"tool_start","toolId":"weather","requestId":"...","seq":2}

data: {"type":"tool_result","toolId":"weather","result":{"status":"ok","data":{},"sources":[],"fetchedAt":"...","mode":"live"},"durationMs":200,"requestId":"...","seq":3}

data: {"type":"token","text":"根据预报，","requestId":"...","seq":4}

data: {"type":"done","status":"complete","requestId":"...","seq":5}

```

每 15 秒可能出现 `: heartbeat` 注释帧，客户端忽略。token 不包含模型内部 reasoning_content。工具结果是完整 JSON，不需要前端拼接工具参数片段。

开始前校验失败使用标准 JSON 错误与状态码；开始后生成失败发送 error 事件并结束。异常流不发送 done；成功流恰好一个 done。用户主动取消时连接已关闭，不能保证接收到 error，应查询会话状态。前端发现 EOF 没有 terminal 事件时报告连接中断。

重复 requestId 或同用户已有生成返回 409。客户端停止使用 AbortController；不自动重试模型请求。此版不支持 Last-Event-ID、断点事件重放、WebSocket、工具输入的人审暂停。

## 健康检查与错误

GET /health/live 返回 `{status:'ok',mode,name:'travel-ai'}`；GET /health/ready 用 SELECT 1 检查数据库，可返回 503。

标准错误：`{code,message,requestId}`。不返回原始 Prisma 堆栈、供应商密钥或提示词。限流响应为 `{code:'RATE_LIMIT',message}`。错误码不是仅供显示，调用方应依据 HTTP 状态与 code 分别处理登录、输入、重复请求及服务异常。
