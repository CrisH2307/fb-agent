// observe.js
// Run from terminal: node observe.js [--target facebook|agent] [--save] [--diff]
// Takes a screenshot, sends it to Claude, prints observations + suggestions.
// Follow-up conversation mode lets you ask further questions about the same screenshot.

import fs from "fs";
import path from "path";
import os from "os";
import { execSync } from "child_process";
import { fileURLToPath } from "url";
import "dotenv/config";

// ─── Config ──────────────────────────────────────────────────────────────────

const API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = "claude-sonnet-4-6";
const SCREENSHOT_PATH = "/tmp/fb_agent_observe.png";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SESSIONS_DIR = path.join(__dirname, "sessions");

// Parse flags
const args = process.argv.slice(2);
const flagSave = args.includes("--save");
const flagDiff = args.includes("--diff");
const targetFlag = args.find((a) => a.startsWith("--target=") || a === "--target");
let target = "choose";
if (targetFlag) {
  target = targetFlag.includes("=") ? targetFlag.split("=")[1] : args[args.indexOf("--target") + 1];
}

// ─── System prompts ───────────────────────────────────────────────────────────

const SYSTEM_PROMPTS = {
  facebook: `
You are a sharp-eyed assistant observing a screenshot of a Facebook page.
The user is Vietnamese-Canadian in Toronto and uses Facebook for rentals, marketplace, jobs, and community groups.

Your job:
1. Describe exactly what you see on screen — post content, price, location, seller name, any visible messages
2. Extract key details: item/listing type, asking price, location, contact info if visible
3. Give your honest read: is this a good deal for Toronto/GTA? Any red flags?
4. Suggest the best next action the user should take
5. If you see a conversation/Messenger thread, summarize the current state and draft a reply

Be concise and structured. Use these headings exactly:
### 👁 What I See
### 📦 Key Details
### 💡 My Read
### ✉️ Suggested Message (if applicable)
### ➡️ Next Step
`.trim(),

  agent: `
You are observing a screenshot of the FB Agent chat interface — a React app that helps users handle Facebook negotiations.

Your job:
1. Describe the current state of the conversation
2. Identify what the agent last said and what the user last said
3. Point out anything that looks wrong, off, or could be improved in the agent's response
4. Suggest what the user should type next to move the negotiation forward

Be concise. Use these headings:
### 👁 What I See
### 💬 Conversation State
### 🔍 Observations
### ➡️ What to Do Next
`.trim(),
};

const DIFF_PROMPT = `
You are comparing two screenshots of the same Facebook surface taken at different times.
Image 1 is the EARLIER state. Image 2 is the CURRENT state.

Your job:
1. Describe what changed between the two screenshots (new messages, price updates, status changes, new posts, etc.)
2. Highlight anything important the user should react to (a reply from a seller, a price drop, a sold tag)
3. Suggest the next step

Be concise. Use these headings:
### 🔁 What Changed
### ⚠️ Worth Noting
### ➡️ Next Step
`.trim();

// ─── Screenshot ───────────────────────────────────────────────────────────────

function takeScreenshot(destPath = SCREENSHOT_PATH) {
  const platform = process.platform;

  try {
    if (platform === "darwin") {
      console.log("\n📸 Click on the window you want to capture...\n");
      execSync(`screencapture -i -o -t png "${destPath}"`, { stdio: "inherit" });
    } else if (platform === "linux") {
      try {
        console.log("\n📸 Select a window to capture (click on it)...\n");
        execSync(`scrot -s "${destPath}"`, { stdio: "inherit" });
      } catch {
        console.log("\n📸 Capturing screen with import...\n");
        execSync(`import "${destPath}"`, { stdio: "inherit" });
      }
    } else if (platform === "win32") {
      const psScript = `
Add-Type -AssemblyName System.Windows.Forms
$screen = [System.Windows.Forms.Screen]::PrimaryScreen
$bitmap = New-Object System.Drawing.Bitmap($screen.Bounds.Width, $screen.Bounds.Height)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.CopyFromScreen($screen.Bounds.Location, [System.Drawing.Point]::Empty, $screen.Bounds.Size)
$bitmap.Save("${destPath.replace(/\//g, "\\")}")
$graphics.Dispose()
$bitmap.Dispose()
`;
      execSync(`powershell -Command "${psScript}"`, { stdio: "inherit" });
    } else {
      throw new Error(`Unsupported platform: ${platform}`);
    }
  } catch (err) {
    if (err.message && err.message.includes("Unsupported")) throw err;
    // Otherwise the user may have cancelled — handled below via file check
  }

  if (!fs.existsSync(destPath)) {
    console.log("\n⚠️  No screenshot taken (cancelled or failed). Exiting.\n");
    process.exit(0);
  }

  console.log("✅ Screenshot captured.\n");
}

