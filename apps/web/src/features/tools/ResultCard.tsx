import { Alert, Tag } from 'antd';
import type { ToolResult } from '@travel/shared';
import ReactMarkdown from 'react-markdown';
function Value({ value }: { value: unknown }) {
  if (value == null) return <span className="muted">—</span>;
  if (typeof value === 'string') return <ReactMarkdown skipHtml>{value}</ReactMarkdown>;
  if (typeof value === 'number' || typeof value === 'boolean') return <span>{String(value)}</span>;
  if (Array.isArray(value))
    return (
      <div className="result-array">
        {value.map((v, i) => (
          <div className="result-array-item" key={i}>
            <Value value={v} />
          </div>
        ))}
      </div>
    );
  return (
    <dl className="result-object">
      {Object.entries(value as Record<string, unknown>).map(([k, v]) => (
        <div key={k}>
          <dt>{labels[k] ?? k}</dt>
          <dd>
            <Value value={v} />
          </dd>
        </div>
      ))}
    </dl>
  );
}
const labels: Record<string, string> = {
  text: '建议内容',
  destination: '目的地',
  location: '地点',
  days: '天数 / 每日预报',
  items: '明细',
  total: '合计',
  subtotal: '小计',
  reserve: '预备金',
  perPerson: '每人预算',
  hotel: '住宿',
  food: '餐饮',
  transport: '交通',
  tickets: '门票',
  currency: '币种',
  rate: '汇率',
  converted: '换算金额',
  rateDate: '汇率日期',
  amount: '金额',
  from: '源币种',
  to: '目标币种',
  name: '名称',
  note: '说明',
  categories: '分类',
  assumptions: '计算口径',
  conclusion: '查询结论',
  checklist: '准备清单',
  officialUrl: '官方查询入口',
  coverage: '覆盖状态',
  policyVerifiedAt: '政策核验日期',
  nationality: '国籍',
  purpose: '目的',
  original: '原文',
  condition: '天气',
  min: '最低温度',
  max: '最高温度',
  date: '日期',
  people: '人数',
  rooms: '房间数',
  nights: '晚数',
  dailyHotel: '每间每晚',
  dailyFood: '每人每日餐费',
  dailyTransport: '每人每日交通',
  reservePercent: '预备金比例（%）',
  rainProbability: '降雨概率（%）',
  weatherCode: 'WMO 天气代码',
  distanceMeters: '距离（米）',
  timezone: '时区',
  url: '详情链接',
  units: '单位',
};
export default function ResultCard({ result }: { result: ToolResult }) {
  return (
    <div className="result-card">
      <div className="flex items-center gap-2 mb-3">
        <Tag color={result.mode === 'demo' ? 'gold' : result.mode === 'live' ? 'green' : 'blue'}>
          {result.mode === 'demo'
            ? '演示数据'
            : result.mode === 'live'
              ? '外部数据'
              : '估算 / 建议'}
        </Tag>
        <span className="text-xs muted">{new Date(result.fetchedAt).toLocaleString('zh-CN')}</span>
      </div>
      {result.warning && <Alert type="warning" message={result.warning} className="mb-4" />}
      {result.status === 'error' ? (
        <Alert type="error" message={result.error?.message} description={result.error?.code} />
      ) : (
        <Value value={result.data} />
      )}
      <div className="result-sources">
        结果来源：
        {result.sources.map((s, i) => (
          <span key={i}>
            {s.url ? (
              <a href={s.url} target="_blank" rel="noreferrer">
                {s.name} ↗
              </a>
            ) : (
              s.name
            )}{' '}
          </span>
        ))}
      </div>
    </div>
  );
}
