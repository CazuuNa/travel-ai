# 八个工具与数据供应商

## 通用流程

工具 ID、目录、示例和 Zod 输入位于 `packages/shared/src/tools.ts`；工具入口位于 `apps/api/src/tools/tools.service.ts`。每次输入只允许 Schema 定义字段，未知字段被拒绝。成功和失败都返回 mode、sources、fetchedAt。

mode=demo 表示演示；live 表示外部数据；estimated 表示规则估算或生成建议。fetchedAt 是本次处理时间，不等于政策发布日期或汇率基准日。签证的 policyVerifiedAt 在未核验时为 null；汇率单独返回 rateDate。

## 1. 行程规划 itinerary

输入 destination、startDate、endDate；可选 people=1、interests=美食与文化、pace=适中、budget=3000（CNY）。日期必须真实存在、递增且不超过 60 天。

live 由 DeepSeek 生成逐日路线、交通方式、时间缓冲和费用估算。该工具不查询酒店库存或实时票价，也不预订。天气与景点实时数据由 Agent 另外调用相应工具后整合。demo 返回带输入信息的固定模板。

## 2. 天气 weather

输入 city，可选 date。先用 Open-Meteo Geocoding 查经纬度，再请求 16 天 daily 预报。输出温度（°C）、降雨概率（%）、WMO 天气代码、时区、城市定位信息。若提供日期，必须位于供应商实际返回日期列表中，不能把气候均值冒充预报。

接口：`https://geocoding-api.open-meteo.com/v1/search`；`https://api.open-meteo.com/v1/forecast`。同名地点第一条结果可能不符合用户意图，界面应核对返回 location；后续可增加地理候选选择。

参考：[Geocoding](https://open-meteo.com/en/docs/geocoding-api)、[Forecast](https://open-meteo.com/en/docs)、[使用条款](https://open-meteo.com/en/terms)。免费服务的商业使用、配额和来源署名要求需要在上线前单独核对。

## 3. 景点 attractions

输入 destination、interests=文化与自然、count=5（1–10）。使用地理编码后查询 15km 范围的 OpenTripMap 候选，过滤空名称，最多返回 count 个，包含类别、距离和供应商详情链接。

需要 OPENTRIPMAP_API_KEY。当前候选保持供应商顺序，interests 作为用户语义在 Agent 整理时参考，直接工具不进行个性化排序。不生成评分、票价和营业时间。demo 的“历史街区”等明确是通用样例，不声称属于输入城市。

参考：[OpenTripMap](https://opentripmap.io/product)、[供应商 API](https://api.opentripmap.com/0.1/en/places/radius)。外部可用性与账户套餐未在本交付环境实测。

## 4. 预算 budget

输入 days=必填，people=1，currency=CNY，dailyHotel=300，dailyFood=100，dailyTransport=50，tickets=200，reservePercent=10。单价必须非负，days 1–60，people 1–30。

计算口径：rooms=ceil(people/2)，nights=days−1；hotel=dailyHotel×nights×rooms；food=dailyFood×days×people；transport=dailyTransport×days×people；ticketsTotal=tickets×people。subtotal 为四项合计，reserve=subtotal×reservePercent/100，total=subtotal+reserve。金额四舍五入保留两位小数。

示例：3 天、2 人、上述单价 → 酒店 600 + 餐饮 600 + 交通 300 + 门票 400 = 1900；预备金 190；合计 2090。按房间计费与按人计费不能混淆。输入币种仅定义金额单位，不自动转换单价；默认价格是估算参考，不是目的地报价。不包含往返大交通。

## 5. 签证 visa

输入 nationality、destination、purpose=旅游。输出准备清单、官方查询入口、覆盖状态和核验时间。不调用模型推断确定政策。

当前中国赴日识别为官方指引入口，链接日本外务省；其他组合显示未覆盖，并提供旅行证件查询指引。没有经审核的免签政策数据库，因此不返回“可免签 N 天”等结论。要扩展为政策库，需新增国籍/目的地/目的/停留期限匹配、官方来源、有效期、复核时间及人工复核流程；到期记录不得继续给出确定结论。

参考：[日本外务省签证](https://www.mofa.go.jp/j_info/visit/visa/index.html)、[IATA Travel Centre](https://www.iatatravelcentre.com/)。页面链接是查询入口，不代表抓取并核验了实时政策。

## 6. 汇率 currency

输入 from=CNY、to=USD、amount。币种必须三位大写代码；具体支持范围由供应商决定。请求 Frankfurter v1/latest 的 base 与 symbols，输出 rate、rateDate、converted。相同币种不请求网络，恒等换算。

参考汇率可能是最近一个发布日，而非交易时刻报价；不含换汇手续费与银行价差。demo 使用固定 0.14 示例（同币种为 1），无实际金融意义。

参考：[Frankfurter v1](https://frankfurter.dev/v1/)。

## 7. 打包 packing

输入 destination、days、weather=温和、activities=城市漫步、withChildren=false。规则生成证件支付、衣物和日常用品分类；根据雨雪、凉冷、徒步及儿童条件追加项目。默认最多 7 套衣物，提醒按洗衣安排调整。

没有根据 weather 文本自动查询天气，用户或 Agent 应先调用天气工具。药品和入境材料需要自行核实。当前结果展示为分类清单，没有跨设备保存单项勾选状态。

## 8. 翻译 translation

输入 text（1–3000 字符）、from=自动检测、to=必填、scene=旅游日常。live 使用 DeepSeek 返回译文、礼貌表达及必要文化说明；输入被视为待处理数据，不执行其中的指令。demo 始终返回固定的英语问路样例，并明确提示任意输入需要 live。

当前仅文本，没有麦克风、语音识别、音频合成或离线翻译引擎。

## 网络封装与可扩展点

provider-client 固定允许四个 HTTPS 域名，禁止重定向，最大响应 2MB，共用 12 秒超时，最多两次尝试。仅可重试的 HTTP 错误和网络错误重试；4xx 非限流不重复请求。Zod 验证供应商 JSON，防止结构变化造成错误展示。

新增供应商应修改固定域名允许集、实现输出解析、添加本地固定响应测试并更新来源文档。不要接受模型给出的任意 URL，也不要把带 apikey 查询串的请求地址记录到日志。

模型参考：[ChatDeepSeek](https://docs.langchain.com/oss/javascript/integrations/chat/deepseek)、[LangGraph Quickstart](https://docs.langchain.com/oss/javascript/langgraph/quickstart)、[DeepSeek API](https://api-docs.deepseek.com/)。具体包版本由锁文件固定，模型 ID 可通过环境变量调整。
