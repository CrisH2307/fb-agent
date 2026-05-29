// routes/message.js
// All Messenger endpoints: thread lookup, send, inbox, thread history.
// ⚠️  Use a SECONDARY Facebook account only.

import { Router } from "express";
import { getContext, randomDelay, saveSession, delay } from "../browser.js";
import { canSend, recordSend, logActivity } from "../logger.js";

const router = Router();

// ─── Helper: human-like typing ────────────────────────────────────────────────

async function typeSlowly(page, text) {
  for (const char of text) {
    await page.keyboard.type(char);
    await delay(40 + Math.random() * 80); // 40–120ms per char
  }
  await delay(500 + Math.random() * 1000); // pause before send
}

// ─── GET /message/thread?url= ─────────────────────────────────────────────────
// Given a post URL, find the Messenger thread and return its URL.

router.get("/thread", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "url param is required" });
  if (!url.startsWith("https://www.facebook.com")) {
    return res.status(400).json({ error: "url must be a facebook.com URL" });
  }

  let page;
  try {
    const ctx = await getContext();
    page = await ctx.newPage();

    await randomDelay();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForTimeout(2000);

    // Look for a Message / Send Message button or link
    const messageButtonSelectors = [
      "a[href*='messenger.com/t/']",
      "a[href*='m.me/']",
      "[aria-label*='Message']",
      "[aria-label*='Send message']",
      "[data-testid*='message_button']",
      "div[role='button']:has-text('Message')",
    ];

    let threadUrl = null;
    let recipientName = "";
    let hasExistingConversation = false;

    for (const sel of messageButtonSelectors) {
      try {
        const el = await page.$(sel);
        if (!el) continue;

        // Some buttons navigate directly; others open a dialog
        const href = await el.getAttribute("href");
        if (href && (href.includes("messenger.com") || href.includes("m.me"))) {
          threadUrl = href.startsWith("http") ? href : `https://www.facebook.com${href}`;
          break;
        }

        // Click and wait for navigation to Messenger
        const [response] = await Promise.all([
          page.waitForNavigation({ timeout: 8000 }).catch(() => null),
          el.click(),
        ]);

        const currentUrl = page.url();
        if (
          currentUrl.includes("messenger.com/t/") ||
          currentUrl.includes("m.me/") ||
          currentUrl.includes("/messages/t/")
        ) {
          threadUrl = currentUrl;
          hasExistingConversation = !currentUrl.includes("new_thread");
          break;
        }
      } catch {
        continue;
      }
    }

    // Try to get recipient name from the page
    try {
      const h1 = await page.$("h1");
      if (h1) recipientName = (await h1.innerText()).trim();
    } catch { /* ignore */ }

    await saveSession();
    res.json({ threadUrl, recipientName, hasExistingConversation });
  } catch (err) {
    res.json({ threadUrl: null, recipientName: "", error: err.message });
  } finally {
    if (page) await page.close().catch(() => {});
  }
});

// ─── POST /message/send ───────────────────────────────────────────────────────
// Type and send a message to a Messenger thread.

