# Claude Usage Tracker — Windows

A Windows system tray app that shows your real-time Claude AI usage — session (5h) and weekly limits — as animated progress bars. Click the tray icon to see your usage. No API key needed, works with your Claude.ai session.

Inspired by [Claude Usage Tracker for macOS](https://github.com/hamed-elfayome/Claude-Usage-Tracker) by hamed-elfayome.

---

## Features

- Live session (5h) and weekly usage percentages
- Animated glassmorphism popup with countdown timers
- Tray icon changes color: 🟢 green → 🟡 yellow → 🟠 orange → 🔴 red
- Polls claude.ai every 60 seconds (configurable: 30s / 2min / 5min)
- Session token stored securely in Windows Credential Manager
- Launch at startup option

---

## Screenshot

> *(Coming soon — add after first run)*

---

## Installation

### Option A — Download installer

Download `Claude Usage Tracker Setup.exe` from the [Releases](../../releases) page and run it.

### Option B — Build from source

**Prerequisites:** Node.js 18+, Python 3 (for native module build), Visual Studio Build Tools

```bash
git clone https://github.com/YOUR_USERNAME/claude-usage-tracker-windows
cd claude-usage-tracker-windows
npm install
npm start
```

On first launch, a Claude.ai login window will open. Sign in and the app will capture your session automatically.

---

## How to get your session key (manual fallback)

If auto-capture doesn't work:

1. Open Chrome/Edge and go to https://claude.ai
2. Sign in, then open DevTools (F12) → Application → Cookies → `https://claude.ai`
3. Copy the value of the `sessionKey` cookie
4. The app will ask for it on first launch

---

## Tech Stack

- [Electron](https://electronjs.org)
- [electron-store](https://github.com/sindresorhus/electron-store) — settings persistence
- [keytar](https://github.com/atom/node-keytar) — Windows Credential Manager
- [auto-launch](https://github.com/Teamwork/node-auto-launch) — startup registration
- [node-fetch](https://github.com/node-fetch/node-fetch) — API calls

---

## Contributing

PRs welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).

---

## License

MIT © Izzat
