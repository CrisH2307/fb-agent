// observe.js
// Run from terminal: node observe.js [--target facebook|agent]
// Takes a screenshot, sends it to Claude, prints observations + suggestions.

import fs from "fs";
import path from "path";
import { execSync, exec } from "child_process";
import { promisify } from "util";
import { createRequire } from "module";
import "dotenv/config";

const execAsync = promisify(exec);

// ─── Config ──────────────────────────────────────────────────────────────────

const API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = "claude-sonnet-4-6";
const SCREENSHOT_PATH = "/tmp/fb_agent_observe.png";

// Parse --target flag
const args = process.argv.slice(2);
const targetFlag = args.find((a) => a.startsWith("--target=") || a === "--target");
let target = "choose"; // default: ask interactively
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

// ─── Screenshot ───────────────────────────────────────────────────────────────

async function takeScreenshot() {
  const platform = process.platform;

  try {
    if (platform === "darwin") {
      // macOS — screencapture with interactive window selection
      console.log("\n📸 Click on the window you want to capture...\n");
      execSync(`screencapture -i -o -t png "${SCREENSHOT_PATH}"`, { stdio: "inherit" });
    } else if (platform === "linux") {
      // Linux — try scrot first, fallback to import (ImageMagick)
      try {
        console.log("\n📸 Select a window to capture (click on it)...\n");
        execSync(`scrot -s "${SCREENSHOT_PATH}"`, { stdio: "inherit" });
      } catch {
        console.log("\n📸 Capturing screen with import...\n");
        execSync(`import "${SCREENSHOT_PATH}"`, { stdio: "inherit" });
      }
    } else if (platform === "win32") {
      // Windows — use PowerShell
      const psScript = `
Add-Type -AssemblyName System.Windows.Forms
$screen = [System.Windows.Forms.Screen]::PrimaryScreen
$bitmap = New-Object System.Drawing.Bitmap($screen.Bounds.Width, $screen.Bounds.Height)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.CopyFromScreen($screen.Bounds.Location, [System.Drawing.Point]::Empty, $screen.Bounds.Size)
$bitmap.Save("${SCREENSHOT_PATH.replace(/\//g, "\\")}")
$graphics.Dispose()
$bitmap.Dispose()
`;
      execSync(`powershell -Command "${psScript}"`, { stdio: "inherit" });
    } else {
      throw new Error(`Unsupported platform: ${platform}`);
    }
  } catch (err) {
    if (err.message.includes("Unsupported")) throw err;
    // User may have cancelled the screenshot — check if file exists
  }

  if (!fs.existsSync(SCREENSHOT_PATH)) {
    console.log("\n⚠️  No screenshot taken (cancelled or failed). Exiting.\n");
    process.exit(0);
  }

  console.log("✅ Screenshot captured.\n");
}

// ─── Resize for API ───────────────────────────────────────────────────────────

async function prepareImage() {
  // Resize to max 1568px wide — Claude vision sweet spot, keeps tokens low
  let imageBuffer;

  try {
    const { default: sharp } = await import("sharp");
    imageBuffer = await sharp(SCREENSHOT_PATH)
      .resize({ width: 1568, withoutEnlargement: true })
      .png()
      .toBuffer();
  } catch {
    // If sharp fails, just read the raw file
    imageBuffer = fs.readFileSync(SCREENSHOT_PATH);
  }

  return imageBuffer.toString("base64");
}

// ─── Claude API call ──────────────────────────────────────────────────────────

async function analyzeWithClaude(base64Image, systemPrompt) {
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
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/png",
                data: base64Image,
              },
            },
            {
              type: "text",
              text: "Observe this screenshot and give me your full analysis.",
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err?.error?.message || `API error ${response.status}`);
  }

  const data = await response.json();
  return data.content[0].text;
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

// ─── Pretty print ─────────────────────────────────────────────────────────────

function printResult(text, target) {
  const divider = "─".repeat(60);
  const label = target === "facebook" ? "Facebook Observer" : "FB Agent Observer";
  const timestamp = new Date().toLocaleTimeString("en-CA", { hour12: false });

  console.log(`\n${divider}`);
  console.log(`◈  ${label}  ·  ${timestamp}`);
  console.log(`${divider}\n`);
  console.log(text);
  console.log(`\n${divider}\n`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n◈  FB Agent Observer\n");

  // Resolve target
  let resolvedTarget = target;
  if (resolvedTarget === "choose") {
    resolvedTarget = await chooseTarget();
  }

  if (!["facebook", "agent"].includes(resolvedTarget)) {
    console.error(`Unknown target: "${resolvedTarget}". Use "facebook" or "agent".`);
    process.exit(1);
  }

  const systemPrompt = SYSTEM_PROMPTS[resolvedTarget];
  console.log(`🎯 Target: ${resolvedTarget === "facebook" ? "Facebook" : "FB Agent app"}\n`);

  // Screenshot
  await takeScreenshot();

  // Prepare image
  console.log("🔍 Sending to Claude...\n");
  const base64Image = await prepareImage();

  // Analyze
  const result = await analyzeWithClaude(base64Image, systemPrompt);

  // Print
  printResult(result, resolvedTarget);

  // Cleanup
  fs.unlinkSync(SCREENSHOT_PATH);
}

main().catch((err) => {
  console.error(`\n❌ Error: ${err.message}\n`);
  process.exit(1);
});
