import { useEffect, useState } from 'react';
import { App, Button, Drawer, Form, Input, Select, Alert, Popconfirm } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import { memoryKeys, memoryLabels, type Memory } from '@travel/shared';
import { api } from '../../lib/api';
export default function MemoryDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [items, setItems] = useState<Memory[]>([]);
  const [busy, setBusy] = useState(false);
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const load = () =>
    api<Memory[]>('/memories')
      .then(setItems)
      .catch((e) => message.error(e.message));
  useEffect(() => {
    if (open) void load();
  }, [open]);
  async function save(values: { key: string; value: string }) {
    setBusy(true);
    try {
      await api('/memories', { method: 'POST', body: { ...values, confirmed: true } });
      form.resetFields();
      await load();
      message.success('偏好已保存');
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function remove(id: string) {
    try {
      await api(`/memories/${id}`, { method: 'DELETE' });
      await load();
    } catch (e) {
      message.error((e as Error).message);
    }
  }
  return (
    <Drawer title="旅行记忆" open={open} onClose={onClose} width={480}>
      <Alert
        message="只记住你确认的偏好"
        description="保存后，后续对话会参考这些信息。同类偏好再次保存会更新原值。请勿填写证件号、银行卡等敏感信息。"
        type="info"
        className="mb-6"
      />
      <div className="memory-items">
        {items.map((m) => (
          <div key={m.id} className="memory-item">
            <div>
              <span>{memoryLabels[m.key]}</span>
              <p>{m.value}</p>
            </div>
            <div className="flex gap-1">
              <Button
                type="text"
                onClick={() => form.setFieldsValue({ key: m.key, value: m.value })}
              >
                修改
              </Button>
              <Popconfirm title="删除这条记忆？" onConfirm={() => remove(m.id)}>
                <Button type="text" aria-label="删除记忆" icon={<DeleteOutlined />} />
              </Popconfirm>
            </div>
          </div>
        ))}
      </div>
      <h3 className="mt-6 mb-4">保存旅行偏好</h3>
      <Form form={form} onFinish={save} layout="vertical">
        <Form.Item name="key" label="偏好类型" rules={[{ required: true }]}>
          <Select options={memoryKeys.map((k) => ({ value: k, label: memoryLabels[k] }))} />
        </Form.Item>
        <Form.Item name="value" label="偏好内容" rules={[{ required: true, whitespace: true }]}>
          <Input.TextArea maxLength={300} showCount placeholder="例如：喜欢慢节奏的城市漫步" />
        </Form.Item>
        <Button type="primary" htmlType="submit" loading={busy} block>
          确认并保存记忆
        </Button>
      </Form>
    </Drawer>
  );
}
