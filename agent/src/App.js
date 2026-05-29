// src/App.js

import React, { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { useAgent } from "./hooks/useAgent";
import { useSpeechInput, useSpeechOutput } from "./hooks/useVoice";
import { useServerStatus } from "./hooks/useServerStatus";
import { NEGOTIATION_STYLES, extractDraftMessage } from "./lib/agent";
import SearchPanel from "./components/SearchPanel";
import SendConfirm from "./components/SendConfirm";
import InboxView from "./components/InboxView";
import "./App.css";

const SERVER_URL = "http://localhost:3001";

// ─── Message Bubble ───────────────────────────────────────────────────────────

function MessageBubble({ message, onReplay, canReplay, onSendViaAgent }) {
  const isUser = message.role === "user";
  const draft = !isUser ? extractDraftMessage(message.content) : "";
  const showReplay = !isUser && canReplay && draft.length > 0;
  const showSendAgent = !isUser && !!onSendViaAgent && draft.length > 0;

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
      {(showReplay || showSendAgent) && (
        <div className="bubble-actions">
          {showReplay && (
            <button
              className="replay-btn"
              onClick={() => onReplay(draft)}
              title="Replay draft message"
            >
              🔊 Replay
            </button>
          )}
          {showSendAgent && (
            <button
              className="send-agent-btn"
              onClick={() => onSendViaAgent(draft)}
              title="Send this message via Facebook Messenger"
            >
              ✉️ Send via Agent
            </button>
          )}
        </div>
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

// ─── Server Badge ─────────────────────────────────────────────────────────────

function ServerBadge({ connected, loggedIn, recheck }) {
  const [signingIn, setSigningIn] = useState(false);

  const handleSignIn = async () => {
    setSigningIn(true);
    try {
      await fetch(`${SERVER_URL}/login`, { method: "POST" });
      setTimeout(recheck, 5000);
    } catch {
      // ignore
    } finally {
      setSigningIn(false);
    }
  };

  if (!connected) return null;

  if (loggedIn) {
    return (
      <div className="server-badge">
        <span className="server-dot server-dot-green" />
        <span className="server-badge-text">FB Connected</span>
      </div>
    );
  }

  return (
    <button
      className="server-badge server-badge-login"
      onClick={handleSignIn}
      disabled={signingIn}
      type="button"
      title="Click to open Facebook login window"
    >
      <span className="server-dot server-dot-amber" />
      <span className="server-badge-text">{signingIn ? "Opening…" : "Sign in to FB"}</span>
    </button>
  );
}

// ─── Input Area ───────────────────────────────────────────────────────────────

function InputArea({ value, onChange, onSend, isLoading, isFirstMessage, serverConnected }) {
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

  const placeholder = isFirstMessage
    ? serverConnected
      ? "Paste a post or search above…"
      : "Paste a Facebook post here (rental, marketplace item, job posting...)"
    : "Reply to the agent — e.g. 'too high, offer $15' or 'ask when it's available'";

  return (
    <div className="input-area">
      <textarea
        ref={textareaRef}
        className="input-textarea"
        placeholder={placeholder}
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
  const { connected, loggedIn, recheck } = useServerStatus();

  const [inputValue, setInputValue] = useState("");
  const [currentPostUrl, setCurrentPostUrl] = useState(null);
  const [currentPosterName, setCurrentPosterName] = useState("");
  const [confirmSend, setConfirmSend] = useState(null); // { message, threadUrl, recipientName }
  const [showInbox, setShowInbox] = useState(false);
  const [findingThread, setFindingThread] = useState(false);

  const bottomRef = useRef(null);
  const lastSpokenIndexRef = useRef(-1);

  const isFirstMessage = messages.length === 0;
  const showSearch = connected && loggedIn && isFirstMessage;
  const canSendViaAgent = connected && loggedIn && !!currentPostUrl;

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
    setCurrentPostUrl(null);
    setCurrentPosterName("");
    setConfirmSend(null);
  };

  const handleSendViaAgent = async (draftMessage) => {
    if (!currentPostUrl) return;
    setFindingThread(true);
    try {
      const res = await fetch(
        `${SERVER_URL}/message/thread?url=${encodeURIComponent(currentPostUrl)}`,
        { signal: AbortSignal.timeout(25000) }
      );
      const data = await res.json();
      setConfirmSend({
        message: draftMessage,
        threadUrl: data.threadUrl || null,
        recipientName: data.recipientName || currentPosterName,
      });
    } catch {
      setConfirmSend({
        message: draftMessage,
        threadUrl: null,
        recipientName: currentPosterName,
      });
    } finally {
      setFindingThread(false);
    }
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
          <ServerBadge connected={connected} loggedIn={loggedIn} recheck={recheck} />
          {connected && loggedIn && (
            <button
              className="inbox-btn"
              onClick={() => setShowInbox(true)}
              type="button"
            >
              Inbox
            </button>
          )}
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
            <h2 className="empty-title">
              {showSearch ? "Search or paste a Facebook post" : "Paste a Facebook post"}
            </h2>
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
                onSendViaAgent={canSendViaAgent && !findingThread ? handleSendViaAgent : null}
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
            {findingThread && (
              <div className="finding-thread-hint">Finding Messenger thread…</div>
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

      {/* Send confirmation card (above footer) */}
      {confirmSend && (
        <SendConfirm
          message={confirmSend.message}
          recipientName={confirmSend.recipientName}
          threadUrl={confirmSend.threadUrl}
          onConfirm={() => setConfirmSend(null)}
          onEdit={(msg) => { setInputValue(msg); setConfirmSend(null); }}
          onCancel={() => setConfirmSend(null)}
        />
      )}

      {/* Input */}
      <footer className="footer">
        {showSearch && (
          <SearchPanel
            onLoad={(text, url, posterName) => {
              setInputValue(text);
              setCurrentPostUrl(url || null);
              setCurrentPosterName(posterName || "");
            }}
          />
        )}
        <InputArea
          value={inputValue}
          onChange={setInputValue}
          onSend={sendMessage}
          isLoading={isLoading}
          isFirstMessage={isFirstMessage}
          serverConnected={connected && loggedIn}
        />
      </footer>

      {/* Inbox modal */}
      {showInbox && <InboxView onClose={() => setShowInbox(false)} />}
    </div>
  );
}
