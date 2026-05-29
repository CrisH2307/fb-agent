// src/hooks/useServerStatus.js
// Polls the local fb-agent server every 30 seconds.
// Silently returns connected:false if the server is unreachable.

import { useState, useEffect } from "react";

const SERVER_URL = "http://localhost:3001";
const POLL_INTERVAL = 30_000;

export function useServerStatus() {
  const [connected, setConnected] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);

  const check = async () => {
    try {
      const res = await fetch(`${SERVER_URL}/status`, { signal: AbortSignal.timeout(4000) });
      if (!res.ok) throw new Error("non-ok");
      const data = await res.json();
      setConnected(true);
      setLoggedIn(!!data.loggedIn);
    } catch {
      setConnected(false);
      setLoggedIn(false);
    }
  };

  useEffect(() => {
    check();
    const id = setInterval(check, POLL_INTERVAL);
    return () => clearInterval(id);
  }, []);

  return { connected, loggedIn, recheck: check };
}
