// routes/session.js — GET /session/clear
import { Router } from "express";
import { clearSession } from "../browser.js";

const router = Router();

router.get("/clear", async (req, res) => {
  try {
    await clearSession();
    res.json({ success: true, message: "Session cleared — re-login required" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
