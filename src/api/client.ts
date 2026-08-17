import type { Correction, LanguageOption, LevelOption, ProfileOption, Recap, Translation, WordPair } from '@/types'

const BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000'

/**
 * In the desktop app the backend listens on loopback, which any other program
 * on the machine — including any web page in any browser — can also reach. It
 * therefore requires a per-launch token, handed to this renderer through the
 * preload. In a plain browser dev session there is no desktopAPI and no token,
 * and the backend leaves the gate open.
 */
const AUTH_TOKEN: string | undefined = (window as any).desktopAPI?.authToken

/**
 * fetch() with the token attached. Headers are merged rather than replaced so
 * multipart bodies keep the boundary Content-Type the browser sets for them.
 */
function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers)
  if (AUTH_TOKEN) headers.set('X-LP-Token', AUTH_TOKEN)
  return fetch(`${BASE}${path}`, { ...init, headers })
}

export interface HistoryTurn {
  role: 'user' | 'assistant'
  content: string
}

export async function requestRecap(
  language: string,
  profile: string,
  messages: HistoryTurn[],
  corrections: { correctedSentence: string; explanation: string }[],
): Promise<Recap> {
  const res = await apiFetch(`/api/recap`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ language, profile, messages, corrections }),
  })
  if (!res.ok) {
    let message = 'Could not generate the recap.'
    try {
      const body = await res.json()
      if (body?.message) message = body.message
    } catch {
      /* ignore */
    }
    throw new Error(message)
  }
  return res.json()
}

export async function fetchLanguages(): Promise<{ default: string; languages: LanguageOption[] }> {
  const res = await apiFetch(`/api/languages`)
  if (!res.ok) throw new Error('Could not load languages')
  return res.json()
}

export interface Transcript {
  text: string
  /**
   * The transcription is made only of words from the transcription prompt, so
   * the audio probably contained no speech. Advisory: a prompt word can also be
   * a real answer, so only reach for this when the answer was wrong anyway.
   */
  promptEcho: boolean
}

/** Speech-to-text only — used to check a spoken flashcard answer. */
export async function transcribeAudio(
  audio: Blob,
  filename: string,
  language: string,
): Promise<Transcript> {
  const form = new FormData()
  form.append('audio', audio, filename)
  form.append('language', language)
  const res = await apiFetch(`/api/transcribe`, { method: 'POST', body: form })
  if (!res.ok) {
    let message = 'Could not hear that — try again.'
    try {
      const body = await res.json()
      if (body?.message || body?.error) message = body.message || body.error
    } catch {
      /* ignore */
    }
    throw new Error(message)
  }
  const body = await res.json()
  return { text: body.text ?? '', promptEcho: !!body.promptEcho }
}

export async function fetchLevels(): Promise<{ default: string; levels: LevelOption[] }> {
  const res = await apiFetch(`/api/levels`)
  if (!res.ok) throw new Error('Could not load levels')
  return res.json()
}

export async function fetchProfiles(): Promise<{ default: string; profiles: ProfileOption[] }> {
  const res = await apiFetch(`/api/profiles`)
  if (!res.ok) throw new Error('Could not load profiles')
  return res.json()
}

/**
 * Fill in the missing half of a flashcard. `side` is the box the text was typed
 * into and is treated as a hint only; `typedSide` comes back saying which side
 * the text actually turned out to be. Both halves are returned — the model may
 * return a tidier dictionary form of what was given.
 */
