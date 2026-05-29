// browser.js
// Singleton Playwright browser context with persistent Facebook session.

import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SESSION_PATH = path.join(__dirname, "session", "fb-session.json");

const USER_AGENT =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

let browserInstance = null;
let contextInstance = null;

export const delay = (ms) => new Promise((r) => setTimeout(r, ms));
export const randomDelay = () => delay(800 + Math.random() * 1700);

export async function getContext() {
  if (contextInstance) return contextInstance;

  browserInstance = await chromium.launch({ headless: true });

  const contextOptions = {
    userAgent: USER_AGENT,
    viewport: { width: 390, height: 844 },
    locale: "en-US",
  };

  if (fs.existsSync(SESSION_PATH)) {
    try {
      contextOptions.storageState = SESSION_PATH;
    } catch {
      // Corrupted session file — ignore and start fresh
    }
  }

  contextInstance = await browserInstance.newContext(contextOptions);
  return contextInstance;
}

export async function saveSession() {
  if (!contextInstance) return;
  const dir = path.dirname(SESSION_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  await contextInstance.storageState({ path: SESSION_PATH });
}

export async function clearSession() {
  if (fs.existsSync(SESSION_PATH)) {
    fs.unlinkSync(SESSION_PATH);
  }
  // Tear down the existing context so the next getContext() starts fresh
  if (contextInstance) {
    try { await contextInstance.close(); } catch { /* ignore */ }
    contextInstance = null;
  }
  if (browserInstance) {
    try { await browserInstance.close(); } catch { /* ignore */ }
    browserInstance = null;
  }
}
