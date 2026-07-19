import { defineStore } from 'pinia'
import { computed, reactive, ref, watch } from 'vue'
import type {
  ChatMessage,
  CorrectionEntry,
  Flashcard,
  LanguageOption,
  TranslationEntry,
} from '@/types'
import { fetchLanguages, streamConversation, type HistoryTurn } from '@/api/client'
import { base64ToBlobUrl, playAudio } from '@/lib/audio'

// Everything a single language accumulates. Data is kept separate per language
// so switching from Italian to Spanish doesn't mix transcripts or flashcards.
interface LanguageData {
  messages: ChatMessage[]
  translations: TranslationEntry[]
  corrections: CorrectionEntry[]
  flashcards: Flashcard[]
}

type Status = 'idle' | 'processing' | 'error'

const STORAGE_KEY = 'language-practice:v1'
const MAX_HISTORY_TURNS = 10

function emptyData(): LanguageData {
  return { messages: [], translations: [], corrections: [], flashcards: [] }
}

function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

// Persisted state loaded from localStorage. Blob URLs and pending flags are not
// serialised (they don't survive a reload), so we strip them on save.
interface Persisted {
  language: string
  data: Record<string, LanguageData>
}

function load(): Persisted {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as Persisted
  } catch {
    /* ignore corrupt storage */
  }
  return { language: 'it', data: {} }
}

export const usePracticeStore = defineStore('practice', () => {
  const persisted = load()

  const languages = ref<LanguageOption[]>([])
  const language = ref<string>(persisted.language)
  const status = ref<Status>('idle')
  const errorMessage = ref('')
  const data = reactive<Record<string, LanguageData>>(persisted.data)

  function ensure(code: string): LanguageData {
    if (!data[code]) data[code] = emptyData()
    return data[code]
  }

  // Current-language views.
  const messages = computed(() => ensure(language.value).messages)
  const translations = computed(() => ensure(language.value).translations)
  const corrections = computed(() => ensure(language.value).corrections)
  const flashcards = computed(() => ensure(language.value).flashcards)

  const activeLanguage = computed(() => languages.value.find((l) => l.code === language.value))

  // --- Persistence -----------------------------------------------------------
  watch(
    [language, data],
    () => {
      const serialisable: Record<string, LanguageData> = {}
      for (const [code, d] of Object.entries(data)) {
        serialisable[code] = {
          messages: d.messages.map((m) => ({
            id: m.id,
            role: m.role,
            text: m.text,
            words: m.words,
          })),
          translations: d.translations,
          corrections: d.corrections,
          flashcards: d.flashcards,
        }
      }
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ language: language.value, data: serialisable }),
      )
    },
    { deep: true },
  )

  // --- Actions ---------------------------------------------------------------
  async function loadLanguages() {
    const res = await fetchLanguages()
    languages.value = res.languages
    // If the stored language is no longer supported, fall back to the default.
    if (!res.languages.some((l) => l.code === language.value)) {
      language.value = res.default
    }
  }

  function setLanguage(code: string) {
    language.value = code
  }

  function clearConversation() {
    const d = ensure(language.value)
    d.messages = []
    d.translations = []
    d.corrections = []
  }

  function historyForRequest(): HistoryTurn[] {
    return messages.value
      .filter((m) => !m.pending && m.text)
      .slice(-MAX_HISTORY_TURNS)
      .map((m) => ({ role: m.role, content: m.text }))
  }

  // Records one full conversation turn, updating state live as the stream lands.
  async function submitRecording(blob: Blob, filename: string) {
    status.value = 'processing'
    errorMessage.value = ''
    const d = ensure(language.value)
    const history = historyForRequest()

    let assistant: ChatMessage | null = null

    try {
      await streamConversation(blob, filename, language.value, history, {
        onTranscript: ({ userMessage }) => {
          d.messages.push({ id: uid(), role: 'user', text: userMessage })
          const msg: ChatMessage = { id: uid(), role: 'assistant', text: '', words: [], pending: true }
          d.messages.push(msg)
          assistant = d.messages[d.messages.length - 1]!
        },
        onReplyDelta: ({ text }) => {
          if (assistant) assistant.text += text
        },
        onMeta: ({ replyWords, translations: tr, correction }) => {
          if (assistant) assistant.words = replyWords
          for (const t of tr) {
            d.translations.unshift({ id: uid(), english: t.english, target: t.target })
          }
          if (correction.correctedSentence) {
            d.corrections.unshift({
              id: uid(),
              correctedSentence: correction.correctedSentence,
              explanation: correction.explanation,
            })
          }
        },
        onAudio: ({ audio, mimeType }) => {
          const url = base64ToBlobUrl(audio, mimeType)
          if (assistant) assistant.audioUrl = url
          playAudio(url)
        },
        onDone: () => {
          if (assistant) assistant.pending = false
          status.value = 'idle'
        },
        onError: ({ message }) => {
          if (assistant) assistant.pending = false
          status.value = 'error'
          errorMessage.value = message
        },
      })
    } catch (err) {
      status.value = 'error'
      errorMessage.value = err instanceof Error ? err.message : 'Something went wrong.'
    } finally {
      if (status.value === 'processing') status.value = 'idle'
    }
  }

  // --- Flashcards ------------------------------------------------------------
  function addFlashcard(target: string, english: string) {
    const d = ensure(language.value)
    const exists = d.flashcards.some(
      (c) => c.target.toLowerCase() === target.toLowerCase() && c.english.toLowerCase() === english.toLowerCase(),
    )
    if (exists) return
    d.flashcards.push({ id: uid(), target, english, box: 1, createdAt: Date.now() })
  }

  function removeFlashcard(id: string) {
    const d = ensure(language.value)
    d.flashcards = d.flashcards.filter((c) => c.id !== id)
  }

  // Simple Leitner update: known -> promote a box, "again" -> back to box 1.
  function reviewFlashcard(id: string, known: boolean) {
    const card = ensure(language.value).flashcards.find((c) => c.id === id)
    if (!card) return
    card.box = known ? Math.min(card.box + 1, 5) : 1
  }

  return {
    languages,
    language,
    status,
    errorMessage,
    messages,
    translations,
    corrections,
    flashcards,
    activeLanguage,
    loadLanguages,
    setLanguage,
    clearConversation,
    submitRecording,
    addFlashcard,
    removeFlashcard,
    reviewFlashcard,
  }
})