// ─── Resize for API ───────────────────────────────────────────────────────────

async function prepareImage(filePath = SCREENSHOT_PATH) {
  let imageBuffer;
  try {
    const { default: sharp } = await import("sharp");
    imageBuffer = await sharp(filePath)
      .resize({ width: 1568, withoutEnlargement: true })
      .png()
      .toBuffer();
  } catch {
    imageBuffer = fs.readFileSync(filePath);
  }
  return imageBuffer.toString("base64");
}

// ─── Claude API call ──────────────────────────────────────────────────────────

function imageBlock(base64) {
  return {
    type: "image",
    source: { type: "base64", media_type: "image/png", data: base64 },
  };
}

async function callClaude({ systemPrompt, messages }) {
  if (!API_KEY || API_KEY === "your_api_key_here") {
    throw new Error("Missing API key. Add ANTHROPIC_API_KEY to your .env file.");
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `API error ${response.status}`);
  }

  const data = await response.json();
  return data.content[0].text;
}

async function analyzeWithClaude(base64Image, systemPrompt) {
  return callClaude({
    systemPrompt,
    messages: [
      {
        role: "user",
        content: [
          imageBlock(base64Image),
          { type: "text", text: "Observe this screenshot and give me your full analysis." },
        ],
      },
    ],
  });
}

async function diffWithClaude(base64Before, base64After) {
  return callClaude({
    systemPrompt: DIFF_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: "Image 1 (earlier):" },
          imageBlock(base64Before),
          { type: "text", text: "Image 2 (current):" },
          imageBlock(base64After),
          { type: "text", text: "What changed between these two screenshots?" },
        ],
      },
    ],
  });
}

// ─── Interactive target selection ─────────────────────────────────────────────

async function chooseTarget() {
  const { createInterface } = await import("readline");
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    console.log("What do you want to observe?\n");
    console.log("  1. Facebook (marketplace, group post, messenger)");
    console.log("  2. FB Agent app (the React chat interface)\n");
    rl.question("Enter 1 or 2: ", (answer) => {
      rl.close();
      resolve(answer.trim() === "2" ? "agent" : "facebook");
    });
  });
}

