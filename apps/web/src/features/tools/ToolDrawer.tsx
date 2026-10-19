import { useEffect, useState } from 'react';
import { App, Button, Drawer, Form, Input, InputNumber, Select, Switch } from 'antd';
import {
  toolCatalog,
  toolExamples,
  toolSchemas,
  type ToolId,
  type ToolResult,
} from '@travel/shared';
import { api } from '../../lib/api';
import ResultCard from './ResultCard';
const labels: Record<string, string> = {
  destination: '目的地',
  startDate: '出发日期',
  endDate: '结束日期',
  people: '人数',
  interests: '兴趣偏好',
  pace: '旅行节奏',
  budget: '总预算（CNY）',
  city: '城市',
  date: '预报日期（可选）',
  count: '推荐数量',
  days: '旅行天数',
  currency: '预算币种',
  dailyHotel: '每间每晚住宿费',
  dailyFood: '每人每日餐费',
  dailyTransport: '每人每日市内交通',
  tickets: '每人全程门票费',
  reservePercent: '预备金比例（%）',
  nationality: '护照国籍',
  purpose: '旅行目的',
  from: '源币种 / 语言',
  to: '目标币种 / 语言',
  amount: '换算金额',
  weather: '天气情况',
  activities: '主要活动',
  withChildren: '携带儿童',
  text: '待翻译文本',
  scene: '使用场景',
};
export default function ToolDrawer({ id, onClose }: { id?: ToolId; onClose: () => void }) {
  const [form] = Form.useForm();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ToolResult>();
  const { message } = App.useApp();
  useEffect(() => {
    if (id) {
      form.resetFields();
      form.setFieldsValue(toolExamples[id]);
      setResult(undefined);
    }
  }, [id, form]);
  async function submit(values: Record<string, unknown>) {
    if (!id) return;
    const input = Object.fromEntries(
      Object.entries(values).filter(([, v]) => v !== undefined && v !== ''),
    );
    const p = toolSchemas[id].safeParse(input);
    if (!p.success) {
      message.error(p.error.issues.map((i) => i.message).join('；'));
      return;
    }
    setBusy(true);
    try {
      setResult(await api<ToolResult>(`/tools/${id}`, { method: 'POST', body: p.data }));
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const fields = id ? { ...toolExamples[id], ...(id === 'weather' ? { date: '' } : {}) } : {};
  return (
    <Drawer
      title={toolCatalog.find((t) => t.id === id)?.name}
      open={!!id}
      onClose={onClose}
      width={560}
      destroyOnHidden
      maskClosable={!busy}
      closable={!busy}
    >
      <p className="muted mb-6">填写旅行信息，获取有来源、有边界的结果。</p>
      <Form form={form} layout="vertical" onFinish={submit} requiredMark={false}>
        {Object.entries(fields).map(([key, value]) => (
          <Form.Item
            key={key}
            name={key}
            label={labels[key] ?? key}
            valuePropName={typeof value === 'boolean' ? 'checked' : 'value'}
            rules={key === 'date' ? [] : [{ required: true, message: '请填写此项' }]}
          >
            {typeof value === 'boolean' ? (
              <Switch />
            ) : typeof value === 'number' ? (
              <InputNumber className="w-full" min={0} max={10000000} />
            ) : key === 'pace' ? (
              <Select options={['轻松', '适中', '紧凑'].map((v) => ({ value: v, label: v }))} />
            ) : key === 'text' ? (
              <Input.TextArea rows={4} maxLength={3000} />
            ) : (
              <Input type={/Date$|^date$/.test(key) ? 'date' : 'text'} maxLength={200} />
            )}
          </Form.Item>
        ))}
        <Button type="primary" block htmlType="submit" loading={busy}>
          开始查询
        </Button>
      </Form>
      {result && (
        <div className="mt-7">
          <ResultCard result={result} />
        </div>
      )}
    </Drawer>
  );
}
