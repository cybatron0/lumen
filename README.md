# Lumen

**Personal Knowledge Synthesizer** — v0.2

Drop in links, notes, or raw thoughts. Lumen fetches the content, extracts key claims, scores source reliability, flags tensions, and produces a clean, exportable brief.

## Features

- **Real URL fetching** (server-side) with timeouts and graceful failure handling
- Claim extraction from retrieved content + your notes
- Reliability scoring based on fetch success and content richness
- Contradiction / tension flags
- Local-first history (browser localStorage)
- Keyboard-driven (`⌘ / Ctrl + Enter`)
- Export to Markdown or Print/PDF
- Dark, minimal interface

## Quick start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploy

Ready for Vercel. Connect this repository and deploy.

Built with Next.js App Router, Server Actions, and Tailwind CSS.
