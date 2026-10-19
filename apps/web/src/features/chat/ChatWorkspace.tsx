import { useEffect, useRef, useState } from 'react';
import { App, Button, Input, Tag, Tooltip } from 'antd';
import {
  ArrowUpOutlined,
  StopOutlined,
  CompassOutlined,
  ArrowRightOutlined,
  LoadingOutlined,
} from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import {
  toolCatalog,
  type ChatMessage,
  type StreamEvent,
  type ToolId,
  type ToolResult,
} from '@travel/shared';
import { api, streamChat } from '../../lib/api';
import { createRequestId } from '../../lib/uuid';
import ResultCard from '../tools/ResultCard';
const starters = [
  '帮我安排杭州三日游，喜欢美食和文化',
  '两个人旅行 5 天，怎样估算预算？',
  '第一次出国，需要准备什么？',
];
export default function ChatWorkspace(p: {
  conversationId?: string;
  mode: string;
  onConversation: (id: string) => void;
  onRefresh: () => void;
  onTool: (id: ToolId) => void;
  onBusy: (busy: boolean) => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tools, setTools] = useState<{ id: ToolId; result?: ToolResult }[]>([]);
  const ac = useRef<AbortController | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const localId = useRef<string | undefined>(undefined);
  const { message } = App.useApp();
  useEffect(() => {
    if (p.conversationId === localId.current) return;
    localId.current = p.conversationId;
    setTools([]);
    if (!p.conversationId) {
      setMessages([]);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    api<ChatMessage[]>(`/conversations/${p.conversationId}/messages`, { signal: controller.signal })
      .then((value) => {
        if (!controller.signal.aborted) setMessages(value);
      })
      .catch((e) => {
        if (!controller.signal.aborted) message.error(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [p.conversationId]);
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, tools]);
  useEffect(() => () => ac.current?.abort(), []);
  async function send(value = text) {
    if (!value.trim() || busy || loading) return;
    let requestId: string;
    let responseId: string;
    try {
      requestId = createRequestId();
      responseId = createRequestId();
    } catch (e) {
      message.error((e as Error).message);
      return;
    }
    const userText = value.trim();
    setText('');
    setBusy(true);
    p.onBusy(true);
    setTools([]);
    const controller = new AbortController();
    ac.current = controller;
    const now = new Date().toISOString();
    setMessages((m) => [
      ...m,
      { id: requestId, role: 'user', content: userText, status: 'complete', createdAt: now },
      { id: responseId, role: 'assistant', content: '', status: 'running', createdAt: now },
    ]);
    let currentId = p.conversationId;
    function event(e: StreamEvent) {
      if (e.type === 'meta') {
        currentId = e.conversationId;
        localId.current = e.conversationId;
        p.onConversation(e.conversationId);
      }
      if (e.type === 'token')
        setMessages((m) =>
          m.map((v) => (v.id === responseId ? { ...v, content: v.content + e.text } : v)),
        );
      if (e.type === 'tool_start') setTools((t) => [...t, { id: e.toolId }]);
      if (e.type === 'tool_result')
        setTools((t) => {
          const copy = [...t];
          const i = copy.findIndex((v) => v.id === e.toolId && !v.result);
          if (i >= 0) copy[i] = { id: e.toolId, result: e.result };
          return copy;
        });
    }
    try {
      await streamChat(
        { conversationId: p.conversationId, requestId, message: userText },
        controller.signal,
        event,
      );
      setMessages((m) => m.map((v) => (v.id === responseId ? { ...v, status: 'complete' } : v)));
    } catch (e) {
      if (!controller.signal.aborted) message.error((e as Error).message);
      setMessages((m) =>
        m.map((v) =>
          v.id === responseId
            ? { ...v, status: controller.signal.aborted ? 'interrupted' : 'failed' }
            : v,
        ),
      );
    } finally {
      ac.current = null;
      setBusy(false);
      p.onBusy(false);
      p.onRefresh();
      if (currentId) localId.current = currentId;
    }
  }
  return (
    <main className="workspace">
      <header className="workspace-header">
        <div>
          <span className="header-breadcrumb">你的专属旅行助手</span>
          <span className="header-divider">/</span>
          <strong>旅行灵感室</strong>
        </div>
        <Tag color={p.mode === 'live' ? 'green' : 'gold'}>
          {p.mode === 'live' ? '实时模式' : '演示模式'}
        </Tag>
      </header>
      <div className="workspace-grid">
        <section className="chat-column">
          <div className="chat-scroll">
            {messages.length === 0 && !loading ? (
              <div className="welcome">
                <p className="eyebrow">
                  <span className="tiny-dot" /> THE WORLD IS WAITING
                </p>
                <h1>
                  心之所向，
                  <br />
                  <em>皆可远行。</em>
                </h1>
                <p className="welcome-description">
                  我是远行，你的 AI 旅行伙伴。
                  <br />
                  告诉我一个目的地，我们一起把期待变成行程。
                </p>
                <div className="destination-art" aria-hidden="true">
                  <div className="art-sun" />
                  <div className="art-mountain mountain-back" />
                  <div className="art-mountain mountain-front" />
                  <div className="art-river" />
                  <div className="art-caption">
                    <span>EXPLORE AT YOUR OWN PACE</span>
                    <strong>把时间，留给沿途。</strong>
                  </div>
                  <span className="art-coordinate">30°15′ N · 120°10′ E</span>
                </div>
                <p className="section-label mt-7">不妨从这里开始</p>
                <div className="starters">
                  {starters.map((s, i) => (
                    <button key={s} onClick={() => void send(s)}>
                      <span>0{i + 1}</span>
                      {s}
                      <ArrowRightOutlined />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="messages" aria-live="polite">
                {loading && <p className="muted">正在读取旅行会话…</p>}
                {messages.map((m) => (
                  <article className={`message message-${m.role}`} key={m.id}>
                    <div className="message-avatar">
                      {m.role === 'user' ? '你' : <CompassOutlined />}
                    </div>
                    <div className="message-body">
                      <div className="message-name">
                        {m.role === 'user' ? '你' : '远行 AI'}
                        {m.status === 'running' && (
                          <span className="typing-label">
                            正在构思 <LoadingOutlined />
                          </span>
                        )}
                      </div>
                      <div className="markdown">
                        <ReactMarkdown skipHtml>
                          {m.content ||
                            (m.status === 'running'
                              ? '正在为你的旅程寻找灵感…'
                              : '本次没有生成内容。')}
                        </ReactMarkdown>
                      </div>
                      {['interrupted', 'failed'].includes(m.status) && (
                        <span className="message-status">
                          {m.status === 'interrupted'
                            ? '已停止，保留已有内容'
                            : '生成失败，可重新发送'}
                        </span>
                      )}
                    </div>
                  </article>
                ))}
                {tools.map((t, i) => (
                  <div className="chat-tool" key={i}>
                    <p>
                      {toolCatalog.find((x) => x.id === t.id)?.name}{' '}
                      {t.result ? '✓' : <LoadingOutlined />}
                    </p>
                    {t.result && <ResultCard result={t.result} />}
                  </div>
                ))}
                <div ref={bottom} />
              </div>
            )}
          </div>
          <div className="composer-wrap">
            <div className="composer">
              <Input.TextArea
                aria-label="旅行问题"
                placeholder="告诉我，你想去哪里？"
                value={text}
                onChange={(e) => setText(e.target.value)}
                autoSize={{ minRows: 2, maxRows: 5 }}
                maxLength={8000}
                disabled={loading}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    void send();
                  }
                }}
              />
              <div className="composer-actions">
                <span>
                  <CompassOutlined />{' '}
                  {busy ? '正在为你整理旅途灵感' : '目的地 · 日期 · 人数 · 预算'}
                </span>
                {busy ? (
                  <Button
                    aria-label="停止生成"
                    icon={<StopOutlined />}
                    onClick={() => ac.current?.abort()}
                  >
                    停止
                  </Button>
                ) : (
                  <Tooltip title="Enter 发送，Shift + Enter 换行">
                    <Button
                      aria-label="发送消息"
                      type="primary"
                      shape="circle"
                      disabled={!text.trim() || loading}
                      onClick={() => void send()}
                      icon={<ArrowUpOutlined />}
                    />
                  </Tooltip>
                )}
              </div>
            </div>
            <p className="composer-note">
              AI 建议供旅行准备参考，天气、价格与入境政策请核对来源。
              {p.mode !== 'live' && ' 当前为演示数据。'}
            </p>
          </div>
        </section>
        <aside className="tool-rail">
          <p className="eyebrow">TRAVEL ESSENTIALS</p>
          <h2>旅途中的小帮手</h2>
          <p className="muted text-sm mb-6">少一点准备的繁琐，多一点出发的期待。</p>
          <div className="tools-grid">
            {toolCatalog.map((t) => (
              <button key={t.id} className="tool-button" onClick={() => p.onTool(t.id)}>
                <span className={`tool-icon icon-${t.id}`}>{t.icon}</span>
                <strong>{t.name}</strong>
                <small>{t.description}</small>
                <ArrowRightOutlined className="tool-arrow" />
              </button>
            ))}
          </div>
          <div className="travel-note">
            <span>✳</span>
            <p>
              好的旅行计划，
              <br />
              也要留一点空白。
            </p>
            <small>给偶遇，给停留，给意料之外。</small>
          </div>
        </aside>
      </div>
    </main>
  );
}
