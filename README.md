# FB Agent Observer

A CLI tool that takes a screenshot and asks Claude what it sees.
Run it from your VS Code terminal whenever you want the agent to observe your screen.

## Setup

```bash
cd fb-agent-observer
npm install
cp .env.example .env
# Edit .env — add your ANTHROPIC_API_KEY
```

## Usage

### Interactive (asks you what to capture)
```bash
node observe.js
```

### Direct — observe Facebook
```bash
node observe.js --target facebook
# or
npm run observe:fb
```

### Direct — observe the FB Agent app
```bash
node observe.js --target agent
# or
npm run observe:agent
```

## What happens

1. Terminal prints: **"Click on the window you want to capture..."** (macOS)
2. You click on the Facebook tab or the FB Agent app window
3. Screenshot is taken, sent to Claude with vision
4. Claude prints its full analysis in the terminal:

**For Facebook target:**
- 👁 What it sees (post content, price, location, seller)
- 📦 Key details extracted
- 💡 Honest deal assessment for Toronto/GTA
- ✉️ Suggested message to send
- ➡️ Recommended next step

**For FB Agent target:**
- 👁 Current state of the chat
- 💬 Conversation summary
- 🔍 What looks good or off in the agent's response
- ➡️ What you should type next

## Platform notes

| OS | Screenshot method |
|---|---|
| macOS | `screencapture -i` (interactive window picker) |
| Linux | `scrot -s` or `import` (ImageMagick) |
| Windows | PowerShell + System.Drawing |

## Tip: VS Code split terminal

Run the React app in one terminal, observer in another:
- Terminal 1: `npm start` (in fb-agent/)
- Terminal 2: `node observe.js` (in fb-agent-observer/) — run this whenever you want a snapshot
# fb-agent
