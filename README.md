# BloxWatch 🎮🛡️

Real-time Roblox parental monitoring dashboard. Track your child's online status, game activity, friends list, and chat safety settings — all from one sleek dashboard.

## Features

- 🟢 **Live Status** — Online / Offline / In-Game / In Studio with pulse animations
- 🎭 **Avatar Display** — Full avatar render from Roblox
- 🎮 **Current Game** — See what they're playing with a "Join Server" link
- 💬 **Chat Safety Monitor** — Chat filter status + parental controls link
- 👥 **Friends List** — All friends with headshots & online status
- 📊 **Activity Timeline** — Logs every status change automatically
- 🔄 **Auto-Refresh** — 30-second countdown with visual progress ring

## Tech Stack

- HTML / CSS / JavaScript (vanilla)
- Vercel Serverless Functions (API proxy for Roblox CORS)
- Roblox Public APIs (Presence, Users, Thumbnails, Friends, Games)

## Deployment

Deployed on Vercel. The serverless proxy at `/api/roblox` handles CORS for Roblox API calls.
