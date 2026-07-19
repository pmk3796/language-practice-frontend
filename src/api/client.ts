import type { Correction, LanguageOption, ProfileOption, Translation, WordPair } from '@/types'

const BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000'

export interface HistoryTurn {
  role: 'user' | 'assistant'
  content: string
}

export async function fetchLanguages(): Promise<{ default: string; languages: LanguageOption[] }> {
  const res = await fetch(`${BASE}/api/languages`)
  if (!res.ok) throw new Error('Could not load languages')
  return res.json()
}

export async function fetchProfiles(): Promise<{ default: string; profiles: ProfileOption[] }> {
  const res = await fetch(`${BASE}/api/profiles`)
  if (!res.ok) throw new Error('Could not load profiles')
  return res.json()
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
  speed: 'slow' | 'normal',
  history: HistoryTurn[],
  cb: StreamCallbacks,
): Promise<void> {
  const form = new FormData()
  form.append('audio', audio, filename)
  form.append('language', language)
  form.append('profile', profile)
  form.append('speed', speed)
  form.append('history', JSON.stringify(history))

  const res = await fetch(`${BASE}/api/conversation`, { method: 'POST', body: form })

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
