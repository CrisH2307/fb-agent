// routes/post.js — GET /post?url=
// Fetches full post content from a Facebook URL.

import { Router } from "express";
import { getContext, randomDelay, saveSession } from "../browser.js";

const router = Router();

router.get("/", async (req, res) => {
  const { url } = req.query;
  if (!url) {
    return res.status(400).json({ error: "url param is required" });
  }
  if (!url.startsWith("https://www.facebook.com")) {
    return res.status(400).json({ error: "url must be a facebook.com URL" });
  }

  let page;
  try {
    const ctx = await getContext();
    page = await ctx.newPage();

    await randomDelay();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });

    // Extra wait for dynamic content
    await page.waitForTimeout(2000);
    await randomDelay();

    const data = await page.evaluate(() => {
      // Post body text — try several selector patterns Facebook uses
      const bodySelectors = [
        "[data-ad-preview='message']",
        "[data-testid='post_message']",
        "div[dir='auto'][style*='text-align']",
        "div[data-ad-comet-preview='message']",
      ];

      let text = "";
      for (const sel of bodySelectors) {
        const el = document.querySelector(sel);
        if (el && el.innerText.trim().length > 20) {
          text = el.innerText.trim();
          break;
        }
      }

      // Fallback: find the longest dir=auto div (usually the post body)
      if (!text) {
        const candidates = Array.from(document.querySelectorAll("div[dir='auto']"))
          .map((el) => el.innerText.trim())
          .filter((t) => t.length > 30);
        candidates.sort((a, b) => b.length - a.length);
        text = candidates[0] || "";
      }

      // Price — look for $ pattern in text or dedicated elements
      const priceMatch = text.match(/\$[\d,]+(\.\d{2})?/);
      const price = priceMatch ? priceMatch[0] : "";

      // Location — look for common location indicators
      const locationMatch = text.match(
        /(Toronto|GTA|Mississauga|Brampton|Scarborough|North York|Etobicoke|Vaughan|Markham|Richmond Hill|Oakville|Burlington)[^,\n]*/i
      );
      const location = locationMatch ? locationMatch[0].trim() : "";

      // Poster name — meta or h1/h2 near the post header
      const nameEl =
        document.querySelector("h1") ||
        document.querySelector("[data-testid='story-subtitle'] a") ||
        document.querySelector("strong a");
      const posterName = nameEl ? nameEl.innerText.trim() : "";

      // Images in the post
      const images = Array.from(document.querySelectorAll("img"))
        .map((img) => img.src)
        .filter(
          (src) =>
            src &&
            !src.includes("emoji") &&
            !src.includes("static") &&
            src.startsWith("http") &&
            (src.includes("scontent") || src.includes("fbcdn"))
        )
        .slice(0, 5);

      return { text, price, location, posterName, images };
    });

    await saveSession();
    res.json({ ...data, url });
  } catch (err) {
    res.json({ text: "", url, error: err.message });
  } finally {
    if (page) await page.close().catch(() => {});
  }
});

export default router;
