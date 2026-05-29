# FB Agent

An AI helper for the Vietnamese-Canadian community in Toronto/GTA to handle
Facebook negotiations — rentals, marketplace, jobs, group posts.

Two pieces work together:

| Piece | Where | What it does |
|---|---|---|
| **Agent** (web app) | [`agent/`](./agent) | React chat UI that drafts negotiation messages from pasted posts. Supports voice in/out. |
| **Observer** (CLI) | [`observer/`](./observer) | Terminal tool that screenshots a window and asks Claude what it sees. Conversation, save, diff, clipboard. |

Both call the Anthropic API directly using model `claude-sonnet-4-6`.

---

## Repo layout

```
fb-agent/
├── README.md                ← you are here
├── agent/                   ← React web app
│   ├── src/
│   │   ├── lib/agent.js     ← system prompt + API call
│   │   ├── hooks/
│   │   │   ├── useAgent.js  ← conversation state
│   │   │   └── useVoice.js  ← Web Speech API (STT + TTS)
│   │   ├── App.js
│   │   └── App.css
│   ├── public/index.html
│   ├── package.json
│   ├── .env                 ← REACT_APP_ANTHROPIC_API_KEY
│   └── .env.example
└── observer/                ← Node CLI tool
    ├── observe.js
    ├── sessions/            ← created by --save
    ├── package.json
    ├── .env                 ← ANTHROPIC_API_KEY (no REACT_APP_ prefix)
    └── .env.example
```

---

## One-time setup

You need **Node 18+** and an Anthropic API key from
<https://console.anthropic.com>.

```bash
cd ~/Documents/SoftwareProject/fb-agent

# Web app
cd agent
npm install
cp .env.example .env
# edit .env → REACT_APP_ANTHROPIC_API_KEY=sk-ant-…
cd ..

# Observer CLI
cd observer
npm install
cp .env.example .env
# edit .env → ANTHROPIC_API_KEY=sk-ant-…       (same key, no REACT_APP_ prefix)
cd ..
```

> The two `.env` files use **different variable names** because Create React App
> only exposes vars prefixed with `REACT_APP_` to the browser. Don't share one
> file between them.

---

## Daily workflow

Open two terminals from the repo root.

**Terminal 1 — the web app:**

```bash
cd agent
npm start
```

Opens at <http://localhost:3000>. To use on your phone, see
[*Running on iPhone*](#running-on-iphone) below.

**Terminal 2 — the observer (run on demand):**

```bash
cd observer
npm run observe          # interactive: choose Facebook or FB Agent
npm run observe:fb       # straight to Facebook
npm run observe:agent    # straight to FB Agent app
npm run observe:save     # observe + persist screenshot/analysis
node observe.js --target facebook --diff   # compare current vs last saved
```

---

## The web app (`agent/`)

### What it does

1. Paste a Facebook post into the textarea (or speak it via mic).
2. The agent replies with four sections — Summary, My Read, Draft Message, Recommendation.
3. You reply (text or voice) with your intent — e.g. *"too high, offer $15"*.
4. The agent refines the draft.
5. You copy the Draft Message and send it inside Facebook yourself.

The full conversation history is sent on every turn so the agent stays in context.

### Voice I/O (Web Speech API)

| Feature | How to use |
|---|---|
| **Speech-to-text** | Click 🎤 in the input footer. Speak. Click again (or wait for silence) to finalize. Edit the textarea if needed, then Send. |
| **Text-to-speech** | The Draft Message of each agent reply is auto-spoken. Toggle 🔊 / 🔇 in the header to mute (persisted across reloads). |
| **Replay** | Each agent bubble has a "🔊 Replay" button to re-hear the draft. |

No new dependencies — uses `window.SpeechRecognition` and `window.speechSynthesis`.
Browsers without support hide the buttons silently; typing still works.

### Negotiation styles

Toggle in the header — **Polite & Patient** vs **Direct & Firm**. Style affects
the system prompt built in `agent/src/lib/agent.js`. Edit `USER_PROFILE` there to
customize name, location, or rewrite the style instructions.

### Running on iPhone

iOS Safari blocks the mic over plain HTTP. To test on your phone:

```bash
# in a new terminal (no signup required)
cloudflared tunnel --url http://localhost:3000
# or
ngrok http 3000
```

Open the resulting **https://…** URL in iPhone Safari. Tap once anywhere on the
page to unlock TTS (an iOS quirk), then grant mic permission. *Share → Add to
Home Screen* gives you a fullscreen app feel.

---

## The observer (`observer/`)

### What it does

1. You run `npm run observe` (or one of the variants).
2. It asks which surface to capture (Facebook or the FB Agent app).
3. On macOS, you click the window to screenshot; Linux uses `scrot`/`import`; Windows uses PowerShell.
4. The image is resized to 1568px wide via `sharp` and sent to Claude vision.
5. A structured analysis prints in your terminal.
6. If a `### ✉️ Suggested Message` section is present, it auto-copies to your clipboard.
7. You're prompted `💬 Follow up?` — ask further questions about the same screenshot, or press Enter to exit.

### Flags

| Flag | What it does |
|---|---|
| `--target facebook` \| `--target agent` | Skip the interactive picker. |
| `--save` | Save the screenshot **and** the analysis to `observer/sessions/YYYY-MM-DD_HH-MM-SS_<target>.{png,txt}`. |
| `--diff` | Take a new screenshot, find the latest saved session for the same target, ask Claude what changed. Errors out if nothing has been `--save`d yet. |

Flags compose: `node observe.js --target facebook --save` works fine.

### Targets

- **`facebook`** → marketplace, group posts, Messenger threads. Output sections: `👁 What I See`, `📦 Key Details`, `💡 My Read`, `✉️ Suggested Message`, `➡️ Next Step`.
- **`agent`** → meta-observation of the React app to sanity-check the agent's latest reply. Output sections: `👁 What I See`, `💬 Conversation State`, `🔍 Observations`, `➡️ What to Do Next`.

### macOS first-run

The screenshot picker (`screencapture -i`) needs **Screen Recording** permission
for whichever terminal you're using (Terminal, iTerm, VS Code). macOS prompts
once, then remembers.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `Missing API key` | Check the right `.env` file exists in `agent/` *or* `observer/` and the variable name matches the prefix rule above. |
| Mic button doesn't appear in browser | Browser doesn't support SpeechRecognition (Firefox). Use Chrome or Safari. |
| iPhone mic doesn't work | You're on plain HTTP. Use a Cloudflare or ngrok HTTPS tunnel. |
| Observer screenshot is blank on macOS | Grant Screen Recording permission to your terminal app, then retry. |
| `--diff` says "no previous saved session" | Run `npm run observe:save` first to create a baseline. |
| `sharp` install fails | Requires Node 18+ on a supported platform. Run `npm install` again with `--verbose` to see the build error. |

---

## Roadmap

- [x] v1 — paste post → agent drafts → you copy & send
- [x] v2 — voice in/out (Web Speech API)
- [x] v2.5 — observer CLI with conversation, save, diff, clipboard
- [ ] v3 — Facebook automation via Playwright (secondary account)
- [ ] v4 — React Native mobile app

---

## Customizing

- **Negotiation tone, profile** → `agent/src/lib/agent.js` (`USER_PROFILE`, `buildSystemPrompt`)
- **Observer prompts** → `observer/observe.js` (`SYSTEM_PROMPTS`, `DIFF_PROMPT`)
- **Voice rate / pitch / voice pick** → `agent/src/hooks/useVoice.js`
- **Screenshot resize width** → `observer/observe.js` (`sharp(...).resize({ width: 1568 })`)
