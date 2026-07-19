# Language Practice — Frontend

A Vue 3 + TypeScript (Vite) dashboard for spoken language practice. One mic
button drives everything; the rest of the UI reacts to the streamed response.

## Layout

| Panel            | What it does                                                                 |
| ---------------- | ---------------------------------------------------------------------------- |
| **Record**       | The one button. Records your voice and streams a reply back.                 |
| **Conversation** | The running transcript. Tap any word in a reply to flip it to English.       |
| **Translations** | English words you used, translated. Tap ＋ to save one as a flashcard.        |
| **Corrections**  | Grammar fixes for what you said, with a short explanation.                    |
| **Flashcards**   | Your saved vocabulary, with a quick tap-to-reveal review mode.               |

## Language-agnostic

The language selector is populated from the backend's `/api/languages`, so the
set of languages is defined in one place (the backend registry). Each language
keeps its **own** conversation, translations, corrections, and flashcards, all
persisted to `localStorage` — switching languages never mixes them.

## Setup

```bash
npm install
npm run dev        # http://localhost:5173
```

Make sure the backend is running (default `http://localhost:3000`). To point at a
different backend, copy `.env.example` to `.env` and set `VITE_API_BASE`.

## How a turn flows

1. `useRecorder` captures mic audio into a `webm/opus` blob.
2. `api/client.ts` POSTs it and reads the **SSE** stream.
3. The Pinia store (`stores/practice.ts`) applies each event live:
   `transcript` → adds your message, `reply_delta` → types the reply out,
   `meta` → fills translations/corrections + word toggles, `audio` → plays the
   spoken reply.

## Build

```bash
npm run build      # type-checks then bundles to dist/
```