async function askQuestion(promptText) {
  const { createInterface } = await import("readline");
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(promptText, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

// ─── Pretty print ─────────────────────────────────────────────────────────────

function printResult(text, label) {
  const divider = "─".repeat(60);
  const timestamp = new Date().toLocaleTimeString("en-CA", { hour12: false });
  console.log(`\n${divider}`);
  console.log(`◈  ${label}  ·  ${timestamp}`);
  console.log(`${divider}\n`);
  console.log(text);
  console.log(`\n${divider}\n`);
}

// ─── Clipboard ────────────────────────────────────────────────────────────────

function extractSuggestedMessage(text) {
  // Matches "### ✉️ Suggested Message" up to the next "### " heading or end.
  const match = text.match(
    /###\s*✉️\s*Suggested Message[^\n]*\n([\s\S]*?)(?=\n###\s|$)/
  );
  if (!match) return "";
  return match[1]
    .replace(/^\s*\(if applicable\)\s*$/gim, "")
    .trim();
}

function copyToClipboard(text) {
  if (!text) return false;
  const platform = process.platform;
  try {
    if (platform === "darwin") {
      execSync("pbcopy", { input: text });
    } else if (platform === "linux") {
      try {
        execSync("xclip -selection clipboard", { input: text });
      } catch {
        execSync("xsel --clipboard --input", { input: text });
      }
    } else if (platform === "win32") {
      execSync("clip", { input: text });
    } else {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

// ─── Sessions (save / diff) ───────────────────────────────────────────────────

function ensureSessionsDir() {
  if (!fs.existsSync(SESSIONS_DIR)) {
    fs.mkdirSync(SESSIONS_DIR, { recursive: true });
  }
}

function timestampSlug() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
}

function saveSession(targetName, pngBuffer, analysis) {
  ensureSessionsDir();
  const slug = `${timestampSlug()}_${targetName}`;
  const pngPath = path.join(SESSIONS_DIR, `${slug}.png`);
  const txtPath = path.join(SESSIONS_DIR, `${slug}.txt`);
  fs.writeFileSync(pngPath, pngBuffer);
  fs.writeFileSync(txtPath, analysis);
  return { pngPath, txtPath };
}

function findLastSession(targetName) {
  if (!fs.existsSync(SESSIONS_DIR)) return null;
  const files = fs
    .readdirSync(SESSIONS_DIR)
    .filter((f) => f.endsWith(`_${targetName}.png`))
    .sort();
  if (files.length === 0) return null;
  return path.join(SESSIONS_DIR, files[files.length - 1]);
}

// ─── Conversation follow-up loop ──────────────────────────────────────────────

async function conversationLoop({ systemPrompt, base64Image, firstAnalysis }) {
  const history = [
    {
      role: "user",
      content: [
        imageBlock(base64Image),
        { type: "text", text: "Observe this screenshot and give me your full analysis." },
      ],
    },
    { role: "assistant", content: firstAnalysis },
  ];

  while (true) {
    const followUp = (await askQuestion(
      "💬 Follow up? (type a question or press Enter to exit): "
    )).trim();
    if (!followUp) {
      console.log("\n👋 Done.\n");
      return;
    }

    history.push({ role: "user", content: followUp });
    const reply = await callClaude({ systemPrompt, messages: history });
    history.push({ role: "assistant", content: reply });
    printResult(reply, "Follow-up");
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function runDiff(resolvedTarget) {
  const previous = findLastSession(resolvedTarget);
  if (!previous) {
    console.error(
      `\n❌ No previous saved session for "${resolvedTarget}". Run with --save first.\n`
    );
    process.exit(1);
  }
  console.log(`\n📂 Comparing against: ${path.basename(previous)}\n`);

  takeScreenshot();
  console.log("🔍 Sending both images to Claude...\n");

  const [base64Before, base64After] = await Promise.all([
    prepareImage(previous),
    prepareImage(SCREENSHOT_PATH),
  ]);

  const result = await diffWithClaude(base64Before, base64After);
  printResult(result, `Diff · ${resolvedTarget}`);

  fs.unlinkSync(SCREENSHOT_PATH);
}

async function runObserve(resolvedTarget) {
  const systemPrompt = SYSTEM_PROMPTS[resolvedTarget];
  const label = resolvedTarget === "facebook" ? "Facebook Observer" : "FB Agent Observer";
  console.log(`🎯 Target: ${resolvedTarget === "facebook" ? "Facebook" : "FB Agent app"}\n`);

  takeScreenshot();
  console.log("🔍 Sending to Claude...\n");

  const base64Image = await prepareImage();
  const result = await analyzeWithClaude(base64Image, systemPrompt);
  printResult(result, label);

  // Auto-copy the suggested message (Facebook target produces one; agent target usually doesn't)
  const suggested = extractSuggestedMessage(result);
  if (suggested) {
    if (copyToClipboard(suggested)) {
      console.log("✅ Draft message copied to clipboard\n");
    }
  }

  // Optionally persist the session before deleting the temp file
  if (flagSave) {
    const pngBuffer = fs.readFileSync(SCREENSHOT_PATH);
    const { pngPath, txtPath } = saveSession(resolvedTarget, pngBuffer, result);
    console.log(`💾 Saved session:\n   ${pngPath}\n   ${txtPath}\n`);
  }

  // Conversation follow-up — uses base64 already in memory, no new screenshot
  await conversationLoop({ systemPrompt, base64Image, firstAnalysis: result });

  if (fs.existsSync(SCREENSHOT_PATH)) fs.unlinkSync(SCREENSHOT_PATH);
}

async function main() {
  console.log("\n◈  FB Agent Observer\n");

  let resolvedTarget = target;
  if (resolvedTarget === "choose") {
    resolvedTarget = await chooseTarget();
  }
  if (!["facebook", "agent"].includes(resolvedTarget)) {
    console.error(`Unknown target: "${resolvedTarget}". Use "facebook" or "agent".`);
    process.exit(1);
  }

  if (flagDiff) {
    await runDiff(resolvedTarget);
  } else {
    await runObserve(resolvedTarget);
  }
}

main().catch((err) => {
  console.error(`\n❌ Error: ${err.message}\n`);
  process.exit(1);
});
