// src/hooks/useAgent.js
// Manages conversation state and agent calls.

import { useState, useCallback } from "react";
import { callAgent } from "../lib/agent";

export function useAgent() {
  const [messages, setMessages] = useState([]); // full conversation history
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [negotiationStyle, setNegotiationStyle] = useState("polite");

  /**
   * Send a message to the agent.
   * input: string — the user's text (pasted post or follow-up reply)
   */
  const sendMessage = useCallback(
    async (input) => {
      if (!input.trim()) return;

      const newMessages = [...messages, { role: "user", content: input.trim() }];
      setMessages(newMessages);
      setIsLoading(true);
      setError(null);

      try {
        const reply = await callAgent(newMessages, negotiationStyle);
        setMessages([...newMessages, { role: "assistant", content: reply }]);
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    },
    [messages, negotiationStyle]
  );

  const reset = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return {
    messages,
    isLoading,
    error,
    negotiationStyle,
    setNegotiationStyle,
    sendMessage,
    reset,
  };
}
