// src/components/SendConfirm.js
// Confirmation overlay shown before sending a message via Playwright.

import React, { useState } from "react";

const SERVER_URL = "http://localhost:3001";

export default function SendConfirm({
  message,
  recipientName,
  threadUrl,
  onConfirm,
  onEdit,
  onCancel,
}) {
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null); // { success, timestamp, reason, error }

  const handleSend = async () => {
    setSending(true);
    try {
      const res = await fetch(`${SERVER_URL}/message/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadUrl, message, recipient: recipientName }),
        signal: AbortSignal.timeout(30000),
      });
      const data = await res.json();
      setResult(data);
      if (data.success) {
        setTimeout(onConfirm, 2000); // auto-close after success display
      }
    } catch (err) {
      setResult({ success: false, error: "Request failed — is the server running?" });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="send-confirm-overlay" onClick={onCancel}>
      <div className="send-confirm-card" onClick={(e) => e.stopPropagation()}>
        <div className="send-confirm-header">
          <span className="send-confirm-title">Send via Agent</span>
          <button className="send-confirm-close" onClick={onCancel} type="button">
            ✕
          </button>
        </div>

        {recipientName && (
          <div className="send-confirm-recipient">
            To: <strong>{recipientName}</strong>
          </div>
        )}

        <div className="send-confirm-preview">{message}</div>

        {!result && (
          <div className="send-confirm-actions">
            <button
              className="send-confirm-btn send-confirm-btn-cancel"
              onClick={onCancel}
              disabled={sending}
              type="button"
            >
              Cancel
            </button>
            <button
              className="send-confirm-btn send-confirm-btn-edit"
              onClick={() => onEdit(message)}
              disabled={sending}
              type="button"
            >
              Edit
            </button>
            <button
              className="send-confirm-btn send-confirm-btn-send"
              onClick={handleSend}
              disabled={sending}
              type="button"
            >
              {sending ? "Sending…" : "Send ✉️"}
            </button>
          </div>
        )}

        {result && result.success && (
          <div className="send-confirm-success">
            ✅ Sent at {new Date(result.timestamp).toLocaleTimeString("en-CA", { hour12: false })}
          </div>
        )}

        {result && !result.success && (
          <div className="send-confirm-error">
            ⚠️ {result.reason || result.error || "Send failed"}
            <div className="send-confirm-actions" style={{ marginTop: 10 }}>
              <button
                className="send-confirm-btn send-confirm-btn-cancel"
                onClick={onCancel}
                type="button"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
