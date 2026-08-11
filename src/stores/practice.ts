import { defineStore } from 'pinia'
import { computed, reactive, ref, watch } from 'vue'
import type {
  ChatMessage,
  Flashcard,
  LanguageOption,
  LevelOption,
  ProfileOption,
  Session,
} from '@/types'
import {
  fetchLanguages,
  fetchLevels,
  fetchProfiles,
  requestRecap,
  requestTags,
  streamConversation,
  type HistoryTurn,
} from '@/api/client'
import { base64ToBlobUrl, playAudio } from '@/lib/audio'

type SpeechSpeed = 'slow' | 'normal'
type Status = 'idle' | 'processing' | 'error'
export type ThemeChoice = 'light' | 'dark' | 'auto'
export type PaletteId = 'calm' | 'confident'
/** Which side of a flashcard you're shown first during review. */
export type ReviewDirection = 'target' | 'english' | 'mixed'

/** Colour schemes; each one has its own light and dark variant. */
export const PALETTES: { id: PaletteId; name: string; blurb: string; swatch: string[] }[] = [
  { id: 'calm', name: 'Calm', blurb: 'Teal and forest green', swatch: ['#0f7a6e', '#2e6f40', '#f6f5f1'] },
  { id: 'confident', name: 'Confident', blurb: 'Indigo and mint', swatch: ['#6c8cff', '#4ad6a0', '#1a1e30'] },
]

const STORAGE_KEY = 'language-practice:v2'
const MAX_HISTORY_TURNS = 10

function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

/** Are all brackets in this string properly opened and closed? */
function bracketsBalanced(s: string): boolean {
  const closerFor: Record<string, string> = { '(': ')', '[': ']', '{': '}' }
  const closers = new Set(Object.values(closerFor))
  const stack: string[] = []
  for (const ch of s) {
    if (closerFor[ch]) stack.push(closerFor[ch])
    else if (closers.has(ch) && stack.pop() !== ch) return false
  }
  return stack.length === 0
}

const EDGE_PUNCT = /[\p{P}\p{S}\s]/u

/**
 * Strip leading/trailing punctuation, keeping the core word — so "lima," ->
 * "lima" and "¿cómo" -> "cómo", while "l'acqua" stays intact.
 *
 * Stripping stops at a character whose removal would unbalance a bracket pair,
 * so a gloss like "you (formal)" keeps its closing parenthesis.
 */
function cleanWord(s: string): string {
  let out = s.trim()
  while (out.length && EDGE_PUNCT.test(out[0]!) && bracketsBalanced(out.slice(1))) {
    out = out.slice(1)
  }
  while (out.length && EDGE_PUNCT.test(out[out.length - 1]!) && bracketsBalanced(out.slice(0, -1))) {
    out = out.slice(0, -1)
  }
  return out
}

/** Repair a string an earlier version of cleanWord truncated, e.g. "you (formal". */
function repairBrackets(s: string): string {
  const closerFor: Record<string, string> = { '(': ')', '[': ']', '{': '}' }
  const closers = new Set(Object.values(closerFor))
  const stack: string[] = []
  for (const ch of s) {
    if (closerFor[ch]) stack.push(closerFor[ch])
    else if (closers.has(ch)) stack.pop()
  }
  return s + stack.reverse().join('')
}

// Case-insensitive, punctuation-insensitive key used to match/dedupe words.
// Exported so the conversation can match saved phrases the same way.
export function wordKey(s: string): string {
  return cleanWord(s).toLowerCase()
}

// The home page is scoped to one language, or 'all'. This scope filters history
// (and, in future, a home flashcards panel) so languages never get jumbled.
type HomeScope = string | 'all'

