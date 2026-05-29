// routes/login.js — POST /login
// Opens a visible browser window so the user can log in manually.
// Saves the session once login is detected, then closes the window.

import { Router } from "express";
import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { clearSession } from "../browser.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SESSION_PATH = path.join(__dirname, "..", "session", "fb-session.json");

const router = Router();

router.post("/", async (req, res) => {
  let browser;
  try {
    // Clear any existing stale session first
    await clearSession();

    browser = await chromium.launch({
      headless: false,
      args: ["--no-sandbox"],
    });

    const ctx = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 800 },
      locale: "en-US",
    });

    const page = await ctx.newPage();
    await page.goto("https://www.facebook.com/login", {
      waitUntil: "domcontentloaded",
    });

    // Poll until the URL leaves the login page (max 3 minutes)
    const TIMEOUT = 3 * 60 * 1000;
    const POLL = 2000;
    const deadline = Date.now() + TIMEOUT;
    let loggedIn = false;

    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, POLL));
      const url = page.url();
      if (!url.includes("/login") && !url.includes("checkpoint")) {
        loggedIn = true;
        break;
      }
    }

    if (!loggedIn) {
      await browser.close();
      return res.json({ success: false, message: "Login timeout — try again" });
    }

    // Save session
    const dir = path.dirname(SESSION_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    await ctx.storageState({ path: SESSION_PATH });
    await browser.close();

    res.json({ success: true, message: "Logged in and session saved" });
  } catch (err) {
    if (browser) await browser.close().catch(() => {});
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
