# Lumen

**Personal Knowledge Synthesizer**

Drop in links, notes, or raw thoughts. Receive a concise, citation-backed brief with reliability scores and contradiction flags.

## Features

- Dark, minimal, keyboard-driven interface
- Local-first storage (history in browser localStorage)
- Source reliability scoring
- Contradiction flags
- Export to Markdown or print/PDF
- ⌘/Ctrl + Enter to synthesize

## Quick start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploy

This project is ready for Vercel. The synthesis engine in this MVP is a structured mock that produces realistic briefs; a production version would wire real retrieval + LLM synthesis behind an API route.

Built with Next.js, Tailwind CSS, and a focus on clarity.
