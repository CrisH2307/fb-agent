// server.js
// FB Agent local server — headless Facebook reader + Messenger via Playwright.
// Run: npm start (port 3001)
// ⚠️  Use a SECONDARY Facebook account. Never your main account.

import express from "express";
import cors from "cors";
import "dotenv/config";

import statusRouter from "./routes/status.js";
import loginRouter from "./routes/login.js";
import searchRouter from "./routes/search.js";
import postRouter from "./routes/post.js";
import sessionRouter from "./routes/session.js";
import messageRouter from "./routes/message.js";

const app = express();

app.use(cors({ origin: "http://localhost:3000" }));
app.use(express.json());

app.use("/status", statusRouter);
app.use("/login", loginRouter);
app.use("/search", searchRouter);
app.use("/post", postRouter);
app.use("/session", sessionRouter);
app.use("/message", messageRouter);

// Health probe (also used by React app's useServerStatus fallback)
app.get("/", (req, res) => res.json({ ok: true, service: "fb-agent-server" }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`\n◈  FB Agent Server  ·  http://localhost:${PORT}\n`);
  console.log("Endpoints:");
  console.log("  GET  /status                  — check login state");
  console.log("  POST /login                   — open browser for manual login");
  console.log("  GET  /search?q=               — search Facebook Marketplace");
  console.log("  GET  /post?url=               — fetch full post content");
  console.log("  GET  /session/clear           — wipe saved session");
  console.log("  GET  /message/thread?url=     — find Messenger thread for a post");
  console.log("  POST /message/send            — send a message (rate-limited)");
  console.log("  GET  /message/inbox           — list latest 10 Messenger threads");
  console.log("  GET  /message/thread/read?url= — fetch full thread history\n");
  console.log(`Daily send limit: ${process.env.DAILY_SEND_LIMIT || 20} messages\n`);
});
