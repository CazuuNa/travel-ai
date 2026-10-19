import { useCallback, useEffect, useState } from 'react';
import { App as AntApp, Alert } from 'antd';
import type { Conversation, ToolId } from '@travel/shared';
import AuthPage from './features/auth/AuthPage';
import Sidebar from './components/Sidebar';
import ChatWorkspace from './features/chat/ChatWorkspace';
import ToolDrawer from './features/tools/ToolDrawer';
import MemoryDrawer from './features/memory/MemoryDrawer';
import { api, setToken } from './lib/api';
import { RequestScope } from './lib/request-scope';
export default function App() {
  const [email, setEmail] = useState('');
  const [scope, setScope] = useState(() => new RequestScope());
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<string>();
  const [tool, setTool] = useState<ToolId>();
  const [memory, setMemory] = useState(false);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState('demo');
  const [online, setOnline] = useState(true);
  const { message } = AntApp.useApp();
  const load = useCallback(() => {
    if (email)
      void scope.run(
        (signal) => api<Conversation[]>('/conversations', { signal }),
        setConversations,
        (e) => {
          message.error(e.message);
        },
      );
  }, [email, message, scope]);
  useEffect(load, [load]);
  useEffect(() => {
    api<{ mode: string; name: string }>('/health/live')
      .then((r) => {
        if (r.name !== 'travel-ai') throw new Error();
        setMode(r.mode);
      })
      .catch(() => setOnline(false));
  }, []);
  function remove(id: string) {
    void scope.run(
      (signal) => api(`/conversations/${id}`, { method: 'DELETE', signal }),
      () => {
        if (id === selected) setSelected(undefined);
        load();
      },
      (e) => {
        message.error(e.message);
      },
    );
  }
  if (!email)
    return (
      <>
        {!online && (
          <Alert
            banner
            type="warning"
            message="无法连接 Travel AI 后端，请检查服务启动状态与代理配置。"
          />
        )}
        <AuthPage
          onLogin={(value) => {
            setScope(new RequestScope());
            setEmail(value);
          }}
        />
      </>
    );
  return (
    <div className="app-shell">
      <Sidebar
        conversations={conversations}
        selected={selected}
        busy={busy}
        email={email}
        onSelect={setSelected}
        onNew={() => setSelected(undefined)}
        onDelete={remove}
        onMemory={() => setMemory(true)}
        onLogout={() => {
          scope.close();
          setToken('');
          setEmail('');
          setSelected(undefined);
          setConversations([]);
          setTool(undefined);
          setMemory(false);
        }}
      />
      <ChatWorkspace
        conversationId={selected}
        mode={mode}
        onConversation={setSelected}
        onRefresh={load}
        onTool={setTool}
        onBusy={setBusy}
      />
      <ToolDrawer id={tool} onClose={() => setTool(undefined)} />
      <MemoryDrawer open={memory} onClose={() => setMemory(false)} />
    </div>
  );
}
