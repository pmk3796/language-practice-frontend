import { defineStore } from 'pinia'
import { computed, reactive, ref, watch } from 'vue'
import type {
  ChatMessage,
  Flashcard,
  LanguageOption,
  ProfileOption,
  Session,
} from '@/types'
import {
  fetchLanguages,
  fetchProfiles,
  requestRecap,
  streamConversation,
  type HistoryTurn,
} from '@/api/client'
import { base64ToBlobUrl, playAudio } from '@/lib/audio'

type SpeechSpeed = 'slow' | 'normal'
type Status = 'idle' | 'processing' | 'error'

const STORAGE_KEY = 'language-practice:v2'
const MAX_HISTORY_TURNS = 10

function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

interface Persisted {
  draftLanguage: string
  draftProfile: string
  speed: SpeechSpeed
  activeSessionId: string | null
  sessions: Session[]
  // Flashcards are your vocabulary, kept per language and shared across sessions.
  flashcards: Record<string, Flashcard[]>
}

/** Rescue flashcards from the old (v1) single-conversation format, if present. */
function migrateFlashcardsFromV1(): Record<string, Flashcard[]> {
  try {
    const raw = localStorage.getItem('language-practice:v1')
    if (!raw) return {}
    const p = JSON.parse(raw)
    const out: Record<string, Flashcard[]> = {}
    for (const [lang, d] of Object.entries<any>(p.data || {})) {
      if (Array.isArray(d?.flashcards) && d.flashcards.length) out[lang] = d.flashcards
    }
    return out
  } catch {
    return {}
  }
}

function load(): Persisted {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const p = JSON.parse(raw) as Partial<Persisted>
      return {
        draftLanguage: p.draftLanguage || 'it',
        draftProfile: p.draftProfile || 'free',
        speed: p.speed === 'slow' ? 'slow' : 'normal',
        activeSessionId: p.activeSessionId ?? null,
        sessions: Array.isArray(p.sessions) ? p.sessions : [],
        flashcards: p.flashcards || {},
      }
    }
  } catch {
    /* ignore corrupt storage */
  }
  return {
    draftLanguage: 'it',
    draftProfile: 'free',
    speed: 'normal',
    activeSessionId: null,
    sessions: [],
    flashcards: migrateFlashcardsFromV1(),
  }
}

