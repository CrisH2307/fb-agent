// routes/status.js — GET /status
import { Router } from "express";
import { getContext, randomDelay } from "../browser.js";

const router = Router();

router.get("/", async (req, res) => {
  let page;
  try {
    const ctx = await getContext();
    page = await ctx.newPage();
    await randomDelay();
    await page.goto("https://www.facebook.com", {
      waitUntil: "domcontentloaded",
      timeout: 15000,
    });

    const url = page.url();
    const loggedIn =
      !url.includes("/login") &&
      !url.includes("checkpoint") &&
      !url.includes("recover");

    res.json({ connected: true, loggedIn });
  } catch (err) {
    res.json({ connected: true, loggedIn: false, error: err.message });
  } finally {
    if (page) await page.close().catch(() => {});
  }
});

export default router;