router.post("/send", async (req, res) => {
  const { threadUrl, message, recipient = "" } = req.body || {};
  if (!threadUrl || !message) {
    return res.status(400).json({ error: "threadUrl and message are required" });
  }
  const validDomain =
    threadUrl.includes("messenger.com") ||
    threadUrl.includes("facebook.com/messages") ||
    threadUrl.includes("m.me");
  if (!validDomain) {
    return res.status(400).json({ error: "threadUrl must be a Messenger URL" });
  }

  const check = canSend(threadUrl);
  if (!check.allowed) {
    return res.json({ success: false, reason: check.reason });
  }

  logActivity("send_attempt", { threadUrl, messageLength: message.length, recipient });

  let page;
  try {
    const ctx = await getContext();
    page = await ctx.newPage();

    await randomDelay();
    await page.goto(threadUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForTimeout(2000);

    // Find the message input box
    const inputSelectors = [
      "[aria-label='Message']",
      "[data-testid='mwthreadlist-input']",
      "div[contenteditable='true'][role='textbox']",
      "textarea[placeholder*='message']",
    ];

    let inputEl = null;
    for (const sel of inputSelectors) {
      inputEl = await page.$(sel);
      if (inputEl) break;
    }

    if (!inputEl) {
      throw new Error("Could not find message input box");
    }

    await inputEl.click();
    await delay(300);
    await typeSlowly(page, message);

    // Try pressing Enter to send
    await page.keyboard.press("Enter");
    await delay(1000);

    // Verify send — check last visible message matches what we sent
    const lastMsg = await page.evaluate(() => {
      const messages = document.querySelectorAll(
        "[data-testid='message-container'] div[dir='auto'], div[class*='message'] div[dir='auto']"
      );
      const last = messages[messages.length - 1];
      return last ? last.innerText.trim() : "";
    });

    const verified = lastMsg.includes(message.slice(0, 30));

    recordSend(threadUrl, message, recipient);
    logActivity("send_success", { threadUrl, recipient, verified });
    await saveSession();

    res.json({ success: true, timestamp: new Date().toISOString(), verified });
  } catch (err) {
    logActivity("send_error", { threadUrl, error: err.message });
    res.json({ success: false, error: err.message });
  } finally {
    if (page) await page.close().catch(() => {});
  }
});

// ─── GET /message/inbox ───────────────────────────────────────────────────────
// Return latest 10 Messenger threads.

router.get("/inbox", async (req, res) => {
  let page;
  try {
    const ctx = await getContext();
    page = await ctx.newPage();

    await randomDelay();
    await page.goto("https://www.facebook.com/messages/t/", {
      waitUntil: "domcontentloaded",
      timeout: 20000,
    });
    await page.waitForTimeout(2500);

    await randomDelay();

    const threads = await page.evaluate(() => {
      const links = Array.from(
        document.querySelectorAll("a[href*='/messages/t/']")
      );

      return links.slice(0, 10).map((a) => {
        const href = a.href;

        // Name — look for a bold span or heading inside the thread item
        const nameEl =
          a.querySelector("span[dir='auto']") ||
          a.querySelector("span:not(:empty)");
        const name = nameEl ? nameEl.innerText.trim() : "";

        // Last message preview — second text node or subtitle span
        const spans = Array.from(a.querySelectorAll("span")).map((s) =>
          s.innerText.trim()
        );
        const lastMessage = spans.find((t) => t && t !== name) || "";

        // Unread indicator — look for a badge/dot element
        const unreadBadge = a.querySelector(
          "[data-testid='unread_count'], span[aria-label*='unread']"
        );
        const unread = unreadBadge ? parseInt(unreadBadge.innerText) || 1 : 0;

        return { name, threadUrl: href, lastMessage, unread, timestamp: "" };
      }).filter((t) => t.threadUrl && t.name);
    });

    await saveSession();
    res.json({ threads });
  } catch (err) {
    res.json({ threads: [], error: err.message });
  } finally {
    if (page) await page.close().catch(() => {});
  }
});

// ─── GET /message/thread/read?url= ───────────────────────────────────────────
// Return full message history of a thread.

router.get("/thread/read", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "url param is required" });

  let page;
  try {
    const ctx = await getContext();
    page = await ctx.newPage();

    await randomDelay();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForTimeout(3000);

    const data = await page.evaluate(() => {
      // Recipient name
      const h1 = document.querySelector("h1, [aria-label='Conversation title']");
      const recipientName = h1 ? h1.innerText.trim() : "";

      // Messages — try multiple selector strategies
      const messageContainers = Array.from(
        document.querySelectorAll(
          "[data-testid='message-container'], div[class*='message'][dir='auto'], div[role='row']"
        )
      );

      const messages = messageContainers
        .map((el) => {
          const textEl = el.querySelector("div[dir='auto'], span[dir='auto']");
          const text = textEl ? textEl.innerText.trim() : "";
          if (!text) return null;

          // Outgoing messages typically aligned right or have a specific class
          const isMe =
            el.classList.toString().includes("outgoing") ||
            window.getComputedStyle(el).alignSelf === "flex-end" ||
            el.getAttribute("data-sender-is-viewer") === "true";

          const timeEl = el.querySelector("abbr, time, [aria-label*='ago'], [aria-label*='at']");
          const timestamp = timeEl ? (timeEl.getAttribute("title") || timeEl.innerText.trim()) : "";

          return { sender: isMe ? "me" : recipientName || "them", text, timestamp, isMe };
        })
        .filter(Boolean);

      return { messages, recipientName };
    });

    await saveSession();
    res.json(data);
  } catch (err) {
    res.json({ messages: [], recipientName: "", error: err.message });
  } finally {
    if (page) await page.close().catch(() => {});
  }
});

export default router;
