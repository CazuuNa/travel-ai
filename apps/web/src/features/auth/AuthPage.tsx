import { useState } from 'react';
import { Alert, Button, Form, Input } from 'antd';
import { ArrowRightOutlined, CompassOutlined } from '@ant-design/icons';
import { api, setToken } from '../../lib/api';
import { AuthSchema } from '@travel/shared';
export default function AuthPage({ onLogin }: { onLogin: (email: string) => void }) {
  const [register, setRegister] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(body: { email: string; password: string }) {
    setBusy(true);
    setError('');
    try {
      const parsed = AuthSchema.safeParse(body);
      if (!parsed.success) throw new Error(parsed.error.issues.map((i) => i.message).join('；'));
      const r = await api<{ accessToken: string; user: { email: string } }>(
        `/auth/${register ? 'register' : 'login'}`,
        { method: 'POST', body },
      );
      setToken(r.accessToken);
      onLogin(r.user.email);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-shell">
      <section className="auth-story">
        <a className="brand">
          <CompassOutlined /> 远行<span>WAYFARER</span>
        </a>
        <div>
          <p className="eyebrow">A LITTLE CURIOSITY. A WORLD TO EXPLORE.</p>
          <h1>
            下一站，
            <br />
            遇见新风景。
          </h1>
          <p>
            从第一个灵感，到最后一件行李。
            <br />
            让你的旅行助手，陪你把世界慢慢走遍。
          </p>
        </div>
        <div className="auth-landscape" aria-hidden="true">
          <i />
          <i />
          <i />
          <span>每一段旅程，都从一个想法开始。</span>
        </div>
      </section>
      <section className="auth-form">
        <div className="w-full max-w-sm">
          <p className="eyebrow">YOUR NEXT CHAPTER</p>
          <h2>{register ? '开启你的旅行故事' : '欢迎回来，旅行者'}</h2>
          <p className="muted mb-8">登录以保存行程、会话和你的旅行偏好。</p>
          {error && <Alert type="error" message={error} showIcon className="mb-5" />}
          <Form layout="vertical" onFinish={submit} requiredMark={false}>
            <Form.Item
              name="email"
              label="邮箱"
              rules={[{ required: true, type: 'email', message: '请输入有效邮箱' }]}
            >
              <Input autoComplete="email" size="large" placeholder="you@example.com" />
            </Form.Item>
            <Form.Item
              name="password"
              label="密码"
              rules={[{ required: true, min: 12, max: 72, message: '密码长度为 12–72 个字符' }]}
            >
              <Input.Password
                autoComplete={register ? 'new-password' : 'current-password'}
                size="large"
                placeholder="至少 12 个字符"
              />
            </Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              size="large"
              block
              loading={busy}
              icon={<ArrowRightOutlined />}
              iconPosition="end"
            >
              {register ? '创建账号并出发' : '登录并出发'}
            </Button>
          </Form>
          <p className="mt-6 text-center muted">
            {register ? '已有账号？' : '第一次来到这里？'}{' '}
            <Button
              type="link"
              onClick={() => {
                setRegister(!register);
                setError('');
              }}
            >
              {register ? '返回登录' : '注册账号'}
            </Button>
          </p>
          <p className="auth-note">
            你的旅行记忆由你管理，可随时查看和删除。
            <br />
            本地部署数据保存在你自己的 PostgreSQL 数据库。
          </p>
        </div>
      </section>
    </div>
  );
}
