# FB Agent — Server

Local REST server that runs a headless Playwright browser with a persistent
Facebook session. Exposes a read-only API used by the React agent app.

> ⚠️ **Use a secondary Facebook account — never your main account.**
> Automated browsing, even read-only, violates Facebook's Terms of Service.
> Keep this running locally only. Never expose port 3001 to the internet.

---

## Setup

```bash
cd server
npm install
npx playwright install chromium
```

---

## Login (do once, session persists)

**Terminal 1 — start the server:**

```bash
npm start
```

**Terminal 2 — trigger login:**

```bash
curl -X POST http://localhost:3001/login
```

This opens a visible Chromium window. Log in to your **secondary** Facebook
account (up to 3 minutes). When done, the session is saved to
`session/fb-session.json` and the window closes automatically.

The session persists across server restarts until cookies expire (typically
weeks). To force re-login: `curl http://localhost:3001/session/clear`

---

## Running alongside the React app

Open two terminals:

```bash
# Terminal 1
cd server && npm start        # port 3001

# Terminal 2
cd agent && npm start         # port 3000
```

When the server is running and logged in, the React app shows a green
**"FB Connected"** badge in the header and a search bar appears above the input.

---

## Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/status` | Returns `{ connected, loggedIn }` |
| `POST` | `/login` | Opens visible browser for manual login |
| `GET` | `/search?q=` | Search Marketplace, returns up to 10 results |
| `GET` | `/post?url=` | Fetch full post text from a Facebook URL |
| `GET` | `/session/clear` | Delete saved session, force re-login |

---

## Session file

`session/fb-session.json` is gitignored — **never commit it.**
It contains your Facebook session cookies. Delete it to log out.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Login window doesn't open | Make sure the server is running (`npm start`) first |
| "Not logged in" after login | Wait a few seconds then refresh the React app |
| Search returns no results | Facebook may have changed selectors — open an issue |
| Post text is empty | Try a different post URL; some formats aren't extracted yet |
| Server crashes on start | Check Node version ≥ 18: `node --version` |