export const usePracticeStore = defineStore('practice', () => {
  const persisted = load()

  // Config (from backend)
  const languages = ref<LanguageOption[]>([])
  const profiles = ref<ProfileOption[]>([])

  // Lobby draft selection (what a new session will be created with)
  const draftLanguage = ref(persisted.draftLanguage)
  const draftProfile = ref(persisted.draftProfile)

  // Global preference — editable any time, including mid-session
  const speed = ref<SpeechSpeed>(persisted.speed)

  // Turn status
  const status = ref<Status>('idle')
  const errorMessage = ref('')
  const errorCode = ref('')

  // Sessions
  const sessions = reactive<Session[]>(persisted.sessions)
  const activeSessionId = ref<string | null>(persisted.activeSessionId)
  const flashcardsByLang = reactive<Record<string, Flashcard[]>>(persisted.flashcards)

  // Recap overlay
  const showRecap = ref(false)
  const recapLoading = ref(false)
  const recapError = ref('')

  // --- Computed views -------------------------------------------------------
  const activeSession = computed(() => sessions.find((s) => s.id === activeSessionId.value) || null)
  const isArchived = computed(() => !!activeSession.value?.endedAt)

  const messages = computed(() => activeSession.value?.messages ?? [])
  const translations = computed(() => activeSession.value?.translations ?? [])
  const corrections = computed(() => activeSession.value?.corrections ?? [])

  // The language whose deck we show: the active session's, or the lobby draft.
  const activeLangCode = computed(() => activeSession.value?.language ?? draftLanguage.value)
  const activeProfileId = computed(() => activeSession.value?.profile ?? draftProfile.value)

  function ensureDeck(lang: string): Flashcard[] {
    if (!flashcardsByLang[lang]) flashcardsByLang[lang] = []
    return flashcardsByLang[lang]
  }
  const flashcards = computed(() => ensureDeck(activeLangCode.value))

  // Info objects (named activeLanguage/activeProfile so existing panels keep working)
  const activeLanguage = computed(() => languages.value.find((l) => l.code === activeLangCode.value))
  const activeProfile = computed(() => profiles.value.find((p) => p.id === activeProfileId.value))
  const draftLanguageInfo = computed(() => languages.value.find((l) => l.code === draftLanguage.value))
  const draftProfileInfo = computed(() => profiles.value.find((p) => p.id === draftProfile.value))

  const sortedSessions = computed(() => [...sessions].sort((a, b) => b.createdAt - a.createdAt))

  function languageInfo(code: string) {
    return languages.value.find((l) => l.code === code)
  }
  function profileInfo(id: string) {
    return profiles.value.find((p) => p.id === id)
  }

  // --- Persistence ----------------------------------------------------------
  watch(
    [draftLanguage, draftProfile, speed, activeSessionId, sessions, flashcardsByLang],
    () => {
      // Strip volatile fields (blob URLs, pending flags) that don't survive reload.
      const cleanSessions = sessions.map((s) => ({
        ...s,
        messages: s.messages.map((m) => ({ id: m.id, role: m.role, text: m.text, words: m.words })),
      }))
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          draftLanguage: draftLanguage.value,
          draftProfile: draftProfile.value,
          speed: speed.value,
          activeSessionId: activeSessionId.value,
          sessions: cleanSessions,
          flashcards: flashcardsByLang,
        }),
      )
    },
    { deep: true },
  )

  // --- Config load ----------------------------------------------------------
  async function loadLanguages() {
    const res = await fetchLanguages()
    languages.value = res.languages
    if (!res.languages.some((l) => l.code === draftLanguage.value)) draftLanguage.value = res.default
  }
  async function loadProfiles() {
    const res = await fetchProfiles()
    profiles.value = res.profiles
    if (!res.profiles.some((p) => p.id === draftProfile.value)) draftProfile.value = res.default
  }

  // --- Lobby / session lifecycle -------------------------------------------
  function setDraftLanguage(code: string) {
    draftLanguage.value = code
  }
  function setDraftProfile(id: string) {
    draftProfile.value = id
  }
  function setSpeed(value: SpeechSpeed) {
    speed.value = value
  }

  function startSession() {
    const session: Session = {
      id: uid(),
      language: draftLanguage.value,
      profile: draftProfile.value,
      createdAt: Date.now(),
      endedAt: null,
      messages: [],
      translations: [],
      corrections: [],
      recap: null,
    }
    sessions.push(session)
    activeSessionId.value = session.id
    status.value = 'idle'
    errorMessage.value = ''
    errorCode.value = ''
    showRecap.value = false
  }

  function openSession(id: string) {
    activeSessionId.value = id
    status.value = 'idle'
    errorMessage.value = ''
    showRecap.value = false
  }

  /** Leave the current session but keep it (resumable) — back to the lobby. */
  function leaveSession() {
    activeSessionId.value = null
    showRecap.value = false
  }

  function deleteSession(id: string) {
    const i = sessions.findIndex((s) => s.id === id)
    if (i >= 0) sessions.splice(i, 1)
    if (activeSessionId.value === id) activeSessionId.value = null
  }

  /** End the active session: generate a recap and archive it (read-only). */
  async function endSession() {
    const s = activeSession.value
    if (!s || s.endedAt) return
    showRecap.value = true
    recapLoading.value = true
    recapError.value = ''
    try {
      const transcript: HistoryTurn[] = s.messages
        .filter((m) => m.text)
        .map((m) => ({ role: m.role, content: m.text }))
      const recap = await requestRecap(
        s.language,
        s.profile,
        transcript,
        s.corrections.map((c) => ({
          correctedSentence: c.correctedSentence,
          explanation: c.explanation,
        })),
      )
      s.recap = recap
      s.endedAt = Date.now() // archive only on success
    } catch (e) {
      recapError.value = e instanceof Error ? e.message : 'Could not generate the recap.'
    } finally {
      recapLoading.value = false
    }
  }

  function viewRecap() {
    showRecap.value = true
  }
  /** Close the recap overlay without leaving the session. */
  function hideRecap() {
    showRecap.value = false
  }
  /** "Done" on the recap → back to the lobby. */
  function finishRecap() {
    showRecap.value = false
    activeSessionId.value = null
  }

  function clearConversation() {
    const s = activeSession.value
    if (!s || s.endedAt) return
    s.messages = []
    s.translations = []
    s.corrections = []
  }

  // --- One conversation turn ------------------------------------------------
  async function submitRecording(blob: Blob, filename: string) {
    const s = activeSession.value
    if (!s || s.endedAt) return

    status.value = 'processing'
    errorMessage.value = ''
    errorCode.value = ''

    const history: HistoryTurn[] = s.messages
      .filter((m) => !m.pending && m.text)
      .slice(-MAX_HISTORY_TURNS)
      .map((m) => ({ role: m.role, content: m.text }))

    let assistant: ChatMessage | null = null
    let userMsg: ChatMessage | null = null

    try {
      await streamConversation(blob, filename, s.language, s.profile, speed.value, history, {
        onTranscript: ({ userMessage }) => {
          s.messages.push({ id: uid(), role: 'user', text: userMessage, words: [] })
          userMsg = s.messages[s.messages.length - 1]!
          s.messages.push({ id: uid(), role: 'assistant', text: '', words: [], pending: true })
          assistant = s.messages[s.messages.length - 1]!
        },
        onReplyDelta: ({ text }) => {
          if (assistant) assistant.text += text
        },
        onMeta: ({ replyWords, userWords, translations: tr, correction }) => {
          if (assistant) assistant.words = replyWords
          if (userMsg && userWords) userMsg.words = userWords
          for (const t of tr) {
            s.translations.unshift({ id: uid(), english: t.english, target: t.target })
          }
          if (correction.correctedSentence) {
            s.corrections.unshift({
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
        onError: ({ message, code }) => {
          if (assistant) assistant.pending = false
          status.value = 'error'
          errorMessage.value = message
          errorCode.value = code || ''
        },
      })
    } catch (err) {
      status.value = 'error'
      errorMessage.value = err instanceof Error ? err.message : 'Something went wrong.'
    } finally {
      if (status.value === 'processing') status.value = 'idle'
    }
  }

  // --- Flashcards (per language deck) ---------------------------------------
  function addFlashcard(target: string, english: string) {
    const deck = ensureDeck(activeLangCode.value)
    const exists = deck.some(
      (c) =>
        c.target.toLowerCase() === target.toLowerCase() &&
        c.english.toLowerCase() === english.toLowerCase(),
    )
    if (exists) return
    deck.push({ id: uid(), target, english, box: 1, createdAt: Date.now() })
  }

  function removeFlashcard(id: string) {
    const deck = ensureDeck(activeLangCode.value)
    const i = deck.findIndex((c) => c.id === id)
    if (i >= 0) deck.splice(i, 1)
  }

  function reviewFlashcard(id: string, known: boolean) {
    const card = ensureDeck(activeLangCode.value).find((c) => c.id === id)
    if (!card) return
    card.box = known ? Math.min(card.box + 1, 5) : 1
  }

  return {
    // config
    languages,
    profiles,
    // lobby draft
    draftLanguage,
    draftProfile,
    draftLanguageInfo,
    draftProfileInfo,
    // preference
    speed,
    // status
    status,
    errorMessage,
    errorCode,
    // session state
    sessions,
    sortedSessions,
    activeSessionId,
    activeSession,
    isArchived,
    messages,
    translations,
    corrections,
    flashcards,
    activeLanguage,
    activeProfile,
    // recap
    showRecap,
    recapLoading,
    recapError,
    // lookups
    languageInfo,
    profileInfo,
    // actions
    loadLanguages,
    loadProfiles,
    setDraftLanguage,
    setDraftProfile,
    setSpeed,
    startSession,
    openSession,
    leaveSession,
    deleteSession,
    endSession,
    viewRecap,
    hideRecap,
    finishRecap,
    clearConversation,
    submitRecording,
    addFlashcard,
    removeFlashcard,
    reviewFlashcard,
  }
})
