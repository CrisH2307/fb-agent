// src/hooks/useVoice.js
// Web Speech API wrappers. No external dependencies.

import { useCallback, useEffect, useRef, useState } from "react";

const MUTE_KEY = "fb-agent.voice.muted";

// ─── Speech Input (STT) ───────────────────────────────────────────────────────

export function useSpeechInput({ onFinalTranscript } = {}) {
  const SpeechRecognition =
    typeof window !== "undefined" &&
    (window.SpeechRecognition || window.webkitSpeechRecognition);
  const isSupported = Boolean(SpeechRecognition);

  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [error, setError] = useState(null);

  const recognitionRef = useRef(null);
  const onFinalRef = useRef(onFinalTranscript);
  useEffect(() => {
    onFinalRef.current = onFinalTranscript;
  }, [onFinalTranscript]);

  const stop = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore — already stopped
      }
    }
  }, []);

  const start = useCallback(() => {
    if (!isSupported) return;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        // ignore
      }
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      setError(null);
      setInterimTranscript("");
      setIsListening(true);
    };

    recognition.onresult = (event) => {
      let interim = "";
      let final = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          final += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }
      if (interim) setInterimTranscript(interim);
      if (final && onFinalRef.current) {
        onFinalRef.current(final.trim());
      }
    };

    recognition.onerror = (event) => {
      if (event.error === "no-speech" || event.error === "aborted") {
        // benign — just stop quietly
        return;
      }
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setError("Microphone permission denied");
      } else {
        setError(event.error || "Voice recognition failed");
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      setInterimTranscript("");
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch (e) {
      setError(e.message || "Could not start microphone");
      setIsListening(false);
    }
  }, [SpeechRecognition, isSupported]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  return { isSupported, isListening, interimTranscript, error, start, stop };
}

// ─── Speech Output (TTS) ──────────────────────────────────────────────────────

export function useSpeechOutput() {
  const isSupported =
    typeof window !== "undefined" && "speechSynthesis" in window;

  const [isMuted, setIsMuted] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(MUTE_KEY) === "1";
  });
  const [isSpeaking, setIsSpeaking] = useState(false);

  const voiceRef = useRef(null);
  const isMutedRef = useRef(isMuted);
  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  // Pick an English voice once available (Chrome loads asynchronously).
  useEffect(() => {
    if (!isSupported) return;
    const pickVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      const english = voices.find((v) => v.lang && v.lang.toLowerCase().startsWith("en"));
      if (english) voiceRef.current = english;
    };
    pickVoice();
    window.speechSynthesis.addEventListener("voiceschanged", pickVoice);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", pickVoice);
    };
  }, [isSupported]);

  const cancel = useCallback(() => {
    if (!isSupported) return;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, [isSupported]);

  const speak = useCallback(
    (text) => {
      if (!isSupported || isMutedRef.current) return;
      const trimmed = (text || "").trim();
      if (!trimmed) return;

      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(trimmed);
      utter.rate = 0.95;
      utter.pitch = 1.0;
      utter.lang = "en-US";
      if (voiceRef.current) utter.voice = voiceRef.current;
      utter.onstart = () => setIsSpeaking(true);
      utter.onend = () => setIsSpeaking(false);
      utter.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utter);
    },
    [isSupported]
  );

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        window.localStorage.setItem(MUTE_KEY, next ? "1" : "0");
      }
      if (next && isSupported) {
        window.speechSynthesis.cancel();
        setIsSpeaking(false);
      }
      return next;
    });
  }, [isSupported]);

  return { isSupported, isMuted, isSpeaking, speak, cancel, toggleMute };
}
