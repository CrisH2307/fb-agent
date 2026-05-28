# FB Agent

An AI agent that reads Facebook posts and handles negotiations on your behalf.
Targeted at Vietnamese community groups in Toronto/GTA.

## What it does (v1)

- Paste any Facebook post (rental, marketplace, job, community)
- Agent summarizes it, gives its honest read, and drafts a message to send
- You reply with your intent ("too high, offer $15") and agent refines the message
- Two negotiation styles: Polite & Patient vs Direct & Firm
- You copy the draft and send it yourself inside Facebook (safe, no automation yet)

## Setup

### 1. Clone / open in VS Code

```bash
cd fb-agent
npm install
```

### 2. Get an Anthropic API key

- Go to https://console.anthropic.com
- Create an API key

### 3. Set up environment

```bash
cp .env.example .env
```

Edit `.env` and replace `your_api_key_here` with your actual key:

```
REACT_APP_ANTHROPIC_API_KEY=sk-ant-...
```

### 4. Run

```bash
npm start
```

Opens at http://localhost:3000

---

## Project structure

```
src/
  lib/
    agent.js        ← System prompt + API call logic (edit this to change agent behavior)
  hooks/
    useAgent.js     ← Conversation state management
  App.js            ← UI
  App.css           ← Styles
```

## Customizing the agent

All agent personality and behavior lives in `src/lib/agent.js`:

- `USER_PROFILE` — your name, location, negotiation styles
- `buildSystemPrompt()` — the full system prompt sent to Claude
- `callAgent()` — API call, model, and parameters

To change negotiation styles, edit the `negotiationStyles` object in `USER_PROFILE`.

---

## Roadmap

- [ ] v1: Paste post → agent drafts → you copy & send (current)
- [ ] v2: Voice input/output (Web Speech API)
- [ ] v3: Facebook automation via Playwright (secondary account)
- [ ] v4: React Native mobile app
