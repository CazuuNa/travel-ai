import { Button, Popconfirm } from 'antd';
import {
  CompassOutlined,
  PlusOutlined,
  MessageOutlined,
  DeleteOutlined,
  LogoutOutlined,
  BookOutlined,
} from '@ant-design/icons';
import type { Conversation } from '@travel/shared';
export default function Sidebar(p: {
  conversations: Conversation[];
  selected?: string;
  busy: boolean;
  email: string;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onMemory: () => void;
  onLogout: () => void;
}) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <CompassOutlined /> 远行<span>WAYFARER</span>
      </div>
      <p className="sidebar-intro">为好奇心，安排一场旅行。</p>
      <Button
        type="primary"
        block
        size="large"
        icon={<PlusOutlined />}
        onClick={p.onNew}
        disabled={p.busy}
      >
        开启新旅程
      </Button>
      <div className="section-label mt-9">
        我的旅行会话 <span>{p.conversations.length.toString().padStart(2, '0')}</span>
      </div>
      <nav className="conversation-list" aria-label="会话列表">
        {p.conversations.length === 0 && (
          <p className="empty-conversations">第一段旅行，从这里开始。</p>
        )}
        {p.conversations.map((c) => (
          <div key={c.id} className={`conversation ${c.id === p.selected ? 'selected' : ''}`}>
            <button disabled={p.busy} onClick={() => p.onSelect(c.id)}>
              <MessageOutlined />
              <span>{c.title}</span>
            </button>
            <Popconfirm
              title="删除会话及其消息？"
              onConfirm={() => p.onDelete(c.id)}
              disabled={p.busy}
            >
              <Button
                type="text"
                aria-label={`删除 ${c.title}`}
                size="small"
                disabled={p.busy}
                icon={<DeleteOutlined />}
              />
            </Popconfirm>
          </div>
        ))}
      </nav>
      <div className="sidebar-footer">
        <button className="memory-link" onClick={p.onMemory}>
          <BookOutlined /> 旅行记忆 <span>由你掌控 ↗</span>
        </button>
        <div className="profile">
          <div className="avatar">{p.email[0]?.toUpperCase()}</div>
          <div>
            <strong>旅行者</strong>
            <small title={p.email}>{p.email}</small>
          </div>
          <Button
            type="text"
            aria-label="退出登录"
            disabled={p.busy}
            onClick={p.onLogout}
            icon={<LogoutOutlined />}
          />
        </div>
      </div>
    </aside>
  );
}
