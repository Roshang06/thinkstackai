# Thinkstack

A document-first study app. You describe a topic, and the lesson shows up as a page of explanations, equations, graphs, checks, flashcards, code, and simulations. The side panel is only for edit requests. The reply is one short status line, and the change lands in the document.

## Run

```bash
npm install
npm run dev
```

Open http://localhost:3000.

Without keys, three topics are fully written: Fourier transform, projectile motion, and derivatives. Other topics become an outline until a Gemini key is set. Lessons are saved in `.data/store.json`.

## Keys

Copy `.env.example` to `.env.local` and fill in:

- `GOOGLE_GENERATIVE_AI_API_KEY` from [Google AI Studio](https://aistudio.google.com/apikey)
- `MONGODB_URI` from a MongoDB Atlas cluster when you want shared storage

Restart `npm run dev` after changing either value.

## Checks

```bash
npm test
```
