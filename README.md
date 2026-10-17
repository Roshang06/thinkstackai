# Thinkstack

A document-first study app. You describe a topic, and the lesson shows up as a page of explanations, equations, graphs, checks, flashcards, code, and simulations. The side panel is only for edit requests. The reply is one short status line, and the change lands in the document.

## Run

```bash
npm install
npm run dev
```

Open http://localhost:3000.

Public lessons can be read without an account. Creating a lesson asks you to sign up or log in, then writes the lesson with a model. Generation tries OpenRouter, then Backboard, then Gemini, and skips any key you have not set. If every configured model fails, the page shows an error instead of a placeholder outline. Lessons are saved in MongoDB when `MONGODB_URI` is set, and in `.data/store.json` otherwise.

## Keys

Copy `.env.example` to `.env.local` and fill in:

- `OPENROUTER_API_KEY` from [OpenRouter](https://openrouter.ai/keys). Optional `OPENROUTER_MODEL`, default `openai/gpt-4o-mini`.
- `BACKBOARD_API_KEY` from [Backboard](https://app.backboard.io). Optional `BACKBOARD_PROVIDER` and `BACKBOARD_MODEL`, default `openai` and `gpt-4o-mini`.
- `GOOGLE_GENERATIVE_AI_API_KEY` from [Google AI Studio](https://aistudio.google.com/apikey). Optional `GEMINI_MODEL`, default `gemini-3.8-flash`. If that model is overloaded, the app tries `gemini-3.5-flash`, `gemini-3.5-flash-lite`, and `gemini-flash-latest`.
- `MONGODB_URI` from a MongoDB Atlas cluster when you want shared storage
- `SESSION_SECRET`, a long random string that signs the login cookie
- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` for the Google button. In Google Cloud, add the redirect URI `http://localhost:3000/api/auth/google/callback` and the same path on the Vercel domain.

Restart `npm run dev` after changing any value. On Vercel, set `MONGODB_URI`, `SESSION_SECRET`, and at least one of `OPENROUTER_API_KEY`, `BACKBOARD_API_KEY`, or `GOOGLE_GENERATIVE_AI_API_KEY`. Add the Google client values there too if you want Google sign-in.

## Checks

```bash
npm test
```
