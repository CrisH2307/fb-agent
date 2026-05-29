// src/components/InboxView.js
// Messenger inbox modal: thread list → thread history + reply.

import React, { useState, useEffect, useRef } from "react";

const SERVER_URL = "http://localhost:3001";

function ThreadList({ threads, loading, error, onSelect }) {
  if (loading) return <div className="inbox-status">Loading inbox…</div>;
  if (error) return <div className="inbox-status inbox-error">⚠️ {error}</div>;
  if (!threads.length) return <div className="inbox-status">No threads found.</div>;

  return (
    <div className="inbox-thread-list">
      {threads.map((t, i) => (
        <button
          key={i}
          className="inbox-thread-card"
          onClick={() => onSelect(t)}
          type="button"
        >
          <div className="inbox-thread-info">
            <span className="inbox-thread-name">{t.name}</span>
            <span className="inbox-thread-preview">{t.lastMessage}</span>
          </div>
          {t.unread > 0 && (
            <span className="inbox-unread-dot">{t.unread}</span>
          )}
        </button>
      ))}
    </div>
  );
}

function ThreadDetail({ thread, onBack }) {
  const [messages, setMessages] = useState([]);
  const [recipientName, setRecipientName] = useState(thread.name || "");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `${SERVER_URL}/message/thread/read?url=${encodeURIComponent(thread.threadUrl)}`,
          { signal: AbortSignal.timeout(25000) }
        );
        const data = await res.json();
        setMessages(data.messages || []);
        if (data.recipientName) setRecipientName(data.recipientName);
      } catch {
        setError("Could not load thread history.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [thread.threadUrl]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!reply.trim()) return;
    setSending(true);
    setSendResult(null);
    try {
      const res = await fetch(`${SERVER_URL}/message/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threadUrl: thread.threadUrl,
          message: reply.trim(),
          recipient: recipientName,
        }),
        signal: AbortSignal.timeout(30000),
      });
      const data = await res.json();
      setSendResult(data);
      if (data.success) {
        setMessages((prev) => [
          ...prev,
          { sender: "me", text: reply.trim(), timestamp: "", isMe: true },
        ]);
        setReply("");
      }
    } catch {
      setSendResult({ success: false, error: "Request failed" });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="inbox-thread-detail">
      <div className="inbox-thread-detail-header">
        <button className="inbox-back-btn" onClick={onBack} type="button">
          ← Back
        </button>
        <span className="inbox-thread-detail-name">{recipientName}</span>
      </div>

      {loading && <div className="inbox-status">Loading messages…</div>}
      {error && <div className="inbox-status inbox-error">⚠️ {error}</div>}

      {!loading && (
        <div className="inbox-messages">
          {messages.length === 0 && (
            <div className="inbox-status">No messages yet.</div>
          )}
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`inbox-message ${msg.isMe ? "inbox-message-me" : "inbox-message-them"}`}
            >
              <div className="inbox-message-bubble">{msg.text}</div>
              {msg.timestamp && (
                <div className="inbox-message-time">{msg.timestamp}</div>
              )}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      )}

      <div className="inbox-reply-area">
        <textarea
          className="inbox-reply-input"
          placeholder="Type a reply…"
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSend();
          }}
          rows={2}
        />
        {sendResult && !sendResult.success && (
          <div className="inbox-send-error">
            ⚠️ {sendResult.reason || sendResult.error}
          </div>
        )}
        <button
          className="inbox-send-btn"
          onClick={handleSend}
          disabled={sending || !reply.trim()}
          type="button"
        >
          {sending ? "…" : "Send"}
        </button>
      </div>
    </div>
  );
}

export default function InboxView({ onClose }) {
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeThread, setActiveThread] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${SERVER_URL}/message/inbox`, {
          signal: AbortSignal.timeout(25000),
        });
        const data = await res.json();
        setThreads(data.threads || []);
        if (data.error && !data.threads?.length) setError(data.error);
      } catch {
        setError("Could not reach server.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <div className="inbox-overlay" onClick={onClose}>
      <div className="inbox-modal" onClick={(e) => e.stopPropagation()}>
        <div className="inbox-header">
          <span className="inbox-title">
            {activeThread ? activeThread.name : "Inbox"}
          </span>
          <button className="inbox-close-btn" onClick={onClose} type="button">
            ✕
          </button>
        </div>

        {activeThread ? (
          <ThreadDetail
            thread={activeThread}
            onBack={() => setActiveThread(null)}
          />
        ) : (
          <ThreadList
            threads={threads}
            loading={loading}
            error={error}
            onSelect={setActiveThread}
          />
        )}
      </div>
    </div>
  );
}