interface Persisted {
  homeLanguage: HomeScope
  draftLanguage: string
  draftProfile: string
  speed: SpeechSpeed
  theme: ThemeChoice
  palette: PaletteId
  // CEFR level per language — you're rarely the same level in two languages.
  levels: Record<string, string>
  reviewDirection: ReviewDirection
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
        homeLanguage: p.homeLanguage || 'all',
        draftLanguage: p.draftLanguage || 'it',
        draftProfile: p.draftProfile || 'free',
        speed: p.speed === 'slow' ? 'slow' : 'normal',
        theme: p.theme === 'light' || p.theme === 'dark' ? p.theme : 'auto',
        palette: p.palette === 'confident' ? 'confident' : 'calm',
        levels: p.levels || {},
        reviewDirection:
          p.reviewDirection === 'english' || p.reviewDirection === 'mixed' ? p.reviewDirection : 'target',
        activeSessionId: p.activeSessionId ?? null,
        sessions: Array.isArray(p.sessions) ? p.sessions : [],
        flashcards: p.flashcards || {},
      }
    }
  } catch {
    /* ignore corrupt storage */
  }
  return {
    homeLanguage: 'all',
    draftLanguage: 'it',
    draftProfile: 'free',
    speed: 'normal',
    theme: 'auto',
    palette: 'calm',
    levels: {},
    reviewDirection: 'target',
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
  const levels = ref<LevelOption[]>([])
  const defaultLevel = ref('a2')
  const levelByLang = reactive<Record<string, string>>(persisted.levels)

  // Home page language scope: 'all' or a specific language code.
  const homeLanguage = ref<HomeScope>(persisted.homeLanguage)

  // Lobby draft selection (what a new session will be created with)
  const draftLanguage = ref(persisted.draftLanguage)
  const draftProfile = ref(persisted.draftProfile)

  // Global preference — editable any time, including mid-session
  const speed = ref<SpeechSpeed>(persisted.speed)

  // --- Appearance -----------------------------------------------------------
  const theme = ref<ThemeChoice>(persisted.theme)
  const systemDark = ref(
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : true,
  )
  // 'auto' follows the OS, so keep the system preference live.
  if (typeof window !== 'undefined' && window.matchMedia) {
    window
      .matchMedia('(prefers-color-scheme: dark)')
      .addEventListener('change', (e) => (systemDark.value = e.matches))
  }
  const resolvedTheme = computed<'light' | 'dark'>(() =>
    theme.value === 'auto' ? (systemDark.value ? 'dark' : 'light') : theme.value,
  )
  // Components never check the theme — they just read tokens off <html>.
  watch(
    resolvedTheme,
    (t) => {
      if (typeof document !== 'undefined') document.documentElement.dataset.theme = t
    },
    { immediate: true },
  )
  function setTheme(choice: ThemeChoice) {
    theme.value = choice
  }

  // Colour scheme, independent of light/dark.
  const palette = ref<PaletteId>(persisted.palette)
  watch(
    palette,
    (p) => {
      if (typeof document !== 'undefined') document.documentElement.dataset.palette = p
    },
    { immediate: true },
  )
  function setPalette(id: PaletteId) {
    palette.value = id
  }

  // Settings dialog
  const showSettings = ref(false)
  const openSettings = () => (showSettings.value = true)
  const closeSettings = () => (showSettings.value = false)

  // Turn status
  const status = ref<Status>('idle')
  const errorMessage = ref('')
  const errorCode = ref('')

  // Sessions
  const sessions = reactive<Session[]>(persisted.sessions)
  const activeSessionId = ref<string | null>(persisted.activeSessionId)
  const flashcardsByLang = reactive<Record<string, Flashcard[]>>(persisted.flashcards)

  // One-time cleanup: strip punctuation from existing cards and keep one card
  // per foreign word (dropping punctuation/case/gloss duplicates).
  for (const code of Object.keys(flashcardsByLang)) {
    const seen = new Set<string>()
    flashcardsByLang[code] = flashcardsByLang[code].filter((c) => {
      c.target = cleanWord(repairBrackets(c.target))
      c.english = cleanWord(repairBrackets(c.english))
      const key = c.target.toLowerCase()
      if (!c.target || seen.has(key)) return false
      seen.add(key)
      return true
    })
  }

  // Recap overlay
  const showRecap = ref(false)
  const recapLoading = ref(false)
  const recapError = ref('')

  // Flashcard review: which language deck we're reviewing (null = not reviewing)
  const reviewLanguage = ref<string | null>(null)
  const reviewDirection = ref<ReviewDirection>(persisted.reviewDirection)
  function setReviewDirection(d: ReviewDirection) {
    reviewDirection.value = d
  }
  const tagging = ref(false)

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

  // The deck currently under review (its own language, independent of sessions).
  const reviewDeck = computed(() =>
    reviewLanguage.value ? ensureDeck(reviewLanguage.value) : [],
  )

  // A card "needs practice" if it's low in the Leitner boxes, or has ever been
  // missed — a word you got wrong once is worth another look even if it has
  // since climbed back up.
  function needsPractice(c: Flashcard): boolean {
    return (c.box ?? 1) <= 2 || (c.wrongCount ?? 0) > 0
  }

  // Summary shown on the home flashcards card.
  function deckStats(lang: string) {
    const deck = flashcardsByLang[lang] ?? []
    return {
      total: deck.length,
      needsPractice: deck.filter(needsPractice).length,
    }
  }

  /**
   * Decks shown on the home page: any language with cards, plus any language
   * you've practised — otherwise a language with an empty deck is unreachable
   * and you could never add a first card to it by hand.
   */
  const languagesWithDecks = computed(() =>
    languages.value.filter(
      (l) =>
        (flashcardsByLang[l.code]?.length ?? 0) > 0 ||
        sessions.some((sess) => sess.language === l.code),
    ),
  )

  // Info objects (named activeLanguage/activeProfile so existing panels keep working)
  const activeLanguage = computed(() => languages.value.find((l) => l.code === activeLangCode.value))
  const activeProfile = computed(() => profiles.value.find((p) => p.id === activeProfileId.value))
  const draftLanguageInfo = computed(() => languages.value.find((l) => l.code === draftLanguage.value))
  const draftProfileInfo = computed(() => profiles.value.find((p) => p.id === draftProfile.value))

  const sortedSessions = computed(() => [...sessions].sort((a, b) => b.createdAt - a.createdAt))

  // Level follows the language in play: the active session's, or the one a new
  // session would start in.
  const levelLangCode = computed(() => activeSession.value?.language ?? newSessionLanguage.value)
  const level = computed(() => levelByLang[levelLangCode.value] ?? defaultLevel.value)
  const activeLevel = computed(() => levels.value.find((l) => l.id === level.value))
  function setLevel(id: string) {
    levelByLang[levelLangCode.value] = id
  }

  // Home page is scoped by homeLanguage; 'all' shows everything.
  const filteredSessions = computed(() =>
    homeLanguage.value === 'all'
      ? sortedSessions.value
      : sortedSessions.value.filter((s) => s.language === homeLanguage.value),
  )
  const homeLanguageInfo = computed(() =>
    homeLanguage.value === 'all' ? null : languages.value.find((l) => l.code === homeLanguage.value),
  )
  // Only languages you've actually had a conversation in — for the home filter pills.
  const practisedLanguages = computed(() =>
    languages.value.filter((l) => sessions.some((s) => s.language === l.code)),
  )
  // The language a new conversation will use: the scoped one, or the draft pick in 'all' mode.
  const newSessionLanguage = computed(() =>
    homeLanguage.value === 'all' ? draftLanguage.value : homeLanguage.value,
  )
  const newSessionLanguageInfo = computed(() =>
    languages.value.find((l) => l.code === newSessionLanguage.value),
  )

  function languageInfo(code: string) {
    return languages.value.find((l) => l.code === code)
  }
  function profileInfo(id: string) {
    return profiles.value.find((p) => p.id === id)
  }

  // --- Persistence ----------------------------------------------------------
  watch(
    [homeLanguage, draftLanguage, draftProfile, speed, theme, palette, levelByLang, reviewDirection, activeSessionId, sessions, flashcardsByLang],
    () => {
      // Strip volatile fields (blob URLs, pending flags) that don't survive reload.
      const cleanSessions = sessions.map((s) => ({
        ...s,
        messages: s.messages.map((m) => ({ id: m.id, role: m.role, text: m.text, words: m.words })),
      }))
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          homeLanguage: homeLanguage.value,
          draftLanguage: draftLanguage.value,
          draftProfile: draftProfile.value,
          speed: speed.value,
          theme: theme.value,
          palette: palette.value,
          levels: levelByLang,
          reviewDirection: reviewDirection.value,
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
    // Reset the home scope if it points at a language that no longer exists.
    if (homeLanguage.value !== 'all' && !res.languages.some((l) => l.code === homeLanguage.value)) {
      homeLanguage.value = 'all'
    }
  }
  async function loadLevels() {
    const res = await fetchLevels()
    levels.value = res.levels
    defaultLevel.value = res.default
  }

  async function loadProfiles() {
    const res = await fetchProfiles()
    profiles.value = res.profiles
    if (!res.profiles.some((p) => p.id === draftProfile.value)) draftProfile.value = res.default
  }

  // --- Lobby / session lifecycle -------------------------------------------
  function setHomeLanguage(scope: HomeScope) {
    homeLanguage.value = scope
  }
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
      language: newSessionLanguage.value,
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
    // If that was the last conversation in the scoped language, drop back to 'all'.
    if (homeLanguage.value !== 'all' && !sessions.some((s) => s.language === homeLanguage.value)) {
      homeLanguage.value = 'all'
    }
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
      await streamConversation(blob, filename, s.language, s.profile, level.value, speed.value, history, {
        onTranscript: ({ userMessage }) => {
          // Keep the learner's own recording so they can replay what they said.
          // It's their real audio, so it only lasts the session (not persisted).
          s.messages.push({
            id: uid(),
            role: 'user',
            text: userMessage,
            words: [],
            audioUrl: URL.createObjectURL(blob),
          })
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
  // A word is matched by its foreign form only (punctuation/case-insensitive).
  // The English gloss varies by context ("certo" = "sure" / "of course"), but
  // it's the same vocabulary word — so it's one card, and it shows as saved
  // wherever the word appears regardless of that turn's translation.
  function findFlashcard(target: string): Flashcard | undefined {
    const tk = wordKey(target)
    return ensureDeck(activeLangCode.value).find((c) => wordKey(c.target) === tk)
  }

  function isFlashcardSaved(target: string): boolean {
    return !!findFlashcard(target)
  }

  /**
   * Deck editing, always against an explicit language. The helpers below this
   * act on whichever language the current session/lobby is using, which is not
   * necessarily the deck open in review.
   */
  function addCardTo(lang: string, target: string, english: string): 'added' | 'duplicate' | 'empty' {
    const t = cleanWord(repairBrackets(target))
    const e = cleanWord(repairBrackets(english))
    if (!t || !e) return 'empty'
    const deck = ensureDeck(lang)
    if (deck.some((c) => wordKey(c.target) === wordKey(t))) return 'duplicate'
    deck.push({ id: uid(), target: t, english: e, box: 1, createdAt: Date.now() })
    return 'added'
  }

  /** Returns the removed card and where it was, so it can be put back. */
  function removeCardFrom(lang: string, id: string): { card: Flashcard; index: number } | null {
    const deck = ensureDeck(lang)
    const index = deck.findIndex((c) => c.id === id)
    if (index < 0) return null
    const [card] = deck.splice(index, 1)
    return { card: card!, index }
  }

  function restoreCardTo(lang: string, card: Flashcard, index: number) {
    const deck = ensureDeck(lang)
    deck.splice(Math.min(index, deck.length), 0, card)
  }

  function addFlashcard(target: string, english: string) {
    const t = cleanWord(target)
    const e = cleanWord(english)
    if (!t) return
    if (findFlashcard(t)) return
    ensureDeck(activeLangCode.value).push({
      id: uid(),
      target: t,
      english: e,
      box: 1,
      createdAt: Date.now(),
    })
  }

  function toggleFlashcard(target: string, english: string) {
    const existing = findFlashcard(target)
    if (existing) removeFlashcard(existing.id)
    else addFlashcard(target, english)
  }

  function removeFlashcard(id: string) {
    const deck = ensureDeck(activeLangCode.value)
    const i = deck.findIndex((c) => c.id === id)
    if (i >= 0) deck.splice(i, 1)
  }

  // Grade a card during review: update the Leitner box + behavioral metadata.
  function gradeCard(lang: string, id: string, known: boolean) {
    const card = ensureDeck(lang).find((c) => c.id === id)
    if (!card) return
    card.reviewCount = (card.reviewCount ?? 0) + 1
    card.lastReviewedAt = Date.now()
    if (known) {
      card.box = Math.min((card.box ?? 1) + 1, 5)
    } else {
      card.box = 1
      card.wrongCount = (card.wrongCount ?? 0) + 1
    }
  }

  // Kept for the in-session flashcards panel (operates on the session's deck).
  function reviewFlashcard(id: string, known: boolean) {
    gradeCard(activeLangCode.value, id, known)
  }

  // --- Review lifecycle -----------------------------------------------------
  function startReview(lang: string) {
    reviewLanguage.value = lang
    tagDeck(lang) // categorise any untagged cards in the background
  }

  function exitReview() {
    reviewLanguage.value = null
  }

  // Lazy, batched AI categorisation of a deck's untagged cards.
  async function tagDeck(lang: string) {
    const deck = ensureDeck(lang)
    const untagged = deck.filter((c) => !c.tagged)
    if (!untagged.length || tagging.value) return
    tagging.value = true
    try {
      const tags = await requestTags(
        lang,
        untagged.map((c) => ({ target: c.target, english: c.english })),
      )
      const byKey = new Map(tags.map((t) => [wordKey(t.target), t]))
      for (const c of untagged) {
        const t = byKey.get(wordKey(c.target))
        c.topic = t?.topic ?? 'Other'
        c.partOfSpeech = t?.partOfSpeech ?? 'other'
        c.tagged = true // mark attempted so we don't re-request it
      }
    } catch {
      // Leave untagged; it'll retry next time the deck is opened.
    } finally {
      tagging.value = false
    }
  }

  return {
    // config
    languages,
    profiles,
    levels,
    level,
    activeLevel,
    // home scope
    homeLanguage,
    homeLanguageInfo,
    practisedLanguages,
    filteredSessions,
    newSessionLanguage,
    newSessionLanguageInfo,
    // lobby draft
    draftLanguage,
    draftProfile,
    draftLanguageInfo,
    draftProfileInfo,
    // preference
    speed,
    theme,
    resolvedTheme,
    palette,
    showSettings,
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
    // flashcards / review
    reviewLanguage,
    reviewDirection,
    setReviewDirection,
    reviewDeck,
    tagging,
    languagesWithDecks,
    deckStats,
    needsPractice,
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
    loadLevels,
    setLevel,
    setHomeLanguage,
    setDraftLanguage,
    setDraftProfile,
    setSpeed,
    setTheme,
    setPalette,
    openSettings,
    closeSettings,
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
    isFlashcardSaved,
    addCardTo,
    removeCardFrom,
    restoreCardTo,
    addFlashcard,
    toggleFlashcard,
    removeFlashcard,
    reviewFlashcard,
    gradeCard,
    startReview,
    exitReview,
    tagDeck,
  }
})