export async function completeWordPair(
  language: string,
  side: 'target' | 'english',
  text: string,
  /**
   * The phrase this word was taken from. With it, the reply keeps the form the
   * word had there; without it, the reply is the dictionary form.
   */
  context?: { phrase: string; english: string },
): Promise<{ target: string; english: string; typedSide: 'target' | 'english' }> {
  const res = await apiFetch(`/api/translate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ language, side, text, ...(context ? { context } : {}) }),
  })
  if (!res.ok) {
    let message = 'Could not look that up.'
    try {
      const body = await res.json()
      if (body?.message || body?.error) message = body.message || body.error
    } catch {
      /* ignore */
    }
    throw new Error(message)
  }
  return res.json()
}

export interface WordTag {
  target: string
  topic: string
  partOfSpeech: string
}

// Batch-categorise flashcards (topic + part of speech).
export async function requestTags(
  language: string,
  words: { target: string; english: string }[],
): Promise<WordTag[]> {
  const res = await apiFetch(`/api/tag`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ language, words }),
  })
  if (!res.ok) throw new Error('Could not tag cards')
  const body = await res.json()
  return Array.isArray(body.tags) ? body.tags : []
}

// On-demand pronunciation. Returns a playable object URL, cached so repeated
// plays of the same word don't re-hit the API.
const speechCache = new Map<string, string>()

export async function fetchSpeech(
  text: string,
  language: string,
  speed: 'slow' | 'normal',
): Promise<string> {
  const key = `${language}:${speed}:${text}`
  const cached = speechCache.get(key)
  if (cached) return cached

  const res = await apiFetch(`/api/speak`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, language, speed }),
  })
  if (!res.ok) {
    let message = 'Could not play audio.'
    try {
      const body = await res.json()
      if (body?.message || body?.error) message = body.message || body.error
    } catch {
      /* ignore */
    }
    throw new Error(message)
  }

  const url = URL.createObjectURL(await res.blob())
  speechCache.set(key, url)
  return url
}

// Callbacks fired as the SSE stream arrives. All are optional.
export interface StreamCallbacks {
  onTranscript?: (data: { userMessage: string }) => void
  onReplyDelta?: (data: { text: string }) => void
  onMeta?: (data: {
    replyWords: WordPair[]
    userWords: WordPair[]
    translations: Translation[]
    correction: Correction
  }) => void
  onAudio?: (data: { audio: string; mimeType: string }) => void
  onDone?: (data: unknown) => void
  onError?: (data: { message: string; code?: string }) => void
}

/**
 * POST a recording and consume the Server-Sent Events response. We use fetch +
 * a stream reader (rather than EventSource, which is GET-only) because we send
 * the audio as multipart form data.
 */
export async function streamConversation(
  audio: Blob,
  filename: string,
  language: string,
  profile: string,
  level: string,
  speed: 'slow' | 'normal',
  history: HistoryTurn[],
  cb: StreamCallbacks,
): Promise<void> {
  const form = new FormData()
  form.append('audio', audio, filename)
  form.append('language', language)
  form.append('profile', profile)
  form.append('level', level)
  form.append('speed', speed)
  form.append('history', JSON.stringify(history))

  const res = await apiFetch(`/api/conversation`, { method: 'POST', body: form })

  if (!res.ok || !res.body) {
    let message = `Request failed (${res.status})`
    try {
      const body = await res.json()
      if (body?.error) message = body.error
    } catch {
      /* ignore */
    }
    cb.onError?.({ message })
    return
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    // SSE events are separated by a blank line.
    let sep: number
    while ((sep = buffer.indexOf('\n\n')) !== -1) {
      const rawEvent = buffer.slice(0, sep)
      buffer = buffer.slice(sep + 2)
      dispatchEvent(rawEvent, cb)
    }
  }
}

function dispatchEvent(raw: string, cb: StreamCallbacks): void {
  let event = 'message'
  let dataLine = ''
  for (const line of raw.split('\n')) {
    if (line.startsWith('event:')) event = line.slice(6).trim()
    else if (line.startsWith('data:')) dataLine += line.slice(5).trim()
  }
  if (!dataLine) return

  let data: any
  try {
    data = JSON.parse(dataLine)
  } catch {
    return
  }

  switch (event) {
    case 'transcript':
      cb.onTranscript?.(data)
      break
    case 'reply_delta':
      cb.onReplyDelta?.(data)
      break
    case 'meta':
      cb.onMeta?.(data)
      break
    case 'audio':
      cb.onAudio?.(data)
      break
    case 'done':
      cb.onDone?.(data)
      break
    case 'error':
      cb.onError?.(data)
      break
  }
}
