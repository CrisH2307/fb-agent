// routes/search.js — GET /search?q=
// Searches Facebook Marketplace and returns up to 10 results.

import { Router } from "express";
import { getContext, randomDelay, saveSession } from "../browser.js";

const router = Router();

router.get("/", async (req, res) => {
  const { q } = req.query;
  if (!q || !q.trim()) {
    return res.status(400).json({ error: "q param is required" });
  }

  let page;
  try {
    const ctx = await getContext();
    page = await ctx.newPage();

    await randomDelay();
    const searchUrl = `https://www.facebook.com/marketplace/search/?query=${encodeURIComponent(q.trim())}`;
    await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 20000 });

    // Wait for listing cards to appear
    await page.waitForSelector("a[href*='/marketplace/item/']", {
      timeout: 10000,
    }).catch(() => {}); // Proceed even if selector times out

    await randomDelay();

    const results = await page.evaluate(() => {
      const cards = Array.from(
        document.querySelectorAll("a[href*='/marketplace/item/']")
      );

      return cards.slice(0, 10).map((card) => {
        const href = card.href;
        // Title is usually in a span with the listing name
        const titleEl =
          card.querySelector("span[style*='webkit-line-clamp']") ||
          card.querySelector("span:not(:empty)");
        const title = titleEl ? titleEl.innerText.trim() : "";

        // Price — look for $ sign text
        const spans = Array.from(card.querySelectorAll("span"));
        const priceEl = spans.find((s) => /\$[\d,]+/.test(s.innerText));
        const price = priceEl ? priceEl.innerText.trim() : "";

        // Location — often the second span-like text block after price
        const textNodes = spans
          .map((s) => s.innerText.trim())
          .filter((t) => t && !t.includes("$") && t !== title);
        const location = textNodes[0] || "";

        // Image
        const img = card.querySelector("img");
        const imageUrl = img ? img.src : "";

        return { title, price, location, url: href, imageUrl };
      }).filter((r) => r.url && r.title);
    });

    await saveSession();
    res.json({ results });
  } catch (err) {
    res.json({ results: [], error: err.message });
  } finally {
    if (page) await page.close().catch(() => {});
  }
});

export default router;
