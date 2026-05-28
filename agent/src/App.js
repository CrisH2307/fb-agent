// src/App.js

import React, { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { useAgent } from "./hooks/useAgent";
import { useSpeechInput, useSpeechOutput } from "./hooks/useVoice";
import { NEGOTIATION_STYLES, extractDraftMessage } from "./lib/agent";
import "./App.css";

// ─── Message Bubble ───────────────────────────────────────────────────────────

function MessageBubble({ message, onReplay, canReplay }) {
  const isUser = message.role === "user";
  const draft = !isUser ? extractDraftMessage(message.content) : "";
  const showReplay = !isUser && canReplay && draft.length > 0;

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
      {showReplay && (
        <button
          className="replay-btn"
          onClick={() => onReplay(draft)}
          title="Replay draft message"
        >
          🔊 Replay
        </button>
      )}
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

function InputArea({ value, onChange, onSend, isLoading, isFirstMessage }) {
  const textareaRef = useRef(null);

  const speech = useSpeechInput({
    onFinalTranscript: (txt) => {
      onChange((prev) => (prev ? `${prev} ${txt}` : txt));
    },
  });

  const handleSend = () => {
    if (!value.trim() || isLoading) return;
    if (speech.isListening) speech.stop();
    onSend(value);
    onChange("");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      handleSend();
    }
  };

  const toggleMic = () => {
    if (speech.isListening) speech.stop();
    else speech.start();
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
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        rows={3}
      />
      {speech.isListening && speech.interimTranscript && (
        <div className="interim-hint">{speech.interimTranscript}</div>
      )}
      {speech.error && <div className="voice-error">⚠️ {speech.error}</div>}
      <div className="input-footer">
        <div className="input-footer-left">
          {speech.isSupported && (
            <button
              className={`mic-btn ${speech.isListening ? "mic-btn-listening" : ""}`}
              onClick={toggleMic}
              title={speech.isListening ? "Stop listening" : "Start voice input"}
              type="button"
            >
              {speech.isListening ? "●" : "🎤"}
            </button>
          )}
          <span className="input-hint">
            {speech.isListening ? "Listening…" : "Ctrl+Enter to send"}
          </span>
        </div>
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
  const voiceOut = useSpeechOutput();
  const [inputValue, setInputValue] = useState("");
  const bottomRef = useRef(null);
  const lastSpokenIndexRef = useRef(-1);

  const isFirstMessage = messages.length === 0;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Auto-speak the Draft Message section of any new agent reply.
  useEffect(() => {
    if (isLoading) return;
    const lastIdx = messages.length - 1;
    if (lastIdx <= lastSpokenIndexRef.current) return;
    const last = messages[lastIdx];
    if (!last || last.role !== "assistant") {
      lastSpokenIndexRef.current = lastIdx;
      return;
    }
    const draft = extractDraftMessage(last.content);
    if (draft) voiceOut.speak(draft);
    lastSpokenIndexRef.current = lastIdx;
  }, [messages, isLoading, voiceOut]);

  const handleReset = () => {
    voiceOut.cancel();
    lastSpokenIndexRef.current = -1;
    reset();
    setInputValue("");
  };

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
          {voiceOut.isSupported && (
            <button
              className={`voice-toggle-btn ${voiceOut.isMuted ? "" : "voice-toggle-btn-on"}`}
              onClick={voiceOut.toggleMute}
              title={voiceOut.isMuted ? "Voice off — click to enable" : "Voice on — click to mute"}
              type="button"
            >
              {voiceOut.isMuted ? "🔇" : "🔊"}
            </button>
          )}
          {messages.length > 0 && (
            <button className="reset-btn" onClick={handleReset}>
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
              <MessageBubble
                key={i}
                message={msg}
                onReplay={voiceOut.speak}
                canReplay={voiceOut.isSupported}
              />
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
        <InputArea
          value={inputValue}
          onChange={setInputValue}
          onSend={sendMessage}
          isLoading={isLoading}
          isFirstMessage={isFirstMessage}
        />
      </footer>
    </div>
  );
}
