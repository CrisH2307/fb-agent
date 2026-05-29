// logger.js
// Rate limiting + persistent activity/send logging.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOGS_DIR = path.join(__dirname, "logs");
const SENT_PATH = path.join(LOGS_DIR, "sent.json");
const ACTIVITY_PATH = path.join(LOGS_DIR, "activity.json");

// In-memory per-thread send timestamps (reset on server restart)
const threadSendTimes = new Map();

function ensureLogsDir() {
  if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR, { recursive: true });
}

function readJson(filePath) {
  try {
    if (!fs.existsSync(filePath)) return [];
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return [];
  }
}

function appendLog(filePath, record) {
  ensureLogsDir();
  const records = readJson(filePath);
  records.push(record);
  fs.writeFileSync(filePath, JSON.stringify(records, null, 2));
}

function readSentToday() {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const records = readJson(SENT_PATH);
  return records.filter((r) => r.timestamp && r.timestamp.startsWith(today)).length;
}

export function canSend(threadUrl) {
  const dailyLimit = parseInt(process.env.DAILY_SEND_LIMIT || "20", 10);
  const now = Date.now();
  const windowMs = 10 * 60 * 1000;

  // Per-thread: max 3 sends in last 10 minutes
  const recent = (threadSendTimes.get(threadUrl) || []).filter(
    (t) => now - t < windowMs
  );
  if (recent.length >= 3) {
    return {
      allowed: false,
      reason: "Rate limit: max 3 messages per thread per 10 minutes",
    };
  }

  // Daily cap across all threads
  const todayCount = readSentToday();
  if (todayCount >= dailyLimit) {
    return {
      allowed: false,
      reason: `Daily limit reached (${dailyLimit} messages/day)`,
    };
  }

  return { allowed: true };
}

export function recordSend(threadUrl, message, recipient = "") {
  const now = Date.now();
  const times = threadSendTimes.get(threadUrl) || [];
  times.push(now);
  threadSendTimes.set(threadUrl, times);

  appendLog(SENT_PATH, {
    threadUrl,
    message,
    recipient,
    timestamp: new Date(now).toISOString(),
  });
}

export function logActivity(type, detail = {}) {
  appendLog(ACTIVITY_PATH, {
    type,
    detail,
    timestamp: new Date().toISOString(),
  });
}
