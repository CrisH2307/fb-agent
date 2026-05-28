// src/App.js

import React, { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { useAgent } from "./hooks/useAgent";
import { NEGOTIATION_STYLES } from "./lib/agent";
import "./App.css";

// ─── Message Bubble ───────────────────────────────────────────────────────────

function MessageBubble({ message }) {
  const isUser = message.role === "user";

  return (
    <div className={`bubble-wrapper ${isUser ? "bubble-user" : "bubble-agent"}`}>
      <div className="bubble-label">{isUser ? "You" : "Agent"}</div>
      <div className="bubble">
        {isUser ? (
          <p className="bubble-text">{message.content}</p>
        ) : (
          <div className="bubble-markdown">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Style Selector ───────────────────────────────────────────────────────────

function StyleSelector({ value, onChange }) {
  return (
    <div className="style-selector">
      <span className="style-label">Negotiation style:</span>
      <div className="style-options">
        {Object.entries(NEGOTIATION_STYLES).map(([key, style]) => (
          <button
            key={key}
            className={`style-btn ${value === key ? "style-btn-active" : ""}`}
            onClick={() => onChange(key)}
            title={style.description}
          >
            {style.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Input Area ───────────────────────────────────────────────────────────────

function InputArea({ onSend, isLoading, isFirstMessage }) {
  const [value, setValue] = useState("");
  const textareaRef = useRef(null);

  const handleSend = () => {
    if (!value.trim() || isLoading) return;
    onSend(value);
    setValue("");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      handleSend();
    }
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [value]);

  return (
    <div className="input-area">
      <textarea
        ref={textareaRef}
        className="input-textarea"
        placeholder={
          isFirstMessage
            ? "Paste a Facebook post here (rental, marketplace item, job posting...)"
            : "Reply to the agent — e.g. 'too high, offer $15' or 'ask when it's available'"
        }
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        rows={3}
      />
      <div className="input-footer">
        <span className="input-hint">Ctrl+Enter to send</span>
        <button
          className="send-btn"
          onClick={handleSend}
          disabled={isLoading || !value.trim()}
        >
          {isLoading ? (
            <span className="loading-dots">
              <span>.</span>
              <span>.</span>
              <span>.</span>
            </span>
          ) : (
            "Send →"
          )}
        </button>
      </div>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const { messages, isLoading, error, negotiationStyle, setNegotiationStyle, sendMessage, reset } =
    useAgent();
  const bottomRef = useRef(null);
  const isFirstMessage = messages.length === 0;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-left">
          <span className="header-logo">◈</span>
          <div>
            <h1 className="header-title">FB Agent</h1>
            <p className="header-sub">Toronto · Vietnamese Community</p>
          </div>
        </div>
        <div className="header-right">
          <StyleSelector value={negotiationStyle} onChange={setNegotiationStyle} />
          {messages.length > 0 && (
            <button className="reset-btn" onClick={reset}>
              New Post
            </button>
          )}
        </div>
      </header>

      {/* Chat Area */}
      <main className="chat-area">
        {isFirstMessage ? (
          <div className="empty-state">
            <div className="empty-icon">📋</div>
            <h2 className="empty-title">Paste a Facebook post</h2>
            <p className="empty-desc">
              Rental listing, Marketplace item, job post, or anything from a Vietnamese community
              group. The agent will summarize it, assess the deal, and draft a message you can send.
            </p>
            <div className="empty-examples">
              <span className="example-tag">🏠 Rentals</span>
              <span className="example-tag">🛒 Marketplace</span>
              <span className="example-tag">💼 Job posts</span>
              <span className="example-tag">👥 Community posts</span>
            </div>
          </div>
        ) : (
          <div className="messages">
            {messages.map((msg, i) => (
              <MessageBubble key={i} message={msg} />
            ))}
            {isLoading && (
              <div className="bubble-wrapper bubble-agent">
                <div className="bubble-label">Agent</div>
                <div className="bubble bubble-thinking">
                  <span>Thinking</span>
                  <span className="loading-dots">
                    <span>.</span>
                    <span>.</span>
                    <span>.</span>
                  </span>
                </div>
              </div>
            )}
            {error && (
              <div className="error-banner">
                ⚠️ {error}
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </main>

      {/* Input */}
      <footer className="footer">
        <InputArea onSend={sendMessage} isLoading={isLoading} isFirstMessage={isFirstMessage} />
      </footer>
    </div>
  );
}
